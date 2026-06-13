import { Router } from "express";
import { z } from "zod";
import type {
  EntryDocumentResponse,
  EntryGraftRelevanceResponse,
  EntryGraftsResponse,
  EntryIngestResponse,
  EntryListResponse,
  EntryMessageResponse,
  EntryMessagesResponse,
  EntryReflectionResponse,
  EntryReflectionsResponse,
  EntryResponse,
  TopicPill,
} from "@mindbloom/shared";

import { ApiError } from "../http/errors.js";
import {
  getEntryForOwner,
  parseEntryId,
  readOwnerScope,
} from "../http/middleware/requireOwner.js";
import { getAgentForSession, invokeAgentWithStreaming } from "../memo-grafter/memoGrafter.js";
import { buildEntryReflectionCards } from "../memory/entryReflection.js";
import { entryStore } from "../services/entries.service.js";
import { normalizeGraphSnapshot } from "../memory/graphNormalizer.js";

const entryPurposeSchema = z.enum(["journal", "idea", "brainstorm"]);
const entryModeSchema = z.enum(["classic", "chat", "mixed"]);
const entryStatusSchema = z.enum(["draft", "completed"]);
const entryMessageRoleSchema = z.enum(["user", "assistant", "system"]);
const entryTagsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Tag cannot be empty")
      .max(32, "Tags must be 32 characters or fewer"),
  )
  .max(8, "Use 8 tags or fewer")
  .optional();

const createEntrySchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  tags: entryTagsSchema,
  purpose: entryPurposeSchema.optional(),
  mode: entryModeSchema.optional(),
  allowFutureContext: z.boolean().optional(),
});

const updateEntrySchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  tags: entryTagsSchema,
  purpose: entryPurposeSchema.optional(),
  mode: entryModeSchema.optional(),
  status: entryStatusSchema.optional(),
  allowFutureContext: z.boolean().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});

const upsertDocumentSchema = z.object({
  content: z.string().max(60000),
});

const ingestDocumentSchema = z.object({
  content: z.string().max(60000).optional(),
  force: z.boolean().optional(),
});

const snapshotScopeSchema = z
  .enum(["overall", "writing", "bloom"])
  .default("overall");

const createMessageSchema = z.object({
  role: entryMessageRoleSchema,
  content: z.string().trim().min(1, "content is required").max(8000),
});

const streamMessageSchema = z.object({
  content: z.string().trim().min(1, "content is required").max(8000),
  documentDraft: z.string().max(60000).optional(),
  selectedText: z.string().max(8000).optional(),
  entryTags: z.array(z.string().trim().min(1).max(32)).max(8).optional(),
  broughtInContext: z.array(z.string().trim().min(1).max(160)).max(12).optional(),
});

const graftByRelevanceSchema = z.object({
  query: z.string().trim().min(1, "query is required").max(500),
  sourceEntryIds: z.array(z.string().trim().min(1).max(128)).max(12).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  maxThemes: z.coerce.number().int().min(1).max(12).optional(),
  minSimilarity: z.coerce.number().min(0).max(1).optional(),
  expansionDepth: z.coerce.number().int().min(0).max(3).optional(),
  expansionStrategy: z.enum(["none", "graph"]).optional(),
});

const reflectionIdParamSchema = z.object({
  reflectionId: z.string().trim().min(1, "reflectionId is required").max(128),
});

export const entriesRouter = Router();

const minIngestTextLength = 12;

function toTopicPills(
  activeNodes: Array<{ id: string; label: string; topicOrder: number }>,
): TopicPill[] {
  return activeNodes.map((node) => ({
    id: node.id,
    label: node.label,
    topicOrder: node.topicOrder,
  }));
}

function isWithinDateRange(
  entry: { createdAt: string },
  dateFrom?: string,
  dateTo?: string,
): boolean {
  const date = entry.createdAt.split("T")[0] ?? "";
  return (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
}

async function getOwnedSourceEntries(
  owner: Awaited<ReturnType<typeof readOwnerScope>>,
  currentEntryId: string,
  sourceEntryIds?: string[],
  dateFrom?: string,
  dateTo?: string,
): Promise<Awaited<ReturnType<typeof getEntryForOwner>>[]> {
  if (sourceEntryIds && sourceEntryIds.length > 0) {
    const entries = await Promise.all(
      sourceEntryIds.map((sourceEntryId) => getEntryForOwner(sourceEntryId, owner)),
    );
    return entries.filter(
      (entry) =>
        entry.id !== currentEntryId && isWithinDateRange(entry, dateFrom, dateTo),
    );
  }

  const entries = await entryStore.listEntries(owner);
  return entries.filter(
    (entry) =>
      entry.id !== currentEntryId &&
      entry.allowFutureContext &&
      isWithinDateRange(entry, dateFrom, dateTo),
  );
}

function parseReflectionId(params: unknown): string {
  const parsed = reflectionIdParamSchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid route params",
    );
  }

  return parsed.data.reflectionId;
}

