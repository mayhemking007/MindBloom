import { createHash } from "node:crypto";
import type { NotionGardenOverview, NotionGardenSearchResponse, RelatedThought } from "@mindbloom/shared";
import { APIErrorCode, isNotionClientError } from "@notionhq/client";
import { env } from "../config/env.js";
import { ApiError } from "../http/errors.js";
import { normalizeGraphSnapshot } from "../memory/graphNormalizer.js";
import { getMemoGrafterForSession, retrieveMemoGrafterContext } from "../memo-grafter/memoGrafter.js";
import { MindBloomOpenAILLMAdapter } from "../memo-grafter/openAiAdapters.js";
import { findCommentDelivery, saveThoughtFeedback, storeCommentDelivery } from "../repositories/notionGarden.repository.js";
import { findSourceDocument, listSourceDocuments } from "../repositories/sourceDocuments.repository.js";
import type { OwnerScope } from "./entries.service.js";
import { withNotionClient } from "./notionConnections.service.js";
import { selectTopRelatedThoughts } from "./notionThoughts.js";

function owner(owner: OwnerScope) { return { ownerId: owner.ownerId, ownerKind: owner.ownerKind }; }
async function ownedDocument(documentId: string, scope: OwnerScope) {
  const document = await findSourceDocument(documentId, owner(scope));
  if (!document) throw new ApiError(404, "Imported Notion page not found");
  return document;
}

export async function notionGardenOverview(scope: OwnerScope, connectionId: string | null): Promise<NotionGardenOverview> {
  const documents = await listSourceDocuments(owner(scope), connectionId);
  const allReady = documents.filter((item) => item.status === "ready");
  const ready = allReady.slice(0, 40);
  const snapshots = await Promise.all(ready.map(async (document) => {
    try { return { document, snapshot: normalizeGraphSnapshot(await (await getMemoGrafterForSession(document.memo_session_id)).getGraphSnapshot()) }; }
    catch { return null; }
  }));
  const themes = new Map<string, { label: string; summary: string; occurrences: number; documents: Set<string> }>();
  const recentThoughts: NotionGardenOverview["recentThoughts"] = [];
  for (const item of snapshots) {
    if (!item) continue;
    for (const node of item.snapshot.nodes.filter((node) => !node.suppressed)) {
      const key = node.label.trim().toLocaleLowerCase();
      const current = themes.get(key) ?? { label: node.label, summary: node.summary, occurrences: 0, documents: new Set<string>() };
      current.occurrences += Math.max(1, node.episodeCount ?? 1); current.documents.add(item.document.id); themes.set(key, current);
    }
    for (const memory of item.snapshot.memories.filter((memory) => !memory.decayed && !memory.forgotten)) {
      const theme = item.snapshot.nodes.find((node) => node.id === memory.topicNodeId)?.label ?? memory.subject;
      recentThoughts.push({
        id: memory.id, memoryId: memory.id, documentId: item.document.id, documentTitle: item.document.title,
        sourceUrl: item.document.source_url, text: memory.value, theme, memoryType: memory.memoryType,
        sectionId: null, sectionTitle: null, relevance: null, importance: memory.visualImportance, createdAt: memory.createdAt,
      });
    }
  }
  return {
    workspaceId: documents[0]?.workspace_id ?? null,
    documentCount: documents.length,
    readyDocumentCount: allReady.length,
    needsAttention: documents.filter((item) => item.status === "failed" || item.sync_conflict || item.source_access_status === "unavailable").map((row) => ({
      id: row.id, source: row.source, externalId: row.external_id, connectionId: row.connection_id, workspaceId: row.workspace_id,
      title: row.title, content: row.content, sourceUrl: row.source_url, sourceCreatedAt: row.source_created_at.toISOString(), sourceUpdatedAt: row.source_updated_at.toISOString(),
      memoSessionId: row.memo_session_id, status: row.status, ingestion: { runId: row.memo_ingestion_run_id, status: row.ingestion_status, phase: row.ingestion_phase, counts: row.ingestion_counts, warnings: row.ingestion_warnings, durationMs: row.ingestion_duration_ms },
      lastSyncedAt: row.last_synced_at?.toISOString() ?? null, syncState: row.source_access_status === "unavailable" ? "unavailable" : row.sync_conflict ? "conflict" : row.has_local_changes ? "local_changes" : "in_sync", localSavedAt: row.local_saved_at?.toISOString() ?? null, lastError: row.last_error, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
    })),
    themes: [...themes.values()].sort((a, b) => b.documents.size - a.documents.size || b.occurrences - a.occurrences).slice(0, 12).map((item) => ({ label: item.label, summary: item.summary, occurrences: item.occurrences, documentCount: item.documents.size })),
    recentThoughts: recentThoughts.sort((a, b) => b.importance - a.importance || b.createdAt.localeCompare(a.createdAt)).slice(0, 10),
  };
}

