import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GraphSnapshotResponse } from "@mindbloom/shared";

import { MapViews } from "./MapViews";

const snapshot: GraphSnapshotResponse = {
  sessionId: "mindbloom-session-2026-06-16",
  capturedAt: "2026-06-16T10:00:00.000Z",
  nodes: [
    {
      id: "topic-1",
      sessionId: "mindbloom-session-2026-06-16",
      segmentId: "segment-1",
      label: "Work pressure",
      summary: "Pressure around work showed up first.",
      kind: "theme",
      kindLabel: "Theme",
      helperText: "A thought MindBloom noticed in this entry.",
      messageRange: [0, 1],
      topicOrder: 1,
      driftScore: 0.2,
      agentColor: null,
      fleetId: null,
      agentId: null,
      createdAt: "2026-06-16T10:00:00.000Z",
    },
    {
      id: "topic-2",
      sessionId: "mindbloom-session-2026-06-16",
      segmentId: "segment-2",
      label: "Rest",
      summary: "Rest arrived as the returning need.",
      kind: "returning-theme",
      kindLabel: "Returning theme",
      helperText: "A thought that seems to be coming back with energy.",
      messageRange: [1, 2],
      topicOrder: 2,
      driftScore: 0.72,
      agentColor: null,
      fleetId: null,
      agentId: null,
      createdAt: "2026-06-16T10:01:00.000Z",
    },
  ],
  edges: [
    {
      sourceId: "topic-1",
      targetId: "topic-2",
      type: "reentry",
      connectionLabel: "Returning thought",
      helperText: "This thought has resurfaced in the entry.",
      weight: 0.8,
    },
  ],
  memories: [
    {
      id: "memory-1",
      segmentId: "segment-1",
      topicNodeId: "topic-1",
      agentId: null,
      sessionId: "mindbloom-session-2026-06-16",
      memoryType: "insight",
      sourceType: "document",
      subject: "work",
      predicate: "revealed",
      value: "Work pressure is connected to wanting more breathing room.",
      confidence: 0.91,
      tags: [],
      sourceUrl: null,
      sourceTitle: null,
      supersededBy: null,
      decayed: false,
      hasConflict: false,
      agentColor: null,
      fleetId: null,
      createdAt: "2026-06-16T10:00:00.000Z",
    },
    {
      id: "memory-2",
      segmentId: "segment-2",
      topicNodeId: "topic-2",
      agentId: null,
      sessionId: "mindbloom-session-2026-06-16",
      memoryType: "question",
      sourceType: "document",
      subject: "rest",
      predicate: "asks",
      value: "What would make rest easier to protect this week?",
      confidence: 0.74,
      tags: [],
      sourceUrl: null,
      sourceTitle: null,
      supersededBy: null,
      decayed: false,
      hasConflict: false,
      agentColor: null,
      fleetId: null,
      createdAt: "2026-06-16T10:01:00.000Z",
    },
  ],
  memoryEdges: [],
};

describe("MapViews", () => {
  it("renders the empty state", () => {
    render(<MapViews snapshot={{ ...snapshot, nodes: [], edges: [], memories: [] }} />);

    expect(screen.getByText("Your mind map is still forming")).toBeVisible();
  });

  it("renders river cards and shows grouped memories in the detail panel", () => {
    render(<MapViews snapshot={snapshot} />);

    expect(screen.getByText("Thought River")).toBeVisible();
    expect(screen.getAllByText("Work pressure").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Work pressure/i }));

    expect(screen.getByText("Insights")).toBeVisible();
    expect(screen.getByLabelText("Work pressure thought details")).toBeVisible();
    expect(
      screen.getAllByText("Work pressure is connected to wanting more breathing room.")
        .length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/topicNodeId|sourceId|targetId/i)).not.toBeInTheDocument();
  });

  it("draws the thought river with curved paths", () => {
    const { container } = render(<MapViews snapshot={snapshot} />);

    const paths = [...container.querySelectorAll("[data-river-path]")];
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((path) => path.getAttribute("d")?.includes(" C "))).toBe(true);
    expect(container.querySelector(".overflow-x-auto")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Rest/i }));
    expect(container.querySelector(".river-flow-highlight")).toBeInTheDocument();
  });

  it("switches to the constellation without refetching", () => {
    render(<MapViews snapshot={snapshot} />);

    fireEvent.click(screen.getByRole("button", { name: /Constellation/i }));

    expect(screen.getByRole("img", { name: "Insight constellation map" })).toBeVisible();
    expect(screen.getByText("Related themes")).toBeVisible();
  });

  it("uses summaries and seed stars when there are no memories yet", () => {
    render(<MapViews snapshot={{ ...snapshot, memories: [] }} />);

    expect(screen.getAllByText("Pressure around work showed up first.").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Constellation/i }));

    expect(screen.getByRole("img", { name: "Insight constellation map" })).toBeVisible();
    expect(screen.queryByText("Memories will appear here as stars.")).not.toBeInTheDocument();
    expect(screen.queryByText("Topic detail")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Select Work pressure"));

    expect(screen.getByText("Topic detail")).toBeVisible();
    expect(screen.getAllByText("Pressure around work showed up first.").length)
      .toBeGreaterThan(1);
  });
});
