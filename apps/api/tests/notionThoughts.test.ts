import { describe, expect, it } from "vitest";
import type { RetrievalResult } from "memo-grafter";
import { selectTopRelatedThoughts } from "../src/services/notionThoughts.js";

describe("Notion related thought selection", () => {
  it("returns individual memories instead of grouping them by source page", () => {
    const result = {
      facts: [
        { id: "memory-1", sessionId: "source-session", topicNodeId: "topic-1", memoryType: "insight", subject: "writing", value: "Context should appear while the user is writing.", similarity: 0.91, sourceSpans: [{ section: { id: "section-1", title: "Contextual suggestions" }, document: { id: "page-1" }, sectionIndex: 0, start: 0, end: 1 }] },
        { id: "memory-2", sessionId: "source-session", topicNodeId: "topic-2", memoryType: "question", subject: "reflection", value: "How can resurfacing feel helpful rather than distracting?", similarity: 0.86 },
      ],
      nodes: [{ id: "topic-1", label: "Context in writing" }, { id: "topic-2", label: "Gentle resurfacing" }],
    } as unknown as RetrievalResult;

    const thoughts = selectTopRelatedThoughts(result, [
      { id: "current", memoSessionId: "current-session", title: "Current page", sourceUrl: "https://notion.so/current" },
      { id: "source", memoSessionId: "source-session", title: "Earlier research", sourceUrl: "https://notion.so/source" },
    ], "current");

    expect(thoughts).toHaveLength(2);
    expect(thoughts.map((thought) => thought.memoryId)).toEqual(["memory-1", "memory-2"]);
    expect(thoughts[0]).toMatchObject({ documentTitle: "Earlier research", theme: "Context in writing", sectionId: "section-1", sectionTitle: "Contextual suggestions" });
  });

  it("excludes the current page and orders thoughts by relevance", () => {
    const result = {
      facts: [
        { id: "current-memory", sessionId: "current-session", topicNodeId: "topic-1", memoryType: "fact", subject: "current", value: "Do not return this.", similarity: 0.99 },
        { id: "lower", sessionId: "source-session", topicNodeId: "topic-1", memoryType: "fact", subject: "source", value: "Lower match", similarity: 0.6 },
        { id: "higher", sessionId: "source-session", topicNodeId: "topic-1", memoryType: "insight", subject: "source", value: "Higher match", similarity: 0.9 },
      ],
      nodes: [{ id: "topic-1", label: "Theme" }],
    } as unknown as RetrievalResult;
    const thoughts = selectTopRelatedThoughts(result, [
      { id: "current", memoSessionId: "current-session", title: "Current", sourceUrl: "" },
      { id: "source", memoSessionId: "source-session", title: "Source", sourceUrl: "" },
    ], "current");
    expect(thoughts.map((thought) => thought.id)).toEqual(["higher", "lower"]);
  });
});
