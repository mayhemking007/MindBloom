import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphEdge } from "@mindbloom/shared";

import { buildRiverLayout, selectedJourney } from "../../lib/riverLayout";
import { constellationRamps } from "../../lib/topicColors";
import { RiverCard } from "./RiverCard";
import { RiverDetailPanel } from "./RiverDetailPanel";
import type { EnrichedMapNode } from "./types";

interface ThoughtRiverProps {
  nodes: EnrichedMapNode[];
  edges: GraphEdge[];
}

function specialPathColor(kind: "flow" | "branch" | "return" | "grafted"): string | null {
  if (kind === "return") {
    return "var(--map-reentry)";
  }
  if (kind === "grafted") {
    return "var(--map-grafted)";
  }
  return null;
}

function gradientId(pathId: string): string {
  return `river-gradient-${pathId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function ThoughtRiver({ nodes, edges }: ThoughtRiverProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(760);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const layout = useMemo(
    () => buildRiverLayout(nodes, edges, canvasWidth),
    [canvasWidth, edges, nodes],
  );
  const journey = useMemo(
    () => selectedJourney(selectedId, layout.parentByNodeId),
    [layout.parentByNodeId, selectedId],
  );
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedNode = selectedId ? nodeById.get(selectedId) ?? null : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const updateWidth = () => {
      const nextWidth = Math.round(canvas.getBoundingClientRect().width || canvas.clientWidth);
      if (nextWidth > 0) {
        setCanvasWidth(nextWidth);
      }
    };
    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(updateWidth);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={
        selectedNode ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]" : ""
      }
    >
      <div
        ref={canvasRef}
        className="relative min-w-0 overflow-hidden rounded-bloom border"
        style={{
          height: layout.height,
          background: "var(--map-canvas)",
          borderColor: "var(--map-border)",
        }}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${canvasWidth} ${layout.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          data-testid="thought-river-paths"
        >
          <defs>
            {layout.paths.map((path) => {
              const source = nodeById.get(path.fromId);
              const target = nodeById.get(path.toId);
              if (specialPathColor(path.kind) || !source || !target) {
                return null;
              }
              return (
                <linearGradient key={path.id} id={gradientId(path.id)} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor={constellationRamps[source.color].mid} />
                  <stop offset="1" stopColor={constellationRamps[target.color].mid} />
                </linearGradient>
              );
            })}
          </defs>
          {layout.paths.map((path) => {
            const isActive =
              selectedId !== null &&
              path.parentRelation &&
              journey.relationKeys.has(`${path.fromId}:${path.toId}`);
            const isDimmed = selectedId !== null && !isActive;
            const stroke =
              specialPathColor(path.kind) ?? `url(#${gradientId(path.id)})`;

            return (
              <g key={path.id}>
                <path
                  d={path.d}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={isActive ? 4 : path.kind === "flow" ? 2.8 : 2.1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isDimmed ? 0.13 : path.kind === "flow" ? 0.78 : 0.58}
                  data-river-path={path.kind}
                />
                {isActive ? (
                  <path
                    d={path.d}
                    fill="none"
                    stroke="var(--map-card)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    pathLength="1"
                    className="river-flow-highlight"
                    aria-hidden="true"
                  />
                ) : null}
              </g>
            );
          })}
        </svg>

        {layout.nodes.map((item) => {
          const isSelected = selectedId === item.node.id;
          const isDimmed = selectedId !== null && !journey.nodeIds.has(item.node.id);
          return (
            <div
              key={item.node.id}
              className="absolute"
              style={{
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height,
              }}
            >
              <RiverCard
                node={item.node}
                isSelected={isSelected}
                isDimmed={isDimmed}
                onSelect={() => setSelectedId(item.node.id)}
              />
            </div>
          );
        })}
      </div>

      {selectedNode ? (
        <RiverDetailPanel node={selectedNode} onClose={() => setSelectedId(null)} />
      ) : null}
    </div>
  );
}
