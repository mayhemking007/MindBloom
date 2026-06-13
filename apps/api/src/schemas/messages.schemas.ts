import { z } from "zod";

export const entryMessageRoleSchema = z.enum(["user", "assistant", "system"]);

export const createMessageSchema = z.object({
  role: entryMessageRoleSchema,
  content: z.string().trim().min(1, "content is required").max(8000),
});

export const streamMessageSchema = z.object({
  content: z.string().trim().min(1, "content is required").max(8000),
  documentDraft: z.string().max(60000).optional(),
  selectedText: z.string().max(8000).optional(),
  entryTags: z.array(z.string().trim().min(1).max(32)).max(8).optional(),
  broughtInContext: z.array(z.string().trim().min(1).max(160)).max(12).optional(),
});
