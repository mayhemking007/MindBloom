import { Router } from "express";
import { z } from "zod";
import {
  getReflectionSessionId,
  type GraftedSource,
  type ReflectResponse,
} from "@mindbloom/shared";

import { ApiError } from "../http/errors.js";
import { getAgentForSession } from "../lib/agent.js";
import { normalizeGraphSnapshot } from "../lib/graphNormalizer.js";
import { openai } from "../lib/openai.js";
import {
  buildReflectionUserPrompt,
  reflectionSystemPrompt,
} from "../lib/prompts.js";
import {
  buildReflectionContext,
  getFallbackReflectionInsights,
  parseReflectionInsights,
} from "../lib/reflection.js";

const dailySessionIdSchema = z
  .string()
  .trim()
  .regex(/^mindbloom-session-\d{4}-\d{2}-\d{2}$/, "Invalid daily session ID");

const reflectionSessionIdSchema = z
  .string()
  .trim()
  .regex(/^mindbloom-reflection-\d{4}-\d{2}$/, "Invalid reflection session ID");

const reflectRequestSchema = z.object({
  sourceSessionIds: z.array(dailySessionIdSchema).min(1).max(14),
  reflectionSessionId: reflectionSessionIdSchema.optional(),
});

export const reflectRouter = Router();

reflectRouter.post("/", async (req, res, next) => {
  try {
    const result = reflectRequestSchema.safeParse(req.body);
    if (!result.success) {
      throw new ApiError(
        400,
        result.error.issues[0]?.message ?? "Invalid body",
      );
    }

    const sourceSessionIds = [...new Set(result.data.sourceSessionIds)];
    const reflectionSessionId =
      result.data.reflectionSessionId ?? getReflectionSessionId();
    const reflectionAgent = await getAgentForSession(reflectionSessionId);
    const initialRegistry = await reflectionAgent.getGraftRegistry();

    for (const entry of initialRegistry) {
      if (!sourceSessionIds.includes(entry.sourceSessionId)) {
        await reflectionAgent.removeGraft(entry.nodeId);
      }
    }

    const existingRegistry = await reflectionAgent.getGraftRegistry();
    const alreadyGraftedSessions = new Set(
      existingRegistry.map((entry) => entry.sourceSessionId),
    );

    for (const sourceSessionId of sourceSessionIds) {
      if (alreadyGraftedSessions.has(sourceSessionId)) {
        continue;
      }

      const sourceAgent = await getAgentForSession(sourceSessionId);
      await reflectionAgent.absorbFromAgent(sourceAgent);
    }

    const snapshot = await reflectionAgent.getGraphSnapshot();
    const registry = await reflectionAgent.getGraftRegistry();
    const context = buildReflectionContext(snapshot, sourceSessionIds);
    let insights = getFallbackReflectionInsights();

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: reflectionSystemPrompt },
          { role: "user", content: buildReflectionUserPrompt(context) },
        ],
      });

      insights = parseReflectionInsights(
        response.choices[0]?.message.content ?? "",
      );
    } catch (error) {
      console.error(
        "Weekly reflection generation failed; using fallback",
        error,
      );
    }

    const normalizedSnapshot = normalizeGraphSnapshot(snapshot);
    const graftedSources: GraftedSource[] = registry
      .filter((entry) => sourceSessionIds.includes(entry.sourceSessionId))
      .map((entry) => ({
        reflectionNodeId: entry.nodeId,
        sourceSessionId: entry.sourceSessionId,
        sourceNodeId: entry.sourceNodeId,
        graftedAt:
          entry.graftedAt instanceof Date
            ? entry.graftedAt.toISOString()
            : String(entry.graftedAt),
      }));

    const response: ReflectResponse = {
      reflectionSessionId,
      sourceSessionIds,
      insights,
      snapshot: normalizedSnapshot,
      graftedSources,
      capturedAt: normalizedSnapshot.capturedAt,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});
