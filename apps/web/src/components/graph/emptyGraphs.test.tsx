import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode } from "@mindbloom/shared";

import { BloomGraph } from "../bloom/BloomGraph";
import { MindMap } from "./MindMap";

describe("empty graph states", () => {
  it("renders the Bloom graph empty state", () => {
    render(<BloomGraph nodes={[]} edges={[]} />);
    expect(screen.getByText("Your mind map is still forming")).toBeVisible();
  });

  it("renders the full Mind Map empty state", () => {
    render(<MindMap nodes={[]} edges={[]} />);
    expect(screen.getByText("Your mind map is still forming")).toBeVisible();
  });

  it("renders friendly map controls and connection language", () => {
    const nodes: GraphNode[] = [
      {
        id: "theme-1",
        sessionId: "mindbloom-entry-entry-1",
        segmentId: "segment-1",
        label: "Work pressure",
        summary: "You noticed pressure building around work.",
        kind: "theme",
        kindLabel: "Theme",
        helperText: "A thought MindBloom noticed in this entry.",
        messageRange: [0, 1],
        topicOrder: 1,
        driftScore: 0.2,
        agentColor: null,
        fleetId: null,
        agentId: null,
        createdAt: "2026-06-04T08:00:00.000Z",
      },
      {
        id: "theme-2",
        sessionId: "mindbloom-entry-entry-1",
        segmentId: "segment-2",
        label: "Rest",
        summary: "Rest kept showing up as something you wanted.",
        kind: "returning-theme",
        kindLabel: "Returning theme",
        helperText: "A thought that seems to be coming back with energy.",
        messageRange: [1, 2],
        topicOrder: 2,
        driftScore: 0.8,
        agentColor: null,
        fleetId: null,
        agentId: null,
        createdAt: "2026-06-04T08:01:00.000Z",
      },
    ];
    const edges: GraphEdge[] = [
      {
        sourceId: "theme-1",
        targetId: "theme-2",
        type: "semantic",
        connectionLabel: "Related thought",
        helperText: "These themes appear to be talking about similar ideas.",
        weight: 0.7,
      },
    ];

    const { container } = render(<MindMap nodes={nodes} edges={edges} />);

    expect(screen.getByText("Current entry")).toBeVisible();
    expect(screen.getAllByText("Brought-in context").length).toBeGreaterThan(0);
    expect(screen.getByText("Related thought")).toBeVisible();
    expect(container.textContent).not.toMatch(/semantic edge|reentry edge|node/i);
  });
});
