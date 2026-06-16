import { useMemo, useState } from "react";
import type { GraphSnapshotResponse } from "@mindbloom/shared";

import { getColorForTopic } from "../../lib/topicColors";
import { InsightConstellation } from "./InsightConstellation";
import { MapToggle } from "./MapToggle";
import { ThoughtRiver } from "./ThoughtRiver";
import type { EnrichedMapNode, MapViewType, MapViewsProps } from "./types";

function enrichSnapshot(snapshot: GraphSnapshotResponse): EnrichedMapNode[] {
  return [...snapshot.nodes]
    .sort((a, b) => a.topicOrder - b.topicOrder)
    .map((node) => {
      const memories = snapshot.memories
        .filter((memory) => memory.topicNodeId === node.id && !memory.decayed)
        .sort((a, b) => b.confidence - a.confidence);

      return {
        ...node,
        color: getColorForTopic(node.label),
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
      <section className="grid min-h-[360px] place-items-center rounded-bloom border border-bloom-border bg-bloom-surface">
        <div className="px-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border border-blue-border bg-blue-bg p-3">
            <span className="block h-full w-full rounded-full bg-blue-border" />
          </div>
          <p className="font-serif text-[18px] text-bloom-text-primary">
            Your mind map is still forming
          </p>
          <p className="mt-2 max-w-[360px] text-[13px] leading-5 text-bloom-text-secondary">
            Write and save a little more. Themes and memories will appear here as
            your entry takes shape.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-bloom border border-bloom-border bg-bloom-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bloom-border px-3 py-3 md:px-4">
        <div>
          <p className="label-text">Map view</p>
          <p className="mt-1 text-[12px] text-bloom-text-secondary">
            {nodes.length} theme{nodes.length === 1 ? "" : "s"} -{" "}
            {snapshot.memories.length} {memoryLabel}
          </p>
        </div>
        <MapToggle active={activeView} onChange={setActiveView} />
      </div>

      <div className={compact ? "p-3" : "p-4 md:p-5"}>
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
