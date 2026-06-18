import { useMemo, useRef, useState, type MouseEvent } from "react";
import type { GraphEdge, GraphMemory, MemoryType } from "@mindbloom/shared";
import { CheckSquare, HelpCircle, Lightbulb, Link, Pin } from "lucide-react";

import { computeConstellationLayout, type StarPoint } from "../../lib/mapLayout";
import { constellationRamps } from "../../lib/topicColors";
import { MapLegend } from "./MapLegend";
import type { EnrichedMapNode } from "./types";

interface InsightConstellationProps {
  nodes: EnrichedMapNode[];
  edges: GraphEdge[];
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  eyebrow: string;
  value: string;
  nodeLabel: string;
}

const svgWidth = 760;
const svgHeight = 430;
const tooltipWidth = 220;
const memoryTypeLabels: Record<MemoryType, string> = {
  insight: "Insight",
  question: "Question",
  fact: "Fact",
  task: "Task",
  reference: "Reference",
};
const memoryIcon: Record<MemoryType, typeof Lightbulb> = {
  insight: Lightbulb,
  question: HelpCircle,
  fact: Pin,
  task: CheckSquare,
  reference: Link,
};

function starFill(star: StarPoint): string {
  const ramp = constellationRamps[star.node.color];
  if (star.memory.memoryType === "insight") {
    return ramp.bright;
  }
  if (star.memory.memoryType === "question" || star.memory.memoryType === "task") {
    return ramp.mid;
  }
  return ramp.dim;
}

function truncateLabel(label: string): string {
  return label.length > 18 ? `${label.slice(0, 15)}...` : label;
}

function edgeStroke(
  edge: GraphEdge,
  sourceNode: EnrichedMapNode | undefined,
): string {
  if (edge.type === "reentry") {
    return "var(--map-reentry)";
  }
  if (edge.type === "grafted") {
    return "var(--map-grafted)";
  }
  const ramp = sourceNode ? constellationRamps[sourceNode.color] : null;
  return ramp?.mid ?? "var(--map-line)";
}

function edgeDash(edge: GraphEdge): string | undefined {
  if (edge.type === "semantic") {
    return "4 4";
  }
  if (edge.type === "grafted") {
    return "2 4";
  }
  return undefined;
}

function groupMemories(memories: GraphMemory[]): Array<[MemoryType, GraphMemory[]]> {
  const grouped = new Map<MemoryType, GraphMemory[]>();
  for (const memory of memories) {
    grouped.set(memory.memoryType, [...(grouped.get(memory.memoryType) ?? []), memory]);
  }
  return [...grouped.entries()];
}

