import { Router } from "express";
import { z } from "zod";
import type {
  EntryDocumentResponse,
  EntryListResponse,
  EntryMessageResponse,
  EntryMessagesResponse,
  EntryOwnerKind,
  EntryResponse,
} from "@mindbloom/shared";

import { ApiError } from "../http/errors.js";
import { entryStore, type OwnerScope } from "../lib/entryStore.js";

const ownerKindSchema = z.enum(["authenticated", "demo"]);
const entryPurposeSchema = z.enum(["journal", "idea", "brainstorm"]);
const entryModeSchema = z.enum(["classic", "chat", "mixed"]);
const entryStatusSchema = z.enum(["draft", "completed"]);
const entryMessageRoleSchema = z.enum(["user", "assistant", "system"]);

const entryIdParamSchema = z.object({
  entryId: z.string().trim().min(1, "entryId is required").max(128),
});

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

const createMessageSchema = z.object({
  role: entryMessageRoleSchema,
  content: z.string().trim().min(1, "content is required").max(8000),
});

function readOwnerScope(req: {
  get(name: string): string | undefined;
}): OwnerScope {
  const parsedOwnerKind = ownerKindSchema.safeParse(
    req.get("x-mindbloom-owner-kind") ?? "demo",
  );
  if (!parsedOwnerKind.success) {
    throw new ApiError(
      400,
      "x-mindbloom-owner-kind must be authenticated or demo",
    );
  }

  const ownerKind: EntryOwnerKind = parsedOwnerKind.data;
  const ownerId = req.get("x-mindbloom-owner-id")?.trim();
  if (ownerKind === "authenticated" && !ownerId) {
    throw new ApiError(
      400,
      "x-mindbloom-owner-id is required for authenticated requests",
    );
  }

  return {
    ownerId: ownerId || "demo-local",
    ownerKind,
  };
}

function parseEntryId(params: unknown): string {
  const parsed = entryIdParamSchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid route params",
    );
  }

  return parsed.data.entryId;
}

function getEntryForOwner(entryId: string, owner: OwnerScope) {
  const entry = entryStore.getEntry(entryId);
  if (!entry) {
    throw new ApiError(404, "Entry not found");
  }
  if (entry.ownerId !== owner.ownerId || entry.ownerKind !== owner.ownerKind) {
    throw new ApiError(403, "Entry does not belong to this user");
  }

  return entry;
}

export const entriesRouter = Router();

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
