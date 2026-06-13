import { z } from "zod";
import type { ReflectionInsights } from "@mindbloom/shared";
import type { GraphSnapshot } from "memo-grafter";

import type { ReflectionPromptContext } from "./prompts.js";

const reflectionInsightsSchema = z.object({
  recurringThemes: z.array(z.string().min(1)).min(1).max(6),
  resurfacingTopics: z.array(z.string().min(1)).min(1).max(6),
  emotionalShifts: z.string().min(1),
  questionsForNextWeek: z.array(z.string().min(1)).min(1).max(5),
  weeklyTagline: z.string().min(1),
});

export function buildReflectionContext(
  snapshot: GraphSnapshot,
  sourceSessionIds: string[],
): ReflectionPromptContext {
  const activeMemories = snapshot.memories.filter((memory) => !memory.decayed);

  return {
    sourceSessionIds,
    topicSummaries: snapshot.nodes
      .map((node) => `${node.label}: ${node.summary}`)
      .join("\n"),
    memoryFacts: activeMemories
      .filter((memory) => memory.memoryType === "fact")
      .map((memory) => `${memory.subject} ${memory.predicate} ${memory.value}`)
      .join("\n"),
    memoryInsights: activeMemories
      .filter((memory) => memory.memoryType === "insight")
      .map((memory) => memory.value)
      .join("\n"),
  };
}

export function getFallbackReflectionInsights(): ReflectionInsights {
  return {
    recurringThemes: ["Showing up for what mattered"],
    resurfacingTopics: ["Thoughts that asked for another look"],
    emotionalShifts:
      "The selected days carried their own rhythm, with some feelings returning in new forms.",
    questionsForNextWeek: [
      "What deserves a little more attention next week?",
      "Which thought feels different now than it did at the start?",
    ],
    weeklyTagline: "This week, I kept listening for the thread.",
  };
}

export function parseReflectionInsights(rawText: string): ReflectionInsights {
  try {
    return reflectionInsightsSchema.parse(JSON.parse(rawText) as unknown);
  } catch {
    return getFallbackReflectionInsights();
  }
}