export function InsightConstellation({ nodes, edges }: InsightConstellationProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    label: "",
    eyebrow: "",
    value: "",
    nodeLabel: "",
  });

  const groups = useMemo(
    () => computeConstellationLayout(nodes, svgWidth, svgHeight),
    [nodes],
  );
  const centerMap = useMemo(
    () => new Map(groups.map((group) => [group.node.id, { x: group.cx, y: group.cy }])),
    [groups],
  );
  const groupMap = useMemo(
    () => new Map(groups.map((group) => [group.node.id, group])),
    [groups],
  );
  const selectedGroup =
    groups.find((group) => group.node.id === selectedNodeId) ?? null;
  const hasStars = groups.some((group) => group.stars.length > 0);

  function tooltipPosition(event: MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }
    return {
      x: Math.min(event.clientX - rect.left + 12, Math.max(12, rect.width - tooltipWidth)),
      y: Math.min(event.clientY - rect.top + 12, Math.max(12, rect.height - 126)),
    };
  }

  function placeStarTooltip(event: MouseEvent, star: StarPoint) {
    const position = tooltipPosition(event);
    if (!position) {
      return;
    }

    setTooltip({
      visible: true,
      ...position,
      label: star.memory.memoryType,
      eyebrow: "Extracted memory",
      value: star.memory.value,
      nodeLabel: star.node.label,
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <div
          ref={wrapRef}
          className="relative overflow-hidden rounded-bloom border"
          style={{
            background: "var(--map-canvas)",
            borderColor: "var(--map-border)",
          }}
        >
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            role="img"
            aria-label="Insight constellation map"
            className="block h-auto min-h-[300px] w-full"
          >
            <rect width={svgWidth} height={svgHeight} fill="var(--map-canvas)" />

          {edges.map((edge, index) => {
            const from = centerMap.get(edge.sourceId);
            const to = centerMap.get(edge.targetId);
            const sourceGroup = groupMap.get(edge.sourceId);
            if (!from || !to) {
              return null;
            }
            const isReentry = edge.type === "reentry";
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2 - (isReentry ? 42 : 16);
            return (
              <path
                key={`${edge.sourceId}-${edge.targetId}-${index}`}
                d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
                fill="none"
                stroke={edgeStroke(edge, sourceGroup?.node)}
                strokeWidth={isReentry ? 2.4 : 1.45}
                strokeDasharray={edgeDash(edge)}
                opacity={isReentry ? 0.84 : 0.42}
              />
            );
          })}

          {groups.map((group) => {
            const ramp = constellationRamps[group.node.color];
            return group.stars.map((star) => (
              <line
                key={`${star.memory.id}-spoke`}
                x1={group.cx}
                y1={group.cy}
                x2={star.x}
                y2={star.y}
                stroke={ramp.mid}
                strokeWidth={0.9}
                opacity={0.5}
              />
            ));
          })}

          {groups.map((group) => {
            const ramp = constellationRamps[group.node.color];
            return (
              <g key={group.node.id}>
                <circle
                  cx={group.cx}
                  cy={group.cy}
                  r={group.radius + 8}
                  fill={ramp.dim}
                  opacity={selectedNodeId === group.node.id ? 0.18 : 0.08}
                  style={{ pointerEvents: "none" }}
                />
                <circle
                  cx={group.cx}
                  cy={group.cy}
                  r={group.radius + 3}
                  fill="none"
                  stroke={ramp.mid}
                  strokeWidth={selectedNodeId === group.node.id ? 1.8 : 1}
                  opacity={selectedNodeId === group.node.id ? 0.78 : 0.42}
                  style={{ pointerEvents: "none" }}
                />
                <circle
                  cx={group.cx}
                  cy={group.cy}
                  r={group.radius}
                  fill={ramp.bright}
                  opacity={0.58 + group.importance * 0.28}
                  className="cursor-pointer transition-opacity hover:opacity-90"
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${group.node.label}`}
                  onClick={() => setSelectedNodeId(group.node.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedNodeId(group.node.id);
                    }
                  }}
                  onMouseEnter={() => setHoveredNodeId(group.node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                />
                {selectedNodeId === group.node.id ||
                hoveredNodeId === group.node.id ||
                group.importance > 0.36 ? (
                  <text
                    x={group.cx}
                    y={group.cy - group.radius - 14}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={600}
                    fill={ramp.bright}
                    opacity={selectedNodeId === group.node.id ? 0.95 : 0.72}
                    style={{ pointerEvents: "none" }}
                  >
                    {truncateLabel(group.node.label)}
                  </text>
                ) : null}
              </g>
            );
          })}

          {groups.flatMap((group) =>
            group.stars.map((star) => (
              <circle
                key={star.memory.id}
                cx={star.x}
                cy={star.y}
                r={star.r}
                fill={starFill(star)}
                opacity={star.opacity}
                className="cursor-pointer transition-opacity hover:opacity-100"
                onClick={() => setSelectedNodeId(star.node.id)}
                onMouseEnter={(event) => placeStarTooltip(event, star)}
                onMouseMove={(event) => placeStarTooltip(event, star)}
                onMouseLeave={() => setTooltip((current) => ({ ...current, visible: false }))}
              >
                <title>{star.memory.value}</title>
              </circle>
            )),
          )}

          {!hasStars && groups.length === 0 ? (
            <text
              x={svgWidth / 2}
              y={svgHeight / 2}
              textAnchor="middle"
              fontSize={14}
              fill="var(--map-faint)"
            >
              Memories will appear here as stars.
            </text>
          ) : null}
          </svg>

          {tooltip.visible ? (
            <div
              className="pointer-events-none absolute z-10 max-w-[220px] rounded-bloom-sm border px-3 py-2 text-[11px] leading-4 shadow-sm"
              style={{
                left: tooltip.x,
                top: tooltip.y,
                background: "var(--map-card)",
                borderColor: "var(--map-card-border)",
                color: "var(--map-text)",
              }}
            >
              <p
                className="text-[10px] font-medium uppercase tracking-[0.06em]"
                style={{ color: "var(--map-faint)" }}
              >
                {tooltip.eyebrow}
              </p>
              <p className="mt-1 font-medium" style={{ color: "var(--map-muted)" }}>
                {tooltip.nodeLabel} - {tooltip.label}
              </p>
              <p className="mt-1">{tooltip.value}</p>
            </div>
          ) : null}
        </div>
        <div className="mt-3">
          <MapLegend view="constellation" />
        </div>
      </div>
      <aside
        className="rounded-bloom border p-4"
        style={{
          background: "var(--map-card)",
          borderColor: "var(--map-card-border)",
          color: "var(--map-text)",
        }}
      >
        {selectedGroup ? (
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.09em]"
              style={{ color: "var(--map-faint)" }}
            >
              Topic detail
            </p>
            <h3 className="mt-2 text-[15px] font-semibold leading-5">
              {selectedGroup.node.label}
            </h3>
            <p
              className="mt-2 text-[12px] leading-5"
              style={{ color: "var(--map-muted)" }}
            >
              {selectedGroup.node.summary}
            </p>
            <div
              className="mt-4 grid grid-cols-2 gap-2 border-y py-3 text-[11px]"
              style={{ borderColor: "var(--map-border)", color: "var(--map-muted)" }}
            >
              <span>
                <strong style={{ color: "var(--map-text)" }}>
                  {selectedGroup.node.memories.length}
                </strong>{" "}
                memories
              </span>
              <span>
                <strong style={{ color: "var(--map-text)" }}>
                  {Math.round(selectedGroup.node.driftScore * 100)}%
                </strong>{" "}
                drift
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {selectedGroup.node.memories.length === 0 ? (
                <p
                  className="text-[12px] leading-5"
                  style={{ color: "var(--map-faint)" }}
                >
                  No extracted memories for this topic yet.
                </p>
              ) : (
                groupMemories(selectedGroup.node.memories).map(([type, memories]) => {
                  const Icon = memoryIcon[type];
                  return (
                    <section key={type}>
                      <p
                        className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                        style={{ color: "var(--map-faint)" }}
                      >
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {memoryTypeLabels[type]}
                      </p>
                      <div className="space-y-2">
                        {memories.map((memory) => (
                          <p
                            key={memory.id}
                            className="rounded-bloom-sm border px-2.5 py-2 text-[12px] leading-5"
                            style={{
                              background: "var(--map-canvas)",
                              borderColor: "var(--map-border)",
                              color: "var(--map-muted)",
                            }}
                          >
                            {memory.value}
                          </p>
                        ))}
                      </div>
                    </section>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <p className="text-[12px]" style={{ color: "var(--map-faint)" }}>
            Select a topic to inspect its summary and extracted memories.
          </p>
        )}
      </aside>
    </div>
  );
}
