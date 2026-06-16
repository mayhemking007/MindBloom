import { useMemo, useRef, useState, type MouseEvent } from "react";
import type { GraphEdge, GraphMemory } from "@mindbloom/shared";

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
  memory: GraphMemory | null;
  nodeLabel: string;
}

const svgWidth = 640;
const svgHeight = 360;
const tooltipWidth = 220;

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
  return label.length > 20 ? `${label.slice(0, 17)}...` : label;
}

function edgeStroke(edge: GraphEdge): string {
  if (edge.type === "reentry") {
    return "var(--map-reentry)";
  }
  if (edge.type === "grafted") {
    return "var(--map-grafted)";
  }
  return "var(--map-line)";
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

export function InsightConstellation({ nodes, edges }: InsightConstellationProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    memory: null,
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
  const hasStars = groups.some((group) => group.stars.length > 0);

  function placeTooltip(event: MouseEvent, star: StarPoint) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    setTooltip({
      visible: true,
      x: Math.min(event.clientX - rect.left + 12, Math.max(12, rect.width - tooltipWidth)),
      y: Math.min(event.clientY - rect.top + 12, Math.max(12, rect.height - 126)),
      memory: star.memory,
      nodeLabel: star.node.label,
    });
  }

  return (
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
          className="block h-auto min-h-[250px] w-full"
        >
          <rect width={svgWidth} height={svgHeight} fill="var(--map-canvas)" />

          {edges.map((edge, index) => {
            const from = centerMap.get(edge.sourceId);
            const to = centerMap.get(edge.targetId);
            if (!from || !to) {
              return null;
            }
            return (
              <line
                key={`${edge.sourceId}-${edge.targetId}-${index}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={edgeStroke(edge)}
                strokeWidth={edge.type === "reentry" ? 1.8 : 1.1}
                strokeDasharray={edgeDash(edge)}
              opacity={edge.type === "reentry" ? 0.72 : 0.42}
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
                strokeWidth={0.8}
                opacity={0.48}
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
                  r={4}
                  fill={ramp.bright}
                  opacity={0.45}
                />
                <text
                  x={group.cx}
                  y={group.cy - 24}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill={ramp.bright}
                  opacity={0.86}
                  style={{ pointerEvents: "none" }}
                >
                  {truncateLabel(group.node.label)}
                </text>
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
                onMouseEnter={(event) => placeTooltip(event, star)}
                onMouseMove={(event) => placeTooltip(event, star)}
                onMouseLeave={() => setTooltip((current) => ({ ...current, visible: false }))}
              >
                <title>{star.memory.value}</title>
              </circle>
            )),
          )}

          {!hasStars ? (
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

        {tooltip.visible && tooltip.memory ? (
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
              {tooltip.memory.memoryType}
            </p>
            <p className="mt-1 font-medium" style={{ color: "var(--map-muted)" }}>
              {tooltip.nodeLabel}
            </p>
            <p className="mt-1">{tooltip.memory.value}</p>
          </div>
        ) : null}
      </div>
      <div className="mt-3">
        <MapLegend view="constellation" />
      </div>
    </div>
  );
}
