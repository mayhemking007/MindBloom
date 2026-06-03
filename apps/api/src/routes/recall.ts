import { Router } from "express";
import { z } from "zod";

import { ApiError } from "../http/errors.js";
import { getAgentForSession } from "../lib/agent.js";
import { normalizeRecallResult } from "../lib/graphNormalizer.js";

const recallQuerySchema = z.object({
  sessionId: z.string().trim().min(1, "sessionId is required").max(128),
  q: z.string().trim().min(1, "q is required").max(2000),
  limit: z.coerce.number().int().positive().max(50).default(6),
  minSimilarity: z.coerce.number().min(0).max(1).default(0.5),
  tokenBudget: z.coerce.number().int().positive().max(8000).default(800),
});

export const recallRouter = Router();

recallRouter.get("/", async (req, res, next) => {
  try {
    const result = recallQuerySchema.safeParse(req.query);
    if (!result.success) {
      throw new ApiError(
        400,
        result.error.issues[0]?.message ?? "Invalid query params",
      );
    }

    const { sessionId, q, limit, minSimilarity, tokenBudget } = result.data;
    const agent = await getAgentForSession(sessionId);
    const recallResult = await agent.recall(q, {
      limit,
      minSimilarity,
      tokenBudget,
    });

    res.json(normalizeRecallResult(recallResult));
  } catch (error) {
    next(error);
  }
});
