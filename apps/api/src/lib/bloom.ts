import { z } from "zod";
import type { BloomInsights } from "@mindbloom/shared";
import type { GraphSnapshot, Message } from "memo-grafter";

import type { BloomPromptContext } from "./prompts.js";

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "been",
  "being",
  "but",
  "can",
  "could",
  "did",
  "does",
  "doing",
  "for",
  "from",
  "had",
  "have",
  "her",
  "him",
  "his",
  "just",
  "like",
  "maybe",
  "more",
  "much",
  "not",
  "now",
  "only",
  "out",
  "really",
  "she",
  "should",
  "some",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "they",
  "this",
  "was",
  "were",
  "what",
  "when",
  "with",
  "would",
  "you",
  "your",
]);

const bloomInsightsSchema = z.object({
  mood: z.string().min(1),
  moodArc: z.string().min(1),
  archetype: z.string().min(1),
  archetypeCaption: z.string().min(1),
  sessionSong: z.string().min(1),
  wordOfDay: z.string().min(1),
  wordOfDayCopy: z.string().min(1),
  recurringThread: z.string().min(1),
  shareableTagline: z.string().min(1),
});

export function getTopWord(history: Message[]): string {
  const frequency = new Map<string, number>();

  for (const message of history) {
    if (message.role !== "user") {
      continue;
    }

    const words = message.content
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word));

    for (const word of words) {
      frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }
  }

  return (
    [...frequency.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
    "reflection"
  );
}

export function buildBloomContext(
  snapshot: GraphSnapshot,
  history: Message[],
): BloomPromptContext {
  const activeMemories = snapshot.memories.filter((memory) => !memory.decayed);

  return {
    topicLabels: snapshot.nodes.map((node) => node.label),
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
    topWord: getTopWord(history),
  };
}

export function getFallbackBloomInsights(topWord: string): BloomInsights {
  return {
    mood: "Something real happened here",
    moodArc: "The session moved through its own quiet rhythm.",
    archetype: "Someone working it out",
    archetypeCaption: "You showed up with what was true today.",
    sessionSong: "A quiet song without a title yet, soft around the edges.",
    wordOfDay: topWord,
    wordOfDayCopy: "You kept circling this word for a reason.",
    recurringThread: "There was a thread here, and you stayed with it.",
    shareableTagline: "Today I sat with myself for a while.",
  };
}

export function parseBloomInsights(
  rawText: string,
  topWord: string,
): BloomInsights {
  try {
    const parsed = JSON.parse(rawText) as unknown;
    return bloomInsightsSchema.parse(parsed);
  } catch {
    return getFallbackBloomInsights(topWord);
  }
}
