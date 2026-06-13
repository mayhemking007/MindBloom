import { z } from "zod";

export const graftByRelevanceSchema = z.object({
  query: z.string().trim().min(1, "query is required").max(500),
  sourceEntryIds: z.array(z.string().trim().min(1).max(128)).max(12).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  maxThemes: z.coerce.number().int().min(1).max(12).optional(),
  minSimilarity: z.coerce.number().min(0).max(1).optional(),
  expansionDepth: z.coerce.number().int().min(0).max(3).optional(),
  expansionStrategy: z.enum(["none", "graph"]).optional(),
});
