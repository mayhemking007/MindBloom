import { Router } from "express";
import { z } from "zod";

import { ApiError } from "../http/errors.js";
import { getAgentForSession } from "../lib/agent.js";
import { normalizeGraphSnapshot } from "../lib/graphNormalizer.js";

const snapshotQuerySchema = z.object({
  sessionId: z.string().trim().min(1, "sessionId is required").max(128),
});

export const snapshotRouter = Router();

snapshotRouter.get("/", async (req, res, next) => {
  try {
    const result = snapshotQuerySchema.safeParse(req.query);
    if (!result.success) {
      throw new ApiError(
        400,
        result.error.issues[0]?.message ?? "Invalid query params",
      );
    }

    const agent = await getAgentForSession(result.data.sessionId);
    const snapshot = await agent.getGraphSnapshot();

    res.json(normalizeGraphSnapshot(snapshot));
  } catch (error) {
    next(error);
  }
});
