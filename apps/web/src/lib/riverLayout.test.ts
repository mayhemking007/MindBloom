import { describe, expect, it } from "vitest";
import type { GraphEdge } from "@mindbloom/shared";

import type { EnrichedMapNode } from "../components/map/types";
import { buildRiverLayout, directConnectionSelection } from "./riverLayout";

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
    expect(layout.nodes.every((item) => item.width <= 150 && item.height === 88)).toBe(true);
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

    const selection = directConnectionSelection("topic-1", layout.paths);
    expect(selection.nodeIds).toEqual(new Set(["topic-1", "topic-2", "topic-4"]));
    expect(selection.pathIds.size).toBe(2);
    expect(
      layout.paths
        .filter((path) => selection.pathIds.has(path.id))
        .every((path) => path.fromId === "topic-1" || path.toId === "topic-1"),
    ).toBe(true);
  });

  it("caps extra visual branches so dense maps stay readable", () => {
    const nodes = [1, 2, 3, 4, 5, 6, 7, 8].map((order) =>
      node(`topic-${order}`, order),
    );
    const edges: GraphEdge[] = [];

    for (let source = 1; source <= nodes.length; source += 1) {
      for (let target = source + 2; target <= nodes.length; target += 1) {
        edges.push({
          sourceId: `topic-${source}`,
          targetId: `topic-${target}`,
          type: target % 2 === 0 ? "semantic" : "reentry",
          weight: 0.6 + target / 100,
        });
      }
    }

    const layout = buildRiverLayout(nodes, edges, 900);
    const branchPaths = layout.paths.filter((path) => path.kind !== "flow");

    expect(layout.paths.length).toBeLessThanOrEqual(15);
    expect(branchPaths.length).toBeLessThanOrEqual(8);
  });
});
