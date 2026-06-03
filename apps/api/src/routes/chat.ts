import { Router } from "express";
import { z } from "zod";
import type { ChatResponse, TopicPill } from "@mindbloom/shared";

import { ApiError } from "../http/errors.js";
import { getAgentForSession } from "../lib/agent.js";

const chatRequestSchema = z.object({
  sessionId: z.string().trim().min(1, "sessionId is required").max(128),
  message: z.string().trim().min(1, "message is required").max(8000),
});

export const chatRouter = Router();

chatRouter.post("/", async (req, res, next) => {
  try {
    const result = chatRequestSchema.safeParse(req.body);
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0]?.message ?? "Invalid body");
    }

    const { sessionId, message } = result.data;
    const agent = await getAgentForSession(sessionId);
    const reply = await agent.invoke(message);
    const activeNodes = await agent.getActiveNodes();

    const topicPills: TopicPill[] = activeNodes.map((node) => ({
      id: node.id,
      label: node.label,
      topicOrder: node.topicOrder,
    }));

    const response: ChatResponse = {
      reply,
      topicPills,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});
