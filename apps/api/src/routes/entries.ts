import { Router } from "express";
import { z } from "zod";
import type {
  EntryDocumentResponse,
  EntryIngestResponse,
  EntryListResponse,
  EntryMessageResponse,
  EntryMessagesResponse,
  EntryResponse,
  TopicPill,
} from "@mindbloom/shared";

import { ApiError } from "../http/errors.js";
import {
  getEntryForOwner,
  parseEntryId,
  readOwnerScope,
} from "../http/ownerScope.js";
import { getAgentForSession } from "../lib/agent.js";
import { entryStore } from "../lib/entryStore.js";

const entryPurposeSchema = z.enum(["journal", "idea", "brainstorm"]);
const entryModeSchema = z.enum(["classic", "chat", "mixed"]);
const entryStatusSchema = z.enum(["draft", "completed"]);
const entryMessageRoleSchema = z.enum(["user", "assistant", "system"]);

const createEntrySchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  purpose: entryPurposeSchema,
  mode: entryModeSchema,
  allowFutureContext: z.boolean().optional(),
});

const updateEntrySchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
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

const createMessageSchema = z.object({
  role: entryMessageRoleSchema,
  content: z.string().trim().min(1, "content is required").max(8000),
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

entriesRouter.post("/", async (req, res, next) => {
  try {
    const owner = readOwnerScope(req);
    const parsed = createEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    if (owner.ownerKind === "demo" && entryStore.listEntries(owner).length >= 1) {
      throw new ApiError(403, "Demo mode supports one journal entry");
    }

    const entry = entryStore.createEntry({
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
    const owner = readOwnerScope(req);
    const response: EntryListResponse = {
      entries: entryStore.listEntries(owner),
      groups: entryStore.listEntriesGroupedByDay(owner),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.get("/:entryId", async (req, res, next) => {
  try {
    const owner = readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = getEntryForOwner(entryId, owner);
    const response: EntryResponse = { entry };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.patch("/:entryId", async (req, res, next) => {
  try {
    const owner = readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const existing = getEntryForOwner(entryId, owner);
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
    const entry = entryStore.updateEntry(existing.id, {
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
    const owner = readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = getEntryForOwner(entryId, owner);
    entryStore.deleteEntry(entry.id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

entriesRouter.put("/:entryId/document", async (req, res, next) => {
  try {
    const owner = readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = getEntryForOwner(entryId, owner);
    const parsed = upsertDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    const document = entryStore.upsertDocument({
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
    const owner = readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = getEntryForOwner(entryId, owner);
    const response: EntryDocumentResponse = {
      document: entryStore.getDocument(entry.id) ?? null,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.post("/:entryId/ingest", async (req, res, next) => {
  try {
    const owner = readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = getEntryForOwner(entryId, owner);
    const parsed = ingestDocumentSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    const document =
      parsed.data.content === undefined
        ? entryStore.getDocument(entry.id)
        : entryStore.upsertDocument({
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
      const response: EntryIngestResponse = {
        document,
        ingested: false,
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
    const ingestedDocument = entryStore.markDocumentIngested(
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

entriesRouter.get("/:entryId/messages", async (req, res, next) => {
  try {
    const owner = readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = getEntryForOwner(entryId, owner);
    const response: EntryMessagesResponse = {
      messages: entryStore.listMessages(entry.id),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

entriesRouter.post("/:entryId/messages", async (req, res, next) => {
  try {
    const owner = readOwnerScope(req);
    const entryId = parseEntryId(req.params);
    const entry = getEntryForOwner(entryId, owner);
    const parsed = createMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    const message = entryStore.addMessage({
      entryId: entry.id,
      ...parsed.data,
    });
    const response: EntryMessageResponse = { message };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});
