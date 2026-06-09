import { Router } from "express";
import { z } from "zod";
import type { NoteResponse, NotesResponse } from "@mindbloom/shared";

import { ApiError } from "../http/errors.js";
import { getEntryForOwner, readOwnerScope } from "../http/ownerScope.js";
import { entryStore, type OwnerScope } from "../lib/entryStore.js";

const noteSourceTypeSchema = z.enum([
  "entry-selection",
  "bloom-message",
  "reflection-card",
  "blank",
]);

const noteIdParamSchema = z.object({
  noteId: z.string().trim().min(1, "noteId is required").max(128),
});

const createNoteSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  body: z.string().trim().min(1, "body is required").max(12000),
  entryId: z.string().trim().min(1).max(128).nullable().optional(),
  sourceType: noteSourceTypeSchema.default("blank"),
  sourceMessageId: z.string().trim().min(1).max(128).nullable().optional(),
  sourceReflectionId: z.string().trim().min(1).max(128).nullable().optional(),
  sourceReflectionCardId: z.string().trim().min(1).max(128).nullable().optional(),
  sourceSelectionStart: z.number().int().min(0).nullable().optional(),
  sourceSelectionEnd: z.number().int().min(0).nullable().optional(),
  sourceExcerpt: z.string().trim().min(1).max(4000).nullable().optional(),
  sourcePath: z.string().trim().min(1).max(240).nullable().optional(),
  color: z.string().trim().min(1).max(40).nullable().optional(),
  pinned: z.boolean().optional(),
}).refine(
  (value) =>
    value.sourceSelectionStart == null ||
    value.sourceSelectionEnd == null ||
    value.sourceSelectionEnd >= value.sourceSelectionStart,
  {
    message: "sourceSelectionEnd must be greater than or equal to sourceSelectionStart",
    path: ["sourceSelectionEnd"],
  },
);

const updateNoteSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  body: z.string().trim().min(1, "body is required").max(12000).optional(),
  color: z.string().trim().min(1).max(40).nullable().optional(),
  pinned: z.boolean().optional(),
});

function parseNoteId(params: unknown): string {
  const parsed = noteIdParamSchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid route params",
    );
  }

  return parsed.data.noteId;
}

function getNoteForOwner(noteId: string, owner: OwnerScope) {
  const note = entryStore.getNote(noteId);
  if (!note) {
    throw new ApiError(404, "Note not found");
  }
  if (note.ownerId !== owner.ownerId || note.ownerKind !== owner.ownerKind) {
    throw new ApiError(403, "Note does not belong to this user");
  }

  return note;
}

export const notesRouter = Router();

notesRouter.post("/", async (req, res, next) => {
  try {
    const owner = readOwnerScope(req);
    const parsed = createNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    if (parsed.data.entryId) {
      getEntryForOwner(parsed.data.entryId, owner);
    }

    const note = entryStore.createNote({
      ...owner,
      ...parsed.data,
    });
    const response: NoteResponse = { note };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

notesRouter.get("/", async (req, res, next) => {
  try {
    const owner = readOwnerScope(req);
    const response: NotesResponse = {
      notes: entryStore.listNotes(owner),
      groups: entryStore.listNotesGroupedByDay(owner),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

notesRouter.get("/:noteId", async (req, res, next) => {
  try {
    const owner = readOwnerScope(req);
    const note = getNoteForOwner(parseNoteId(req.params), owner);
    const response: NoteResponse = { note };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

notesRouter.patch("/:noteId", async (req, res, next) => {
  try {
    const owner = readOwnerScope(req);
    const note = getNoteForOwner(parseNoteId(req.params), owner);
    const parsed = updateNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    const updated = entryStore.updateNote(note.id, parsed.data);
    if (!updated) {
      throw new ApiError(404, "Note not found");
    }

    const response: NoteResponse = { note: updated };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

notesRouter.delete("/:noteId", async (req, res, next) => {
  try {
    const owner = readOwnerScope(req);
    const note = getNoteForOwner(parseNoteId(req.params), owner);
    entryStore.deleteNote(note.id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
