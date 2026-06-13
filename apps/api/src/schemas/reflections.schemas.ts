import { z } from "zod";

export const reflectionIdParamSchema = z.object({
  reflectionId: z.string().trim().min(1).max(128),
});

export const createShareLinkSchema = z.object({
  selectedCardIds: z.array(z.string().trim().min(1).max(128)).min(1).max(12),
  expiresAt: z.string().datetime().nullable().optional(),
});
