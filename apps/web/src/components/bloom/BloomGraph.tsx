import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphEdge, GraphNode } from "@mindbloom/shared";

import { colorClasses, getColorForTopic } from "../../lib/topicColors";

interface BloomGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface SimNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
  type: string;
  weight: number;
}

function nodeRadius(node: GraphNode): number {
  return Math.min(28, 10 + node.topicOrder * 3);
}

function getEdgeClasses(type: string): string {
  switch (type) {
    case "semantic":
      return "stroke-gray-border opacity-50 [stroke-dasharray:4_3]";
    case "reentry":
      return "stroke-amber-border opacity-70";
    case "grafted":
      return "stroke-purple-border opacity-60 [stroke-dasharray:2_2]";
    default:
      return "stroke-gray-border opacity-40";
  }
}

function resolveNodeId(value: string | number | SimNode | undefined): string {
  if (!value) {
    return "";
  }
  return typeof value === "object" ? value.id : String(value);
}

function themeKindLabel(node: GraphNode): string {
  if (node.kindLabel) {
    return node.kindLabel;
  }
  return node.graftOrigin ? "Brought-in context" : "Theme";
}

export function BloomGraph({ nodes, edges }: BloomGraphProps) {
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simEdges, setSimEdges] = useState<SimEdge[]>([]);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (nodes.length === 0) {
      setSimNodes([]);
      setSimEdges([]);
      return;
    }

    const width = 360;
    const height = 260;
    const nextNodes: SimNode[] = nodes.map((node) => ({ ...node }));
    const nextEdges: SimEdge[] = edges.map((edge) => ({
      source: edge.sourceId,
      target: edge.targetId,
      type: edge.type,
      weight: edge.weight,
    }));

    const simulation = d3
      .forceSimulation(nextNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimEdge>(nextEdges)
          .id((node) => node.id)
          .distance(70)
          .strength(0.6),
      )
      .force("charge", d3.forceManyBody().strength(-180))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide<SimNode>().radius((node) => nodeRadius(node) + 8),
      );

    simulation.on("tick", () => {
      if (!mountedRef.current) {
        return;
      }
      setSimNodes([...nextNodes]);
      setSimEdges([...nextEdges]);
    });

    return () => {
      simulation.stop();
    };
  }, [edges, nodes]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const connectedIds = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>();
    }

    const ids = new Set<string>([selectedNodeId]);
    for (const edge of simEdges) {
      const sourceId = resolveNodeId(edge.source);
      const targetId = resolveNodeId(edge.target);
      if (sourceId === selectedNodeId) {
        ids.add(targetId);
      }
      if (targetId === selectedNodeId) {
        ids.add(sourceId);
      }
    }
    return ids;
  }, [selectedNodeId, simEdges]);

  if (nodes.length === 0) {
    return (
      <div className="grid h-[260px] place-items-center rounded-bloom border border-bloom-border bg-bloom-surface">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 rounded-full border border-bloom-border-mid bg-gray-bg" />
          <p className="font-serif text-[14px] text-bloom-text-tertiary">
            Your mind map is still forming
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        viewBox="0 0 360 260"
        role="img"
        aria-label="Session mind map"
        className="h-[260px] w-full rounded-bloom border border-bloom-border bg-bloom-surface"
        onClick={() => setSelectedNodeId(null)}
      >
        {simEdges.map((edge, index) => {
          const source = edge.source as SimNode;
          const target = edge.target as SimNode;
          const sourceId = resolveNodeId(edge.source);
          const targetId = resolveNodeId(edge.target);
          const isConnected =
            !selectedNodeId ||
            sourceId === selectedNodeId ||
            targetId === selectedNodeId;

          return (
            <line
              key={`${sourceId}-${targetId}-${index}`}
              x1={source.x ?? 0}
              y1={source.y ?? 0}
              x2={target.x ?? 0}
              y2={target.y ?? 0}
              strokeWidth={edge.type === "reentry" ? 1.5 : 1}
              className={[
                getEdgeClasses(edge.type),
                selectedNodeId && !isConnected ? "opacity-10" : "",
              ].join(" ")}
            />
          );
        })}

        {simNodes.map((node) => {
          const color = colorClasses[getColorForTopic(node.label)];
          const isDimmed = selectedNodeId && !connectedIds.has(node.id);

          return (
            <g
              key={node.id}
              transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
              className={isDimmed ? "opacity-30" : ""}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedNodeId(node.id);
              }}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <circle
                r={nodeRadius(node)}
                className={color.fill}
                stroke="white"
                strokeWidth={2}
              />
              <text
                y={nodeRadius(node) + 14}
                textAnchor="middle"
                className="fill-bloom-text-secondary text-[9px]"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredNode ? (
        <div className="pointer-events-none absolute left-3 top-3 max-w-[220px] rounded-bloom-sm border border-bloom-border bg-bloom-surface px-3 py-2 shadow-sm">
          <p className="text-[12px] font-medium text-bloom-text-primary">
            {hoveredNode.label}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-bloom-text-secondary">
            {hoveredNode.summary.slice(0, 80)}
            {hoveredNode.summary.length > 80 ? "..." : ""}
          </p>
        </div>
      ) : null}

      {selectedNode ? (
        <div className="mt-3 rounded-bloom border border-bloom-border bg-bloom-surface p-3">
          <p className="text-[11px] font-medium uppercase text-bloom-text-tertiary">
            {themeKindLabel(selectedNode)}
          </p>
          <p className="text-[13px] font-medium text-bloom-text-primary">
            {selectedNode.label}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-bloom-text-secondary">
            {selectedNode.summary}
          </p>
          {selectedNode.graftOrigin ? (
            <p className="mt-2 text-[11px] text-bloom-text-tertiary">
              Brought in from {selectedNode.graftOrigin.sourceLabel ?? "an earlier entry"}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
