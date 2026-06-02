import { MemoGrafterAgent } from "../../../../node_modules/memo-grafter/dist/MemoGrafterAgent.js";
import {
  OpenAIEmbedAdapter,
  OpenAILLMAdapter,
} from "../../../../node_modules/memo-grafter/dist/adapters/OpenAIAdapter.js";
import type { MemoGrafterAgent as MemoGrafterAgentType } from "memo-grafter";

import { env } from "../config/env.js";
import { journalingSystemPrompt } from "./prompts.js";

const agentCache = new Map<string, MemoGrafterAgentType>();

export async function getAgentForSession(
  sessionId: string,
): Promise<MemoGrafterAgentType> {
  const cachedAgent = agentCache.get(sessionId);
  if (cachedAgent) {
    return cachedAgent;
  }

  console.info(`Initializing memo-grafter agent for session ${sessionId}`);

  const agent = new MemoGrafterAgent({
    db: {
      connectionString: env.DATABASE_URL,
    },
    llm: new OpenAILLMAdapter("gpt-4o-mini"),
    embedder: new OpenAIEmbedAdapter("text-embedding-3-small"),
    systemPrompt: journalingSystemPrompt,
    drift: {
      mode: "intent",
      driftSensitivity: "medium",
      minSegmentMessages: 3,
      reentryDetection: true,
      reentryThreshold: 0.82,
    },
    graph: {
      topK: 5,
      hopDepth: 2,
    },
    inject: {
      bufferSize: 4,
      tokenBudget: 1800,
      recentWindowSize: 20,
      recallLimit: 6,
      recallMinSimilarity: 0.55,
    },
  });

  try {
    await agent.initialize();
  } catch (error) {
    console.error(
      `Failed to initialize memo-grafter agent for session ${sessionId}`,
      error,
    );
    throw error;
  }

  agentCache.set(sessionId, agent);
  return agent;
}

export async function shutdownAgents(): Promise<void> {
  const agents = [...agentCache.entries()];
  agentCache.clear();

  await Promise.allSettled(
    agents.map(async ([sessionId, agent]) => {
      try {
        await agent.close();
      } catch (error) {
        console.error(
          `Failed to close memo-grafter agent for session ${sessionId}`,
          error,
        );
      }
    }),
  );
}

export function getCachedAgentCount(): number {
  return agentCache.size;
}
