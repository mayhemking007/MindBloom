import { z } from "zod";

export const entryStatusSchema = z.enum(["draft", "completed", "archived"]);

export const entryTagsSchema = z
  .array(z.string().trim().min(1).max(32))
  .max(8)
  .optional();

export const createEntrySchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  tags: entryTagsSchema,
  purpose: z.string().trim().min(1).max(80).optional(),
  allowFutureContext: z.boolean().optional(),
});

export const updateEntrySchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  tags: entryTagsSchema,
  purpose: z.string().trim().min(1).max(80).optional(),
  status: entryStatusSchema.optional(),
  allowFutureContext: z.boolean().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});

export const upsertDocumentSchema = z.object({
  content: z.string().max(60000),
});

export const ingestDocumentSchema = z.object({
  content: z.string().max(60000).optional(),
  force: z.boolean().optional(),
});

export const entryIdParamSchema = z.object({
  entryId: z.string().trim().min(1).max(128),
});