function writeStreamEvent(
  res: { write: (chunk: string) => boolean },
  event: string,
  data: unknown,
) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function buildBloomWritingContext(input: {
  content: string;
  documentDraft?: string;
  selectedText?: string;
  entryTags?: string[];
  broughtInContext?: string[];
}): string {
  const parts = [
    "Use this entry context as background. Do not ask the writer to paste it again.",
    `Entry tags: ${input.entryTags?.join(", ") || "none"}`,
    `Current writing:\n${input.documentDraft?.trim() || "No writing has been saved yet."}`,
  ];

  if (input.selectedText?.trim()) {
    parts.push(`Selected text:\n${input.selectedText.trim()}`);
  }

  if (input.broughtInContext && input.broughtInContext.length > 0) {
    parts.push(`Brought-in context:\n${input.broughtInContext.join("\n")}`);
  }

  parts.push(`Writer request:\n${input.content}`);

  return parts.join("\n\n");
}

entriesRouter.post("/", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const parsed = createEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    if (owner.ownerKind === "demo" && (await entryStore.listEntries(owner)).length >= 1) {
      throw new ApiError(403, "Demo mode supports one journal entry");
    }

    const entry = await entryStore.createEntry({
      ...owner,
      ...parsed.data,
    });
    const response: EntryResponse = { entry };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.get("/", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const response: EntryListResponse = {
      entries: await entryStore.listEntries(owner),
      groups: await entryStore.listEntriesGroupedByDay(owner),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.get("/:entryId", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = await getEntryForOwner(entryId, owner);
    const response: EntryResponse = { entry };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.patch("/:entryId", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const existing = await getEntryForOwner(entryId, owner);
    const parsed = updateEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    const completedAt =
      parsed.data.status === "completed" && parsed.data.completedAt === undefined
        ? new Date().toISOString()
        : parsed.data.completedAt;
    const entry = await entryStore.updateEntry(existing.id, {
      ...parsed.data,
      completedAt,
    });
    if (!entry) {
      throw new ApiError(404, "Entry not found");
    }

    const response: EntryResponse = { entry };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.delete("/:entryId", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = await getEntryForOwner(entryId, owner);
    await entryStore.deleteEntry(entry.id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

entriesRouter.put("/:entryId/document", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = await getEntryForOwner(entryId, owner);
    const parsed = upsertDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    const document = await entryStore.upsertDocument({
      entryId: entry.id,
      content: parsed.data.content,
    });
    const response: EntryDocumentResponse = { document };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.get("/:entryId/document", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = await getEntryForOwner(entryId, owner);
    const response: EntryDocumentResponse = {
      document: await entryStore.getDocument(entry.id) ?? null,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.post("/:entryId/ingest", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = await getEntryForOwner(entryId, owner);
    const parsed = ingestDocumentSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    const document =
      parsed.data.content === undefined
        ? await entryStore.getDocument(entry.id)
        : await entryStore.upsertDocument({
            entryId: entry.id,
            content: parsed.data.content,
          });

    if (!document) {
      const response: EntryIngestResponse = {
        document: null,
        ingested: false,
        skippedReason: "no-document",
        topicPills: [],
      };
      res.json(response);
      return;
    }

    if (document.content.trim().length < minIngestTextLength) {
      const shouldClear =
        parsed.data.force || document.lastIngestedVersion !== document.version;
      if (shouldClear) {
        const agent = await getAgentForSession(entry.memoSessionId);
        await (
          agent as unknown as {
            clearSession?: () => Promise<void>;
          }
        ).clearSession?.();
      }
      const clearedDocument = shouldClear
        ? await entryStore.markDocumentIngested(entry.id, document.version)
        : document;
      const response: EntryIngestResponse = {
        document: clearedDocument ?? document,
        ingested: false,
        cleared: shouldClear,
        skippedReason: "empty-document",
        topicPills: [],
      };
      res.json(response);
      return;
    }

    if (
      !parsed.data.force &&
      document.lastIngestedVersion === document.version
    ) {
      const agent = await getAgentForSession(entry.memoSessionId);
      const response: EntryIngestResponse = {
        document,
        ingested: false,
        skippedReason: "unchanged-document",
        topicPills: toTopicPills(await agent.getActiveNodes()),
      };
      res.json(response);
      return;
    }

    const agent = await getAgentForSession(entry.memoSessionId);
    await agent.ingestText(document.content, {
      label: entry.title,
      source: `entry:${entry.id}`,
      replace: true,
    });
    const ingestedDocument = await entryStore.markDocumentIngested(
      entry.id,
      document.version,
    );
    const response: EntryIngestResponse = {
      document: ingestedDocument ?? document,
      ingested: true,
      topicPills: toTopicPills(await agent.getActiveNodes()),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.get("/:entryId/grafts", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = await getEntryForOwner(entryId, owner);
    const response: EntryGraftsResponse = {
      grafts: await entryStore.listGrafts(entry.id),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.get("/:entryId/snapshot", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = await getEntryForOwner(entryId, owner);
    const parsedScope = snapshotScopeSchema.safeParse(req.query.scope);
    if (!parsedScope.success) {
      throw new ApiError(400, "Invalid snapshot scope");
    }
    const agent = await getAgentForSession(entry.memoSessionId);
    const snapshot = await agent.getGraphSnapshot();
    const normalizedSnapshot = normalizeGraphSnapshot(snapshot);
    const currentSessionIds = new Set([
      entry.memoSessionId,
      normalizedSnapshot.sessionId,
    ]);
    const entryMemoryIds = new Set(
      normalizedSnapshot.memories
        .filter((memory) => currentSessionIds.has(memory.sessionId))
        .map((memory) => memory.id),
    );
    const entryMemoryTopicNodeIds = new Set(
      normalizedSnapshot.memories
        .filter((memory) => entryMemoryIds.has(memory.id))
        .map((memory) => memory.topicNodeId),
    );
    const entryNodeIds = new Set(
      normalizedSnapshot.nodes
        .filter(
          (node) =>
            currentSessionIds.has(node.sessionId) ||
            node.graftOrigin?.sourceSessionId === entry.memoSessionId ||
            entryMemoryTopicNodeIds.has(node.id),
        )
        .map((node) => node.id),
    );
    if (
      entryNodeIds.size === 0 &&
      normalizedSnapshot.nodes.length > 0 &&
      normalizedSnapshot.nodes.every((node) => !node.sessionId)
    ) {
      for (const node of normalizedSnapshot.nodes) {
        entryNodeIds.add(node.id);
      }
    }
    const entrySnapshot = {
      ...normalizedSnapshot,
      sessionId: entry.memoSessionId,
      nodes: normalizedSnapshot.nodes.filter((node) => entryNodeIds.has(node.id)),
      edges: normalizedSnapshot.edges.filter(
        (edge) =>
          entryNodeIds.has(edge.sourceId) && entryNodeIds.has(edge.targetId),
      ),
      memories: normalizedSnapshot.memories.filter((memory) =>
        entryMemoryIds.has(memory.id),
      ),
      memoryEdges: normalizedSnapshot.memoryEdges.filter(
        (edge) =>
          entryMemoryIds.has(edge.sourceId) && entryMemoryIds.has(edge.targetId),
      ),
    };

    if (parsedScope.data === "overall") {
      res.json(entrySnapshot);
      return;
    }

    const allowedSources =
      parsedScope.data === "writing"
        ? new Set(["document", "note"])
        : new Set(["conversation"]);
    const memories = entrySnapshot.memories.filter((memory) =>
      allowedSources.has(memory.sourceType),
    );
    const nodeIds = new Set(memories.map((memory) => memory.topicNodeId));
    const nodes = entrySnapshot.nodes.filter((node) => nodeIds.has(node.id));
    const edges = entrySnapshot.edges.filter(
      (edge) => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId),
    );
    const memoryIds = new Set(memories.map((memory) => memory.id));
    const memoryEdges = entrySnapshot.memoryEdges.filter(
      (edge) => memoryIds.has(edge.sourceId) && memoryIds.has(edge.targetId),
    );

    res.json({
      ...entrySnapshot,
      nodes,
      edges,
      memories,
      memoryEdges,
    });
  } catch (error) {
    next(error);
  }
});

entriesRouter.post("/:entryId/grafts/relevance", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = await getEntryForOwner(entryId, owner);
    const parsed = graftByRelevanceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    const sourceEntries = await getOwnedSourceEntries(
      owner,
      entry.id,
      parsed.data.sourceEntryIds,
      parsed.data.dateFrom,
      parsed.data.dateTo,
    );
    const currentAgent = await getAgentForSession(entry.memoSessionId);
    const storedGrafts = [];
    let tokenCount = 0;

    for (const sourceEntry of sourceEntries) {
      const sourceAgent = await getAgentForSession(sourceEntry.memoSessionId);
      const relevanceResult = await sourceAgent.graftByRelevance(
        parsed.data.query,
        {
          topK: parsed.data.maxThemes,
          minSimilarity: parsed.data.minSimilarity,
          hopDepth: parsed.data.expansionDepth,
          expansionStrategy: parsed.data.expansionStrategy,
        },
      );
      tokenCount += relevanceResult.tokenCount;

      if (relevanceResult.nodes.length === 0) {
        continue;
      }

      await currentAgent.ingestGraftedNodes(relevanceResult.nodes);

      for (const node of relevanceResult.nodes) {
        storedGrafts.push(
          await entryStore.createGraft({
            entryId: entry.id,
            query: parsed.data.query,
            sourceEntryId: sourceEntry.id,
            sourceEntryTitle: sourceEntry.title,
            sourceEntryCreatedAt: sourceEntry.createdAt,
            sourceSessionId: sourceEntry.memoSessionId,
            sourceThemeId: node.id,
            themeLabel: node.label,
            similarity: null,
          }),
        );
      }
    }

    const response: EntryGraftRelevanceResponse = {
      grafts: storedGrafts,
      topicPills: toTopicPills(await currentAgent.getActiveNodes()),
      tokenCount,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.get("/:entryId/reflections", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = await getEntryForOwner(entryId, owner);
    const response: EntryReflectionsResponse = {
      reflections: await entryStore.listReflections(entry.id),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.post("/:entryId/reflections", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = await getEntryForOwner(entryId, owner);
    const agent = await getAgentForSession(entry.memoSessionId);
    const [snapshot, activeNodes] = await Promise.all([
      agent.getGraphSnapshot(),
      agent.getActiveNodes(),
    ]);
    const graphSnapshot = normalizeGraphSnapshot(snapshot);
    const cards = await buildEntryReflectionCards({
      entry,
      documentText: (await entryStore.getDocument(entry.id))?.content ?? "",
      messages: await entryStore.listMessages(entry.id),
      notes: await entryStore.listNotesForEntry(entry.id, owner),
      topicPills: toTopicPills(activeNodes),
      graphSnapshot,
    });
    const reflection = await entryStore.createReflection({
      entryId: entry.id,
      cards,
      graphSnapshot,
    });
    const response: EntryReflectionResponse = { reflection };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.get("/:entryId/reflections/:reflectionId", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = await getEntryForOwner(entryId, owner);
    const reflectionId = parseReflectionId(req.params);
    const reflection = await entryStore.getReflection(reflectionId);
    if (!reflection) {
      throw new ApiError(404, "Reflection not found");
    }
    if (reflection.entryId !== entry.id) {
      throw new ApiError(403, "Reflection does not belong to this entry");
    }
    const response: EntryReflectionResponse = { reflection };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.post("/:entryId/messages/stream", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = await getEntryForOwner(entryId, owner);
    const parsed = streamMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    let isConnected = true;
    res.on("close", () => {
      isConnected = false;
    });

    const userMessage = await entryStore.addMessage({
      entryId: entry.id,
      role: "user",
      content: parsed.data.content,
    });
    writeStreamEvent(res, "user-message", { message: userMessage });

    try {
      const agent = await getAgentForSession(entry.memoSessionId);
      const reply = await invokeAgentWithStreaming(
        agent,
        buildBloomWritingContext({
          content: parsed.data.content,
          documentDraft: parsed.data.documentDraft,
          selectedText: parsed.data.selectedText,
          entryTags: parsed.data.entryTags ?? entry.tags,
          broughtInContext: parsed.data.broughtInContext,
        }),
        (chunk) => {
          if (isConnected) {
            writeStreamEvent(res, "token", { chunk });
          }
        },
      );
      if (res.destroyed) {
        return;
      }

      const assistantMessage = await entryStore.addMessage({
        entryId: entry.id,
        role: "assistant",
        content: reply,
      });
      const topicPills = toTopicPills(await agent.getActiveNodes());

      if (isConnected) {
        writeStreamEvent(res, "done", {
          message: assistantMessage,
          topicPills,
        });
      }
    } catch (streamError) {
      if (!res.destroyed) {
        writeStreamEvent(res, "error", {
          message:
            streamError instanceof ApiError
              ? streamError.message
              : "Bloom could not respond right now.",
        });
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  } catch (error) {
    next(error);
  }
});

entriesRouter.get("/:entryId/messages", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = await getEntryForOwner(entryId, owner);
    const response: EntryMessagesResponse = {
      messages: await entryStore.listMessages(entry.id),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.post("/:entryId/messages", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = await getEntryForOwner(entryId, owner);
    const parsed = createMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    const message = await entryStore.addMessage({
      entryId: entry.id,
      ...parsed.data,
    });
    const response: EntryMessageResponse = { message };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});
