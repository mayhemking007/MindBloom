import { createHash, randomUUID } from "node:crypto";
import { NotionIntegration, NotionMarkdownWriteUnsupportedError, NotionPageWriteError, type NotionDocument as ExternalNotionDocument } from "@mindbloom/integrations";
import type { GraphSnapshotResponse, MindBloomDocument, NotionBloomMessage, RelatedThought } from "@mindbloom/shared";
import { APIErrorCode, isNotionClientError } from "@notionhq/client";
import { isMemoGrafterError } from "memo-grafter";
import type { OwnerScope } from "./entries.service.js";
import { env } from "../config/env.js";
import { ApiError } from "../http/errors.js";
import { normalizeGraphSnapshot } from "../memory/graphNormalizer.js";
import { MindBloomOpenAILLMAdapter } from "../memo-grafter/openAiAdapters.js";
import { getMemoGrafterCore, getMemoGrafterForSession, retrieveMemoGrafterContext } from "../memo-grafter/memoGrafter.js";
import {
  createSourceDocumentMessage, deleteSourceDocument, findSourceDocument,
  findSourceDocumentByExternalId, findSourceDocumentSection, listSourceDocumentMessages, listSourceDocuments,
  replaceSourceDocumentSections, updateSourceDocumentIngestion,
  upsertSourceDocument, type SourceDocumentUpsert, type SourceOwner,
} from "../repositories/sourceDocuments.repository.js";
import type { SourceDocumentMessageRow, SourceDocumentRow } from "../db/schema.js";
import {
  isSuccessfulIngestion, markdownToDocumentSections, NOTION_INGESTION_TIMEOUT_MS, notionIngestionOptionsFor,
  receiptCounts, receiptWarnings, toMemoGrafterDocument,
} from "./notionIngestion.js";
import { selectTopRelatedThoughts } from "./notionThoughts.js";

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
    syncState: row.has_local_changes ? "local_changes" : "in_sync",
    localSavedAt: row.local_saved_at?.toISOString() ?? null,
    lastError: row.last_error, ingestion: {
      runId: row.memo_ingestion_run_id,
      status: row.ingestion_status,
      phase: row.ingestion_phase,
      counts: row.ingestion_counts,
      warnings: row.ingestion_warnings,
      durationMs: row.ingestion_duration_ms,
    }, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}

