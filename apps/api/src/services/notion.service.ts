import { createHash, randomUUID } from "node:crypto";
import { NotionIntegration, type NotionDocument as ExternalNotionDocument } from "@mindbloom/integrations";
import type { GraphSnapshotResponse, MindBloomDocument, NotionBloomMessage, RelatedThought } from "@mindbloom/shared";
import type { OwnerScope } from "./entries.service.js";
import { env } from "../config/env.js";
import { ApiError } from "../http/errors.js";
import { normalizeGraphSnapshot } from "../memory/graphNormalizer.js";
import { MindBloomOpenAILLMAdapter } from "../memo-grafter/openAiAdapters.js";
import { getMemoGrafterCore, getMemoGrafterForSession, retrieveMemoGrafterContext } from "../memo-grafter/memoGrafter.js";
import {
  createSourceDocumentMessage, deleteSourceDocument, findSourceDocument,
  findSourceDocumentByExternalId, listSourceDocumentMessages, listSourceDocuments,
  markSourceDocumentFailed, upsertSourceDocument, type SourceOwner,
} from "../repositories/sourceDocuments.repository.js";
import type { SourceDocumentMessageRow, SourceDocumentRow } from "../db/schema.js";

function ownerOf(owner: OwnerScope): SourceOwner { return owner; }
function requireNotion(): NotionIntegration {
  if (!env.NOTION_TOKEN) throw new ApiError(503, "NOTION_TOKEN is not configured");
  return new NotionIntegration(env.NOTION_TOKEN);
}
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function sessionId(owner: OwnerScope, externalId: string) { return `mindbloom-notion-${hash(`${owner.ownerKind}:${owner.ownerId}:${externalId}`).slice(0, 32)}`; }
function toDocument(row: SourceDocumentRow): MindBloomDocument {
  return { id: row.id, source: row.source, externalId: row.external_id, title: row.title,
    content: row.content, sourceUrl: row.source_url, sourceCreatedAt: row.source_created_at.toISOString(),
    sourceUpdatedAt: row.source_updated_at.toISOString(), memoSessionId: row.memo_session_id,
    status: row.status, lastSyncedAt: row.last_synced_at?.toISOString() ?? null,
    lastError: row.last_error, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}
function toMessage(row: SourceDocumentMessageRow): NotionBloomMessage {
  return { id: row.id, role: row.role, content: row.content, createdAt: row.created_at.toISOString() };
}
async function getOwned(id: string, owner: OwnerScope): Promise<SourceDocumentRow> {
  const row = await findSourceDocument(id, ownerOf(owner));
  if (!row) throw new ApiError(404, "Imported Notion page not found");
  return row;
}

export async function listNotionPages(owner: OwnerScope) {
  const [pages, imported] = await Promise.all([requireNotion().listAccessiblePages(), listSourceDocuments(ownerOf(owner))]);
  const byExternal = new Map(imported.map((item) => [item.external_id, item.id]));
  return pages.map((page) => ({ ...page, importedDocumentId: byExternal.get(page.id) ?? null }));
}
export async function listNotionDocuments(owner: OwnerScope) { return (await listSourceDocuments(ownerOf(owner))).map(toDocument); }
export async function getNotionDocument(id: string, owner: OwnerScope) { return toDocument(await getOwned(id, owner)); }

async function persistPage(page: ExternalNotionDocument, owner: OwnerScope) {
  const existing = await findSourceDocumentByExternalId(page.id, ownerOf(owner));
  const contentHash = hash(`${page.title}\n${page.content}`);
  if (existing?.content_hash === contentHash && existing.status === "ready") return { document: toDocument(existing), unchanged: true };
  const id = existing?.id ?? randomUUID();
  const memoSessionId = existing?.memo_session_id ?? sessionId(owner, page.id);
  const base = { id, owner_id: owner.ownerId, owner_kind: owner.ownerKind, source: "notion" as const,
    external_id: page.id, title: page.title, content: page.content, content_hash: contentHash,
    source_url: page.url, source_created_at: new Date(page.createdAt), source_updated_at: new Date(page.updatedAt),
    memo_session_id: memoSessionId, status: "pending" as const, last_synced_at: null, last_error: null };
  await upsertSourceDocument(base);
  try {
    const core = await getMemoGrafterCore();
    await core.ingestText(page.content || page.title, memoSessionId, {
      replace: true, label: page.title, source: `notion:${page.id}`, sourceReliability: 0.85,
      tags: [`owner:${owner.ownerId}`, "source:notion", `document:${id}`],
    });
    const ready = await upsertSourceDocument({ ...base, status: "ready", last_synced_at: new Date() });
    return { document: toDocument(ready), unchanged: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "MemoGrafter ingestion failed";
    await markSourceDocumentFailed(id, message);
    throw error;
  }
}

export async function importNotionPages(pageIds: string[], owner: OwnerScope) {
  const notion = requireNotion();
  const results = [];
  for (let index = 0; index < pageIds.length; index += 3) {
    const batch = pageIds.slice(index, index + 3);
    results.push(...await Promise.all(batch.map(async (pageId) => {
      try {
        const result = await persistPage(await notion.retrievePage(pageId), owner);
        return { pageId, document: result.document, status: result.unchanged ? "unchanged" as const : "imported" as const };
      } catch (error) {
        return { pageId, document: null, status: "failed" as const, error: error instanceof Error ? error.message : "Import failed" };
      }
    })));
  }
  return results;
}

export async function syncNotionDocument(id: string, owner: OwnerScope) {
  const row = await getOwned(id, owner);
  return (await persistPage(await requireNotion().retrievePage(row.external_id), owner)).document;
}

export async function removeNotionDocument(id: string, owner: OwnerScope) {
  const row = await getOwned(id, owner);
  await (await getMemoGrafterForSession(row.memo_session_id)).clearSession();
  await deleteSourceDocument(id, ownerOf(owner));
}

export async function relatedThoughts(id: string, owner: OwnerScope): Promise<RelatedThought[]> {
  const current = await getOwned(id, owner);
  const documents = await listSourceDocuments(ownerOf(owner));
  if (documents.length < 2) return [];
  const result = await retrieveMemoGrafterContext(current.memo_session_id, `${current.title}\n${current.content.slice(0, 4000)}`, {
    scope: "tagged", tags: [`owner:${owner.ownerId}`, "source:notion"], tagMode: "all", limit: 18,
    episodeLimit: 4, tokenBudget: 1800, selection: { maxTopics: 12 },
  });
  const documentBySession = new Map(documents.filter((doc) => doc.id !== id).map((doc) => [doc.memo_session_id, doc]));
  const grouped = new Map<string, RelatedThought>();
  for (const fact of result.facts) {
    const document = documentBySession.get(fact.sessionId);
    if (!document) continue;
    const previous = grouped.get(document.id);
    const theme = result.nodes.find((node) => node.id === fact.topicNodeId)?.label;
    const thought = previous ?? { documentId: document.id, title: document.title, sourceUrl: document.source_url,
      excerpt: fact.value, themes: [], relevance: fact.similarity };
    if (theme && !thought.themes.includes(theme)) thought.themes.push(theme);
    if ((fact.similarity ?? 0) > (thought.relevance ?? 0)) { thought.relevance = fact.similarity; thought.excerpt = fact.value; }
    grouped.set(document.id, thought);
  }
  return [...grouped.values()].sort((a,b) => (b.relevance ?? 0) - (a.relevance ?? 0)).slice(0, 5);
}

export async function notionBloom(id: string, question: string, owner: OwnerScope) {
  const document = await getOwned(id, owner);
  const historyRows = await listSourceDocumentMessages(id);
  await createSourceDocumentMessage(id, "user", question);
  const sources = await relatedThoughts(id, owner);
  const history = historyRows.slice(-8).map((message) => ({ role: message.role, content: message.content }));
  const context = sources.map((source, index) => `[${index + 1}] ${source.title}: ${source.excerpt}`).join("\n");
  const llm = new MindBloomOpenAILLMAdapter(env.MEMO_GRAFTER_LLM_MODEL ?? "gpt-4o-mini");
  const answer = await llm.complete([...history, { role: "user", content: question }],
    `You are MindBloom inside a Notion writing workspace. Help the user think with their current page and their prior writing. Be concise, reflective, and concrete. Mention source titles when using historical context.\n\nCURRENT PAGE: ${document.title}\n${document.content.slice(0, 12000)}\n\nRELATED PRIOR WRITING:\n${context || "No related pages were found."}`,
    { timeoutMs: 60_000 });
  await createSourceDocumentMessage(id, "assistant", answer);
  return { answer, messages: (await listSourceDocumentMessages(id)).map(toMessage), sources };
}

export async function notionDocumentGraph(id: string, owner: OwnerScope): Promise<GraphSnapshotResponse> {
  const document = await getOwned(id, owner);
  return normalizeGraphSnapshot(await (await getMemoGrafterForSession(document.memo_session_id)).getGraphSnapshot());
}
