import { describe, expect, it } from "vitest";
import type { GraphEdge } from "@mindbloom/shared";

import type { EnrichedMapNode } from "../components/map/types";
import { buildRiverLayout } from "./riverLayout";

function node(id: string, topicOrder: number): EnrichedMapNode {
  return {
    id,
    sessionId: "session-1",
    segmentId: `segment-${topicOrder}`,
    label: `Thought ${topicOrder}`,
    summary: `Summary ${topicOrder}`,
    messageRange: [topicOrder - 1, topicOrder],
    topicOrder,
    driftScore: topicOrder % 2 === 0 ? 0.7 : 0.2,
    agentColor: null,
    fleetId: null,
    agentId: null,
    createdAt: "2026-06-21T10:00:00.000Z",
    color: "purple",
    memories: [],
    topMemory: null,
    edgesOut: [],
  };
}

describe("buildRiverLayout", () => {
  it("wraps the chronological path and keeps every connector curved", () => {
    const nodes = [1, 2, 3, 4, 5].map((order) => node(`topic-${order}`, order));
    const layout = buildRiverLayout(nodes, [], 620);

    expect(new Set(layout.nodes.map((item) => item.row)).size).toBeGreaterThan(1);
    expect(layout.paths).toHaveLength(4);
    expect(layout.paths.every((path) => path.d.includes(" C "))).toBe(true);
  });

  it("adds a separate returning branch to an earlier thought", () => {
    const nodes = [1, 2, 3, 4].map((order) => node(`topic-${order}`, order));
    const edges: GraphEdge[] = [
      {
        sourceId: "topic-4",
        targetId: "topic-1",
        type: "reentry",
        weight: 0.9,
      },
    ];
    const layout = buildRiverLayout(nodes, edges, 900);

    expect(layout.paths.some((path) => path.kind === "return")).toBe(true);
    expect(layout.parentByNodeId.get("topic-4")).toBe("topic-1");
  });
});
