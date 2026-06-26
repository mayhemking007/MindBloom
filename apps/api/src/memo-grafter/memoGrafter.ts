import {
  MemoGrafterAgent,
  OpenAIEmbedAdapter,
} from "memo-grafter";
import type { MemoGrafterAgent as MemoGrafterAgentType } from "memo-grafter";

import { env } from "../config/env.js";
import { journalingSystemPrompt } from "../memory/prompts.js";
import { MindBloomOpenAILLMAdapter } from "./openAiAdapters.js";

const memoGrafterCache = new Map<string, MemoGrafterAgentType>();

export async function getMemoGrafterForSession(
  sessionId: string,
): Promise<MemoGrafterAgentType> {
  const cachedAgent = memoGrafterCache.get(sessionId);
  if (cachedAgent) {
    return cachedAgent;
  }

  console.info(`Initializing memo-grafter agent for session ${sessionId}`);

  const agent = new MemoGrafterAgent({
    db: {
      connectionString: env.DATABASE_URL,
    },
    llm: new MindBloomOpenAILLMAdapter("gpt-4o-mini"),
    embedder: new OpenAIEmbedAdapter("text-embedding-3-small"),
    systemPrompt: journalingSystemPrompt,
    drift: {
      mode: "intent",
      driftSensitivity: "low",
      minSegmentMessages: 5,
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

  memoGrafterCache.set(sessionId, agent);
  return agent;
}

export async function invokeMemoGrafterWithStreaming(
  agent: MemoGrafterAgentType,
  message: string,
  onChunk: (chunk: string) => void | Promise<void>,
): Promise<string> {
  const mutableAgent = agent as unknown as {
    core?: { llm?: unknown };
    invoke: (userMessage: string) => Promise<string>;
  };

  if (!mutableAgent.core) {
    return mutableAgent.invoke(message);
  }

  const originalLlm = mutableAgent.core.llm;
  mutableAgent.core.llm = new MindBloomOpenAILLMAdapter("gpt-4o-mini", {
    streaming: true,
    onChunk,
  });

  try {
    return await mutableAgent.invoke(message);
  } finally {
    mutableAgent.core.llm = originalLlm;
  }
}

export async function shutdownMemoGrafters(): Promise<void> {
  const agents = [...memoGrafterCache.entries()];
  memoGrafterCache.clear();

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

export function getCachedMemoGrafterCount(): number {
  return memoGrafterCache.size;
}

export const getAgentForSession = getMemoGrafterForSession;
export const invokeAgentWithStreaming = invokeMemoGrafterWithStreaming;
export const shutdownAgents = shutdownMemoGrafters;
export const getCachedAgentCount = getCachedMemoGrafterCount;