function notionApiError(error: unknown, stage?: "insert" | "update" | "partial"): ApiError | null {
  const cause = error instanceof NotionPageWriteError ? error.cause : error;
  if (!isNotionClientError(cause)) return null;
  if (cause.code === APIErrorCode.RestrictedResource) {
    if (stage === "insert") return new ApiError(403, "MindBloom cannot insert content into this Notion page. Enable the connection's Insert content capability and make sure the page is shared with the connection.");
    if (stage === "update") return new ApiError(403, "MindBloom cannot replace the existing Notion blocks. Enable the connection's Update content capability and make sure the page is shared with the connection.");
    if (stage === "partial") return new ApiError(403, "Notion accepted the new content but would not remove the old blocks. Enable Update content, then review the page in Notion before trying again.");
    return new ApiError(403, "MindBloom does not have access to this Notion resource. Check the connection capabilities and share the page with the connection.");
  }
  if (cause.code === APIErrorCode.Unauthorized) return new ApiError(401, "The Notion connection token is invalid or expired. Reconnect Notion and try again.");
  if (cause.code === APIErrorCode.ObjectNotFound) return new ApiError(404, "This Notion page was deleted or is no longer shared with the MindBloom connection.");
  if (cause.code === APIErrorCode.ConflictError) return new ApiError(409, "Notion reported a conflicting edit. Sync the page and try again.");
  if (cause.code === APIErrorCode.RateLimited) return new ApiError(429, "Notion is rate limiting this connection. Wait a moment and try again.");
  return null;
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

export async function updateNotionDocumentContent(id: string, content: string, expectedSourceUpdatedAt: string, owner: OwnerScope) {
  const row = await getOwned(id, owner);
  if (row.status === "pending") throw new ApiError(409, "Wait for the current Notion import to finish before editing");
  const notion = requireNotion();
  const current = await notion.retrievePageSummary(row.external_id);
  const expectedTime = new Date(expectedSourceUpdatedAt).getTime();
  const storedTime = row.source_updated_at.getTime();
  const currentTime = new Date(current.updatedAt).getTime();
  if (expectedTime !== storedTime || currentTime !== storedTime) {
    throw new ApiError(409, "This page changed in Notion after your last sync. Sync the latest version before saving your edit.");
  }
  try {
    await notion.updatePageContent(row.external_id, content);
  } catch (error) {
    if (error instanceof NotionMarkdownWriteUnsupportedError) {
      throw new ApiError(409, `${error.message}. Edit this page in Notion, then sync it back to MindBloom.`);
    }
    const mapped = notionApiError(error, error instanceof NotionPageWriteError ? error.stage : undefined);
    if (mapped) throw mapped;
    throw error;
  }
  const updatedPage = await notion.retrievePage(row.external_id);
  try {
    return (await persistPage(updatedPage, owner, true)).document;
  } catch {
    throw new ApiError(502, "The edit was saved to Notion, but MindBloom could not refresh its thought graph. Retry the ingestion from the Notion garden.");
  }
}

export async function saveMindBloomDocumentContent(id: string, content: string, owner: OwnerScope) {
  const row = await getOwned(id, owner);
  if (row.status === "pending") throw new ApiError(409, "Wait for the current ingestion to finish before editing");
  const page: ExternalNotionDocument = {
    id: row.external_id,
    title: row.title,
    url: row.source_url,
    createdAt: row.source_created_at.toISOString(),
    updatedAt: row.source_updated_at.toISOString(),
    content,
    sections: markdownToDocumentSections(content),
  };
  const contentHash = hash(`${row.title}\n${content}`);
  const base = {
    ...row,
    content,
    content_hash: contentHash,
    has_local_changes: contentHash !== row.source_content_hash,
    local_saved_at: contentHash !== row.source_content_hash ? new Date() : null,
    status: "pending" as const,
    memo_ingestion_run_id: null,
    ingestion_status: "accepted" as const,
    ingestion_phase: "accepted" as const,
    ingestion_counts: {}, ingestion_warnings: [], ingestion_duration_ms: null,
    last_error: null,
  };
  return (await ingestPage(page, owner, base, `local:${row.external_id}:${contentHash}:${Date.now()}`)).document;
}

async function persistPage(page: ExternalNotionDocument, owner: OwnerScope, force = false) {
  const existing = await findSourceDocumentByExternalId(page.id, ownerOf(owner));
  const contentHash = hash(`${page.title}\n${page.content}`);
  if (!force && existing?.source_content_hash === contentHash && !existing.has_local_changes && existing.status === "ready") return { document: toDocument(existing), unchanged: true };
  const id = existing?.id ?? randomUUID();
  const memoSessionId = existing?.memo_session_id ?? sessionId(owner, page.id);
  const base = { id, owner_id: owner.ownerId, owner_kind: owner.ownerKind, source: "notion" as const,
    external_id: page.id, title: page.title, content: page.content, content_hash: contentHash,
    source_content_hash: contentHash, has_local_changes: false, local_saved_at: null,
    source_url: page.url, source_created_at: new Date(page.createdAt), source_updated_at: new Date(page.updatedAt),
    memo_session_id: memoSessionId, status: "pending" as const,
    memo_ingestion_run_id: null, ingestion_status: "accepted" as const, ingestion_phase: "accepted" as const,
    ingestion_counts: {}, ingestion_warnings: [], ingestion_duration_ms: null,
    last_synced_at: null, last_error: null };
  return ingestPage(page, owner, base, `notion:${page.id}:${contentHash}${force ? `:retry:${Date.now()}` : ""}`);
}

async function ingestPage(page: ExternalNotionDocument, owner: OwnerScope, base: SourceDocumentUpsert, idempotencyKey: string) {
  const { id, memo_session_id: memoSessionId } = base;
  await upsertSourceDocument(base);
  await replaceSourceDocumentSections(id, page.sections);
  try {
    const core = await getMemoGrafterCore();
    const receipt = await core.ingestDocumentDetailed(toMemoGrafterDocument(page), memoSessionId, {
      ...notionIngestionOptionsFor(page), label: page.title, source: `notion:${page.id}`,
      tags: [`owner:${owner.ownerId}`, "source:notion", `document:${id}`],
      idempotencyKey,
    }, { timeoutMs: NOTION_INGESTION_TIMEOUT_MS });
    const successful = isSuccessfulIngestion(receipt.status);
    const terminalFailure = receipt.status === "failed" || receipt.status === "cancelled" || receipt.status === "abandoned";
    const updated = await updateSourceDocumentIngestion(id, {
      status: successful ? "ready" : terminalFailure ? "failed" : "pending",
      memo_ingestion_run_id: receipt.ingestionRunId,
      ingestion_status: receipt.status,
      ingestion_phase: receipt.phase ?? null,
      ingestion_counts: receiptCounts(receipt),
      ingestion_warnings: receiptWarnings(receipt),
      ingestion_duration_ms: receipt.durationMs ?? null,
      last_synced_at: successful ? (base.has_local_changes ? base.last_synced_at : new Date()) : base.last_synced_at,
      last_error: terminalFailure ? `MemoGrafter ingestion ${receipt.status}` : null,
    });
    return { document: toDocument(updated), unchanged: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "MemoGrafter ingestion failed";
    const context = isMemoGrafterError(error) ? error.context : undefined;
    const runId = context && "jobId" in context && typeof context.jobId === "string" ? context.jobId : null;
    const run = runId ? await (await getMemoGrafterCore()).getIngestionRun(runId) : null;
    await updateSourceDocumentIngestion(id, {
      status: "failed",
      memo_ingestion_run_id: runId,
      ingestion_status: run?.status ?? "failed",
      ingestion_phase: run?.result?.phase ?? null,
      ingestion_counts: run?.result ? receiptCounts(run.result) : {},
      ingestion_warnings: run?.result ? receiptWarnings(run.result) : [],
      ingestion_duration_ms: run?.result?.durationMs ?? null,
      last_synced_at: base.last_synced_at,
      last_error: message,
    });
    throw error;
  }
}

export async function importNotionPages(pageIds: string[], owner: OwnerScope) {
  const notion = requireNotion();
  const results = [];
  for (const pageId of pageIds) {
    try {
      const result = await persistPage(await notion.retrievePage(pageId), owner);
      const status = result.unchanged ? "unchanged" as const
        : result.document.status === "failed" ? "failed" as const
        : result.document.status === "pending" ? "processing" as const
        : "imported" as const;
      results.push({ pageId, document: result.document, status, ...(status === "failed" ? { error: result.document.lastError ?? "Import failed" } : {}) });
    } catch (error) {
      results.push({ pageId, document: null, status: "failed" as const, error: error instanceof Error ? error.message : "Import failed" });
    }
  }
  return results;
}

export async function syncNotionDocument(id: string, owner: OwnerScope, discardLocalChanges = false) {
  const row = await getOwned(id, owner);
  if (row.has_local_changes && !discardLocalChanges) {
    throw new ApiError(409, "This page has changes saved only in MindBloom. Confirm that you want to discard them before syncing from Notion.");
  }
  try {
    return (await persistPage(await requireNotion().retrievePage(row.external_id), owner, discardLocalChanges)).document;
  } catch (error) {
    const mapped = notionApiError(error);
    if (mapped) throw mapped;
    throw error;
  }
}

export async function retryNotionDocument(id: string, owner: OwnerScope) {
  const row = await getOwned(id, owner);
  if (row.has_local_changes) return saveMindBloomDocumentContent(id, row.content, owner);
  return (await persistPage(await requireNotion().retrievePage(row.external_id), owner, true)).document;
}

export async function getNotionIngestionStatus(id: string, owner: OwnerScope) {
  let row = await getOwned(id, owner);
  if (!row.memo_ingestion_run_id) return toDocument(row);
  const run = await (await getMemoGrafterCore()).getIngestionRun(row.memo_ingestion_run_id);
  if (!run || run.status === row.ingestion_status) return toDocument(row);
  const receipt = run.result;
  const successful = run.status === "completed" || run.status === "completed_with_warnings";
  const terminalFailure = run.status === "failed" || run.status === "cancelled" || run.status === "abandoned";
  row = await updateSourceDocumentIngestion(id, {
    status: successful ? "ready" : terminalFailure ? "failed" : "pending",
    memo_ingestion_run_id: run.id,
    ingestion_status: run.status,
    ingestion_phase: receipt?.phase ?? row.ingestion_phase,
    ingestion_counts: receipt ? receiptCounts(receipt) : row.ingestion_counts,
    ingestion_warnings: receipt ? receiptWarnings(receipt) : row.ingestion_warnings,
    ingestion_duration_ms: receipt?.durationMs ?? row.ingestion_duration_ms,
    last_synced_at: successful ? run.completedAt ?? new Date() : row.last_synced_at,
    last_error: terminalFailure ? run.lastErrorSafeMessage ?? `MemoGrafter ingestion ${run.status}` : null,
  });
  return toDocument(row);
}

export async function cancelNotionIngestion(id: string, owner: OwnerScope) {
  const row = await getOwned(id, owner);
  if (!row.memo_ingestion_run_id) throw new ApiError(409, "This import does not have a cancellable ingestion run yet");
  await (await getMemoGrafterCore()).cancelIngestionRun(row.memo_ingestion_run_id);
  return getNotionIngestionStatus(id, owner);
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
    scope: "tagged", tags: [`owner:${owner.ownerId}`, "source:notion"], tagMode: "all", limit: 24,
    episodeLimit: 4, tokenBudget: 1800, selection: { maxTopics: 12 },
  });
  return selectTopRelatedThoughts(result, documents.map((document) => ({
    id: document.id,
    memoSessionId: document.memo_session_id,
    title: document.title,
    sourceUrl: document.source_url,
  })), id);
}

