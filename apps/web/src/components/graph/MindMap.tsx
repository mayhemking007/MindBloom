import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphEdge, GraphNode } from "@mindbloom/shared";

import { colorClasses, getColorForTopic } from "../../lib/topicColors";

interface MindMapProps {
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

const legendItems = [
  { label: "Temporal", className: "border-gray-border" },
  { label: "Semantic", className: "border-gray-border border-dashed" },
  { label: "Reentry", className: "border-amber-border" },
  { label: "Grafted", className: "border-purple-border border-dashed" },
];

function nodeRadius(node: GraphNode): number {
  return Math.min(34, 12 + node.topicOrder * 3);
}

function edgeClassName(type: string): string {
  switch (type) {
    case "semantic":
      return "stroke-gray-border opacity-50 [stroke-dasharray:6_4]";
    case "reentry":
      return "stroke-amber-border opacity-75";
    case "grafted":
      return "stroke-purple-border opacity-70 [stroke-dasharray:3_3]";
    default:
      return "stroke-gray-border opacity-45";
  }
}

function resolveNodeId(value: string | number | SimNode | undefined): string {
  if (!value) {
    return "";
  }
  return typeof value === "object" ? value.id : String(value);
}

export function MindMap({ nodes, edges }: MindMapProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 390, height: 560 });
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simEdges, setSimEdges] = useState<SimEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateDimensions = () => {
      const width = Math.max(390, Math.floor(container.clientWidth));
      setDimensions({
        width,
        height: width >= 760 ? 660 : 560,
      });
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (nodes.length === 0) {
      setSimNodes([]);
      setSimEdges([]);
      return;
    }

    const { width, height } = dimensions;
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
          .distance(92)
          .strength(0.55),
      )
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.03))
      .force("y", d3.forceY(height / 2).strength(0.04))
      .force(
        "collision",
        d3.forceCollide<SimNode>().radius((node) => nodeRadius(node) + 16),
      );

    simulation.on("tick", () => {
      if (!mountedRef.current) {
        return;
      }

      for (const node of nextNodes) {
        node.x = Math.max(42, Math.min(width - 42, node.x ?? width / 2));
        node.y = Math.max(44, Math.min(height - 70, node.y ?? height / 2));
      }

      setSimNodes([...nextNodes]);
      setSimEdges([...nextEdges]);
    });

    return () => {
      simulation.stop();
    };
  }, [dimensions, edges, nodes]);

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
      <section ref={containerRef} className="grid min-h-[560px] place-items-center rounded-bloom border border-bloom-border bg-bloom-surface md:min-h-[660px]">
        <div className="px-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border border-bloom-border-mid bg-gray-bg" />
          <p className="font-serif text-[18px] text-bloom-text-primary">
            Your mind map is still forming
          </p>
          <p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">
            Chat for a bit, then return here to see the graph take shape.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section ref={containerRef} className="relative min-h-[560px] overflow-hidden rounded-bloom border border-bloom-border bg-bloom-surface md:min-h-[660px]">
      <svg
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        role="img"
        aria-label="Full session mind map"
        className="h-[560px] w-full md:h-[660px]"
        onClick={() => setSelectedNodeId(null)}
      >
        {simEdges.map((edge, index) => {
          const source = edge.source as SimNode;
          const target = edge.target as SimNode;
          const sourceId = resolveNodeId(edge.source);
          const targetId = resolveNodeId(edge.target);
          const connected =
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
              strokeWidth={edge.type === "reentry" ? 2 : 1.2}
              className={[
                edgeClassName(edge.type),
                selectedNodeId && !connected ? "opacity-10" : "",
              ].join(" ")}
            />
          );
        })}

        {simNodes.map((node) => {
          const color = colorClasses[getColorForTopic(node.label)];
          const dimmed = selectedNodeId && !connectedIds.has(node.id);

          return (
            <g
              key={node.id}
              transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
              className={dimmed ? "opacity-25" : ""}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedNodeId(node.id);
              }}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <circle
                r={nodeRadius(node)}
                className={color.dot}
                stroke="white"
                strokeWidth={2.4}
              />
              <text
                y={nodeRadius(node) + 16}
                textAnchor="middle"
                className="fill-bloom-text-secondary text-[10px]"
              >
                {node.label.length > 18
                  ? `${node.label.slice(0, 16)}...`
                  : node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredNode ? (
        <div className="pointer-events-none absolute left-3 top-3 max-w-[240px] rounded-bloom-sm border border-bloom-border bg-bloom-surface px-3 py-2 shadow-sm">
          <p className="text-[12px] font-medium text-bloom-text-primary">
            {hoveredNode.label}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-bloom-text-secondary">
            {hoveredNode.summary.slice(0, 120)}
            {hoveredNode.summary.length > 120 ? "..." : ""}
          </p>
        </div>
      ) : null}

      <div className="absolute bottom-3 left-3 rounded-bloom-sm border border-bloom-border bg-bloom-surface/95 px-3 py-2">
        <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-bloom-text-tertiary">
          Edges
        </p>
        <div className="grid gap-1.5">
          {legendItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 text-[11px] text-bloom-text-secondary"
            >
              <span
                className={[
                  "block w-7 border-t",
                  item.className,
                ].join(" ")}
              />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {selectedNode ? (
        <aside className="absolute bottom-3 right-3 max-h-[220px] w-[220px] overflow-y-auto rounded-bloom border border-bloom-border bg-bloom-surface p-3 shadow-sm">
          <p className="text-[13px] font-medium text-bloom-text-primary">
            {selectedNode.label}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-bloom-text-secondary">
            {selectedNode.summary}
          </p>
          {selectedNode.graftOrigin ? (
            <p className="mt-2 text-[11px] text-bloom-text-tertiary">
              Grafted from {selectedNode.graftOrigin.sourceSessionId}
            </p>
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}
