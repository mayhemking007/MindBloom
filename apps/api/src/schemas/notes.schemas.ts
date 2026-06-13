import { z } from "zod";

export const noteSourceTypeSchema = z.enum([
  "entry-selection",
  "bloom-message",
  "reflection-card",
  "blank",
]);

export const createNoteSchema = z.object({
  entryId: z.string().trim().min(1).max(128).nullable().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().min(1).max(12000),
  sourceType: noteSourceTypeSchema,
  sourceMessageId: z.string().trim().min(1).max(128).nullable().optional(),
  sourceReflectionId: z.string().trim().min(1).max(128).nullable().optional(),
  sourceReflectionCardId: z.string().trim().min(1).max(128).nullable().optional(),
  sourceSelectionStart: z.number().int().nonnegative().nullable().optional(),
  sourceSelectionEnd: z.number().int().nonnegative().nullable().optional(),
  sourceExcerpt: z.string().max(1000).nullable().optional(),
  sourcePath: z.string().max(120).nullable().optional(),
  color: z.string().trim().min(1).max(32).nullable().optional(),
  pinned: z.boolean().optional(),
});

export const updateNoteSchema = createNoteSchema
  .pick({
    title: true,
    body: true,
    color: true,
    pinned: true,
  })
  .partial();