export async function searchNotionGarden(scope: OwnerScope, connectionId: string | null, search: string): Promise<NotionGardenSearchResponse> {
  const documents = (await listSourceDocuments(owner(scope), connectionId)).filter((item) => item.status === "ready").slice(0, 100);
  if (!documents.length) return { thoughts: [] };
  const sessions = documents.map((item) => item.memo_session_id);
  const tags = [`owner:${scope.ownerId}`, ...(documents[0]?.workspace_id ? [`workspace:${documents[0].workspace_id}`] : []), "source:notion"];
  const result = await retrieveMemoGrafterContext(sessions[0]!, search, { scope: "tagged", sessionIds: sessions, tags, tagMode: "all", candidateLimit: 80, limit: 30, episodeLimit: 6, tokenBudget: 2400, selection: { maxTopics: 15, relativeScoreFloor: 0.5, scoreGapThreshold: 0.35 } });
  const sources = documents.map((item) => ({ id: item.id, memoSessionId: item.memo_session_id, title: item.title, sourceUrl: item.source_url }));
  return { thoughts: selectTopRelatedThoughts(result, sources, "__garden__", 10) };
}

export async function chatWithNotionGarden(scope: OwnerScope, connectionId: string | null, question: string) {
  const { thoughts } = await searchNotionGarden(scope, connectionId, question);
  if (!thoughts.length) return { answer: "I couldn’t find a strong connection in this workspace yet. Import more pages or try a more specific question.", sources: [] };
  const evidence = thoughts.map((thought, index) => `[${index + 1}] ${thought.documentTitle}${thought.sectionTitle ? ` — ${thought.sectionTitle}` : ""}: ${thought.text}`).join("\n");
  const answer = await new MindBloomOpenAILLMAdapter(env.MEMO_GRAFTER_LLM_MODEL ?? "gpt-4o-mini").complete(
    [{ role: "user", content: question }],
    `You are Notion Bloom. Answer only from the supplied writing. Cite evidence using [1], [2], and so on. Separate what the user wrote from your interpretation and suggestion. If evidence is weak, say so.\n\nEVIDENCE:\n${evidence}`,
    { timeoutMs: 60_000 },
  );
  return { answer, sources: thoughts };
}

export async function recordNotionThoughtFeedback(scope: OwnerScope, documentId: string, memoryId: string, useful: boolean): Promise<void> {
  const document = await ownedDocument(documentId, scope);
  await saveThoughtFeedback({ ownerId: scope.ownerId, connectionId: document.connection_id, documentId, memoryId, useful });
}

export async function deliverNotionComment(scope: OwnerScope, documentId: string, content: string, memoryId: string | null): Promise<{ commentId: string; duplicate: boolean }> {
  const document = await ownedDocument(documentId, scope);
  if (!document.connection_id) throw new ApiError(409, "Connect this workspace with OAuth before sending comments to Notion");
  const normalized = content.trim();
  if (!normalized) throw new ApiError(400, "Comment content is required");
  const contentHash = createHash("sha256").update(normalized).digest("hex");
  const existing = await findCommentDelivery(documentId, contentHash);
  if (existing) return { commentId: existing, duplicate: true };
  let commentId: string;
  try { commentId = await withNotionClient(scope, document.connection_id, (client) => client.createPageComment(document.external_id, normalized)); }
  catch (error) {
    if (isNotionClientError(error) && error.code === APIErrorCode.RestrictedResource) {
      throw new ApiError(403, "Notion Bloom cannot comment on this page. Enable comment insertion for the connection and share the page with it.");
    }
    throw error;
  }
  await storeCommentDelivery({ ownerId: scope.ownerId, documentId, memoryId, contentHash, commentId });
  return { commentId, duplicate: false };
}
