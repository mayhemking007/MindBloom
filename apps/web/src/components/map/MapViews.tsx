import { useMemo, useState } from "react";
import type { GraphSnapshotResponse } from "@mindbloom/shared";

import { getColorForTopic, type ColorRamp } from "../../lib/topicColors";
import { InsightConstellation } from "./InsightConstellation";
import { MapToggle } from "./MapToggle";
import { ThoughtRiver } from "./ThoughtRiver";
import type { EnrichedMapNode, MapViewType, MapViewsProps } from "./types";

const fallbackRamps: ColorRamp[] = ["coral", "purple", "teal", "amber", "blue", "pink"];

function enrichSnapshot(snapshot: GraphSnapshotResponse): EnrichedMapNode[] {
  return [...snapshot.nodes]
    .sort((a, b) => a.topicOrder - b.topicOrder)
    .map((node, index) => {
      const memories = snapshot.memories
        .filter((memory) => memory.topicNodeId === node.id && !memory.decayed)
        .sort((a, b) => b.confidence - a.confidence);
      const topicColor = getColorForTopic(node.label);

      return {
        ...node,
        color:
          topicColor === "gray"
            ? fallbackRamps[index % fallbackRamps.length] ?? "gray"
            : topicColor,
        memories,
        topMemory: memories[0] ?? null,
        edgesOut: snapshot.edges.filter((edge) => edge.sourceId === node.id),
      };
    });
}

export function MapViews({ snapshot, compact = false }: MapViewsProps) {
  const [activeView, setActiveView] = useState<MapViewType>("river");
  const nodes = useMemo(() => enrichSnapshot(snapshot), [snapshot]);
  const memoryLabel = snapshot.memories.length === 1 ? "memory" : "memories";

  if (nodes.length === 0) {
    return (
      <section
        className="grid min-h-[360px] place-items-center rounded-bloom border"
        style={{
          background: "var(--map-surface)",
          borderColor: "var(--map-border)",
          color: "var(--map-text)",
        }}
      >
        <div className="px-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border border-blue-border bg-blue-bg p-3">
            <span className="block h-full w-full rounded-full bg-blue-border" />
          </div>
          <p className="font-serif text-[18px]" style={{ color: "var(--map-text)" }}>
            Your mind map is still forming
          </p>
          <p
            className="mt-2 max-w-[360px] text-[13px] leading-5"
            style={{ color: "var(--map-muted)" }}
          >
            Write and save a little more. Themes and memories will appear here as
            your entry takes shape.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-bloom border"
      style={{
        background: "var(--map-surface)",
        borderColor: "var(--map-border)",
        color: "var(--map-text)",
      }}
    >
      <div
        className="grid gap-3 border-b px-4 py-4 md:grid-cols-[1fr_auto_1fr] md:items-center md:px-6"
        style={{ borderColor: "var(--map-border)" }}
      >
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.11em]"
            style={{ color: "var(--map-faint)" }}
          >
            Mind map
          </p>
          <p className="mt-1 text-[12px]" style={{ color: "var(--map-muted)" }}>
            Today's entry - {nodes.length} theme{nodes.length === 1 ? "" : "s"} -{" "}
            {snapshot.memories.length} {memoryLabel}
          </p>
        </div>
        <div className="md:justify-self-center">
          <MapToggle active={activeView} onChange={setActiveView} />
        </div>
        <p
          className="hidden justify-self-end text-[11px] uppercase tracking-[0.08em] md:block"
          style={{ color: "var(--map-faint)" }}
        >
          {activeView === "river" ? "Chronological flow" : "Extracted memories"}
        </p>
      </div>

      <div className={compact ? "p-3" : "p-4 md:p-6"}>
        <div style={{ display: activeView === "river" ? "block" : "none" }}>
          <ThoughtRiver nodes={nodes} edges={snapshot.edges} />
        </div>
        <div style={{ display: activeView === "constellation" ? "block" : "none" }}>
          <InsightConstellation nodes={nodes} edges={snapshot.edges} />
        </div>
      </div>
    </section>
  );
}
