import { describe, expect, it } from "vitest";
import type { GraphMemory } from "@mindbloom/shared";

import { computeConstellationLayout } from "./mapLayout";
import type { EnrichedMapNode } from "../components/map/types";

const baseMemory: GraphMemory = {
  id: "memory-1",
  segmentId: "segment-1",
  topicNodeId: "topic-1",
  agentId: null,
  sessionId: "session-1",
  memoryType: "insight",
  sourceType: "document",
  subject: "topic",
  predicate: "revealed",
  value: "A memory with confidence.",
  confidence: 0.9,
  tags: [],
  sourceUrl: null,
  sourceTitle: null,
  supersededBy: null,
  decayed: false,
  hasConflict: false,
  agentColor: null,
  fleetId: null,
  createdAt: "2026-06-16T10:00:00.000Z",
};

function nodeWithMemories(memories: GraphMemory[]): EnrichedMapNode {
  return {
    id: "topic-1",
    sessionId: "session-1",
    segmentId: "segment-1",
    label: "Creative pressure",
    summary: "A topic summary.",
    kind: "theme",
    kindLabel: "Theme",
    helperText: "A thought MindBloom noticed in this entry.",
    tags: [],
    messageRange: [0, 1],
    topicOrder: 1,
    driftScore: 0.2,
    agentColor: null,
    fleetId: null,
    agentId: null,
    createdAt: "2026-06-16T10:00:00.000Z",
    color: "coral",
    memories,
    topMemory: memories[0] ?? null,
    edgesOut: [],
  };
}

describe("computeConstellationLayout", () => {
  it("places memory stars outside the topic core", () => {
    const [group] = computeConstellationLayout(
      [nodeWithMemories([baseMemory])],
      760,
      430,
    );
    const star = group?.stars[0];

    expect(group).toBeDefined();
    expect(star).toBeDefined();

    const distance = Math.hypot(
      (star?.x ?? 0) - (group?.cx ?? 0),
      (star?.y ?? 0) - (group?.cy ?? 0),
    );

    expect(distance).toBeGreaterThan((group?.radius ?? 0) + (star?.r ?? 0));
  });
});
