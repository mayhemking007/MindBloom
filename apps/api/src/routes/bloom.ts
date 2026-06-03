import { Router } from "express";
import { z } from "zod";
import type { BloomResponse } from "@mindbloom/shared";

import { ApiError } from "../http/errors.js";
import {
  buildBloomContext,
  getFallbackBloomInsights,
  parseBloomInsights,
} from "../lib/bloom.js";
import { getAgentForSession } from "../lib/agent.js";
import { normalizeGraphSnapshot } from "../lib/graphNormalizer.js";
import { openai } from "../lib/openai.js";
import { bloomSystemPrompt, buildBloomUserPrompt } from "../lib/prompts.js";

const bloomRequestSchema = z.object({
  sessionId: z.string().trim().min(1, "sessionId is required").max(128),
});

export const bloomRouter = Router();

bloomRouter.post("/", async (req, res, next) => {
  try {
    const result = bloomRequestSchema.safeParse(req.body);
    if (!result.success) {
      throw new ApiError(
        400,
        result.error.issues[0]?.message ?? "Invalid body",
      );
    }

    const { sessionId } = result.data;
    const agent = await getAgentForSession(sessionId);
    const snapshot = await agent.getGraphSnapshot();
    const history = agent.getHistory();
    const context = buildBloomContext(snapshot, history);

    let insights = getFallbackBloomInsights(context.topWord);

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: bloomSystemPrompt,
          },
          {
            role: "user",
            content: buildBloomUserPrompt(context),
          },
        ],
      });

      const text = response.choices[0]?.message.content ?? "";
      insights = parseBloomInsights(text, context.topWord);
    } catch (error) {
      console.error("Bloom insight generation failed; using fallback", error);
    }

    const normalizedSnapshot = normalizeGraphSnapshot(snapshot);
    const bloomResponse: BloomResponse = {
      insights,
      snapshot: normalizedSnapshot,
      topWord: context.topWord,
      sessionId,
      capturedAt: normalizedSnapshot.capturedAt,
    };

    res.json(bloomResponse);
  } catch (error) {
    next(error);
  }
});