export async function notionBloom(id: string, question: string | undefined, thoughtId: string | undefined, owner: OwnerScope) {
  const document = await getOwned(id, owner);
  const historyRows = await listSourceDocumentMessages(id);
  const sources = await relatedThoughts(id, owner);
  const selectedThought = thoughtId ? sources.find((source) => source.id === thoughtId) : undefined;
  if (thoughtId && !selectedThought) throw new ApiError(404, "That related thought is no longer available for this page");
  const userQuestion = selectedThought
    ? `Help me revisit this earlier thought: “${selectedThought.text}”\n\nExplain where I used it, what it meant in that context, and how I could use that context in “${document.title}”.`
    : question?.trim();
  if (!userQuestion) throw new ApiError(400, "Ask Bloom a question or select a related thought");
  await createSourceDocumentMessage(id, "user", userQuestion);
  const history = historyRows.slice(-8).map((message) => ({ role: message.role, content: message.content }));
  const context = sources.map((source, index) => `[${index + 1}] ${source.theme} — ${source.text} (from ${source.documentTitle}${source.sectionTitle ? `, section “${source.sectionTitle}”` : ""})`).join("\n");
  let selectedContext = "";
  if (selectedThought) {
    const sourceDocument = await getOwned(selectedThought.documentId, owner);
    const sourceSection = selectedThought.sectionId
      ? await findSourceDocumentSection(sourceDocument.id, selectedThought.sectionId)
      : null;
    selectedContext = `\n\nSELECTED EARLIER THOUGHT:\n${selectedThought.text}\nTheme: ${selectedThought.theme}\nSource page: ${sourceDocument.title}${selectedThought.sectionTitle ? `\nSource section: ${selectedThought.sectionTitle}` : ""}\nOriginal context:\n${(sourceSection?.content ?? sourceDocument.content).slice(0, 6000)}\n\nWhen answering, explicitly cover: (1) where the thought appeared, (2) what it was doing in its original context, and (3) a concrete way to apply or challenge it in the current page. Do not claim details that are absent from the supplied writing.`;
  }
  const llm = new MindBloomOpenAILLMAdapter(env.MEMO_GRAFTER_LLM_MODEL ?? "gpt-4o-mini");
  const answer = await llm.complete([...history, { role: "user", content: userQuestion }],
    `You are MindBloom inside a Notion writing workspace. Help the user think with their current page and their prior writing. Be concise, reflective, and concrete. Mention source titles when using historical context.\n\nCURRENT PAGE: ${document.title}\n${document.content.slice(0, 12000)}\n\nRELATED PRIOR THOUGHTS:\n${context || "No related thoughts were found."}${selectedContext}`,
    { timeoutMs: 60_000 });
  await createSourceDocumentMessage(id, "assistant", answer);
  return { answer, messages: (await listSourceDocumentMessages(id)).map(toMessage), sources };
}

export async function notionDocumentGraph(id: string, owner: OwnerScope): Promise<GraphSnapshotResponse> {
  const document = await getOwned(id, owner);
  return normalizeGraphSnapshot(await (await getMemoGrafterForSession(document.memo_session_id)).getGraphSnapshot());
}
