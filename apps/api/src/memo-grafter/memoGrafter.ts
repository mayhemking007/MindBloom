import {
  MemoGrafter,
  MemoGrafterAgent,
  OpenAIEmbedAdapter,
} from "memo-grafter";
import type {
  MemoGrafterAgent as MemoGrafterAgentType,
  MemoGrafter as MemoGrafterType,
  RetrievalResult,
  RetrieverConfig,
  Message,
} from "memo-grafter";

import { env } from "../config/env.js";
import { journalingSystemPrompt } from "../memory/prompts.js";
import { MindBloomOpenAILLMAdapter } from "./openAiAdapters.js";

const memoGrafterCache = new Map<string, MemoGrafterAgentType>();
let memoGrafterCorePromise: Promise<MemoGrafterType> | null = null;

function memoGrafterConfig(sessionId?: string) {
  return {
    db: {
      connectionString: env.DATABASE_URL,
    },
    llm: new MindBloomOpenAILLMAdapter(env.MEMO_GRAFTER_LLM_MODEL ?? "gpt-4o-mini"),
    embedder: new OpenAIEmbedAdapter(
      env.MEMO_GRAFTER_EMBEDDING_MODEL ?? "text-embedding-3-small",
    ),
    systemPrompt: journalingSystemPrompt,
    ...(sessionId ? { sessionId } : {}),
    drift: {
      mode: "intent" as const,
      driftSensitivity: "low" as const,
      minSegmentMessages: 8,
      reentryDetection: true,
      reentryThreshold: 0.82,
      topicAssignment: {
        reuseThreshold: 0.82,
        candidateLimit: 8,
      },
    },
    graph: {
      topK: 5,
      hopDepth: 2,
    },
    ingestion: {
      concurrency: {
        extraction: 2,
        embedding: 4,
      },
    },
    inject: {
      bufferSize: 4,
      tokenBudget: 1800,
      recentWindowSize: 20,
      recallLimit: 6,
      recallMinSimilarity: 0.55,
    },
    diagnostics: {
      onWarning: (warning: { code: string; operation: string; stage?: string }) => {
        console.warn("[memo-grafter] degraded operation", {
          code: warning.code,
          operation: warning.operation,
          stage: warning.stage,
        });
      },
    },
  };
}

export function getMemoGrafterCore(): Promise<MemoGrafterType> {
  if (!memoGrafterCorePromise) {
    memoGrafterCorePromise = MemoGrafter.create(memoGrafterConfig()).catch((error) => {
      memoGrafterCorePromise = null;
      throw error;
    });
  }
  return memoGrafterCorePromise;
}

export async function getMemoGrafterForSession(
  sessionId: string,
): Promise<MemoGrafterAgentType> {
  const cachedAgent = memoGrafterCache.get(sessionId);
  if (cachedAgent) {
    return cachedAgent;
  }

  console.info(`Initializing memo-grafter agent for session ${sessionId}`);

  const agent = await MemoGrafterAgent.create(memoGrafterConfig(sessionId));

  try {
    if (agent.getSessionId() !== sessionId) {
      throw new Error(`MemoGrafter initialized unexpected session ${agent.getSessionId()}`);
    }
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
  return completeWithMemoGrafterContext({
    sessionId: agent.getSessionId(),
    retrievalQuery: message,
    userPrompt: message,
    recentMessages: agent.getHistory().slice(-8),
    onChunk,
  });
}

export async function completeWithMemoGrafterContext(input: {
  sessionId: string;
  retrievalQuery: string;
  userPrompt: string;
  recentMessages?: Message[];
  tags?: string[];
  idempotencyKey?: string;
  onChunk: (chunk: string) => void | Promise<void>;
}): Promise<string> {
  const context = await retrieveMemoGrafterContext(input.sessionId, input.retrievalQuery, {
    limit: 6,
    tokenBudget: 1800,
    contextualization: {
      recentMessages: input.recentMessages ?? [],
      maxMessages: 8,
      maxTokens: 600,
    },
  });
  const llm = new MindBloomOpenAILLMAdapter(env.MEMO_GRAFTER_LLM_MODEL ?? "gpt-4o-mini", {
    streaming: true,
    onChunk: input.onChunk,
  });
  const system = [journalingSystemPrompt, context.systemPrompt]
    .filter(Boolean)
    .join("\n\n");
  const reply = await llm.complete(
    [{ role: "user", content: input.userPrompt }],
    system,
    { timeoutMs: 60_000 },
  );

  try {
    const core = await getMemoGrafterCore();
    await core.analyzeDetailed({
      sessionId: input.sessionId,
      userMessage: input.retrievalQuery,
      assistantMessage: reply,
      tags: input.tags,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (error) {
    console.warn("[memo-grafter] Bloom response completed but analysis failed", error);
  }

  return reply;
}

export async function retrieveMemoGrafterContext(
  sessionId: string,
  query: string,
  options: RetrieverConfig = {},
): Promise<RetrievalResult> {
  const core = await getMemoGrafterCore();
  return core.context({ sessionId, query, ...options }, { timeoutMs: 30_000 });
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

  const corePromise = memoGrafterCorePromise;
  memoGrafterCorePromise = null;
  if (corePromise) {
    const core = await corePromise;
    await core.close({ drain: true, timeoutMs: 10_000 });
  }
}

export function getCachedMemoGrafterCount(): number {
  return memoGrafterCache.size;
}

export const getAgentForSession = getMemoGrafterForSession;
export const invokeAgentWithStreaming = invokeMemoGrafterWithStreaming;
export const shutdownAgents = shutdownMemoGrafters;
export const getCachedAgentCount = getCachedMemoGrafterCount;
