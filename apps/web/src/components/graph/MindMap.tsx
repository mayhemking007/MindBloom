import { LocateFixed, RotateCcw } from "lucide-react";
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
  connectionLabel?: string;
  helperText?: string;
  weight: number;
}

type MapScope = "current" | "context" | "all";
type Density = "focused" | "balanced" | "expanded";

const scopeOptions: Array<{ value: MapScope; label: string }> = [
  { value: "current", label: "Current entry" },
  { value: "context", label: "Brought-in context" },
  { value: "all", label: "All visible themes" },
];

const densityOptions: Array<{ value: Density; label: string; limit: number }> = [
  { value: "focused", label: "Fewer", limit: 6 },
  { value: "balanced", label: "Balanced", limit: 12 },
  { value: "expanded", label: "More", limit: 24 },
];

const legendItems = [
  { label: "Related thought", className: "border-blue-border" },
  { label: "Returning thought", className: "border-amber-border" },
  { label: "Brought-in context", className: "border-purple-border border-dashed" },
  { label: "Connection", className: "border-gray-border" },
];

function nodeRadius(node: GraphNode): number {
  return Math.min(34, 13 + node.topicOrder * 3);
}

function edgeClassName(type: string): string {
  switch (type) {
    case "semantic":
      return "stroke-blue-border opacity-55";
    case "reentry":
      return "stroke-amber-border opacity-80";
    case "grafted":
      return "stroke-purple-border opacity-75 [stroke-dasharray:4_3]";
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

function truncateLabel(label: string): string {
  return label.length > 18 ? `${label.slice(0, 16)}...` : label;
}

function themeKind(node: GraphNode): NonNullable<GraphNode["kind"]> {
  if (node.kind) {
    return node.kind;
  }
  return node.graftOrigin ? "brought-in-context" : "theme";
}

function themeKindLabel(node: GraphNode): string {
  if (node.kindLabel) {
    return node.kindLabel;
  }
  return themeKind(node) === "brought-in-context"
    ? "Brought-in context"
    : "Theme";
}

function connectionLabel(edge: GraphEdge | SimEdge): string {
  if (edge.connectionLabel) {
    return edge.connectionLabel;
  }
  if (edge.type === "semantic") {
    return "Related thought";
  }
  if (edge.type === "reentry") {
    return "Returning thought";
  }
  if (edge.type === "grafted") {
    return "Brought-in context";
  }
  return "Connection";
}

function byThemePriority(a: GraphNode, b: GraphNode): number {
  const aKind = themeKind(a);
  const bKind = themeKind(b);

  if (aKind !== bKind) {
    if (aKind === "returning-theme") {
      return -1;
    }
    if (bKind === "returning-theme") {
      return 1;
    }
    if (aKind === "brought-in-context") {
      return -1;
    }
    if (bKind === "brought-in-context") {
      return 1;
    }
  }

  return a.topicOrder - b.topicOrder;
}

function themeIntro(node: GraphNode): string {
  if (node.graftOrigin) {
    return `Brought in from ${node.graftOrigin.sourceLabel ?? "an earlier entry"}.`;
  }
  return node.helperText ?? "A thought MindBloom noticed in this entry.";
}

export function MindMap({ nodes, edges }: MindMapProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 390, height: 560 });
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simEdges, setSimEdges] = useState<SimEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [scope, setScope] = useState<MapScope>("all");
  const [density, setDensity] = useState<Density>("balanced");
  const [highlightReturning, setHighlightReturning] = useState(true);
  const [focusSelected, setFocusSelected] = useState(true);
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

  const visibleNodes = useMemo(() => {
    const scopedNodes = nodes.filter((node) => {
      if (scope === "current") {
        return themeKind(node) !== "brought-in-context";
      }
      if (scope === "context") {
        return themeKind(node) === "brought-in-context";
      }
      return true;
    });
    const limit =
      densityOptions.find((option) => option.value === density)?.limit ?? 12;

    return [...scopedNodes].sort(byThemePriority).slice(0, limit);
  }, [density, nodes, scope]);

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  );

  const visibleEdges = useMemo(
    () =>
      edges.filter(
        (edge) =>
          visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId),
      ),
    [edges, visibleNodeIds],
  );

  useEffect(() => {
    if (visibleNodes.length === 0) {
      setSimNodes([]);
      setSimEdges([]);
      return;
    }

    const { width, height } = dimensions;
    const nextNodes: SimNode[] = visibleNodes.map((node) => ({ ...node }));
    const nextEdges: SimEdge[] = visibleEdges.map((edge) => ({
      source: edge.sourceId,
      target: edge.targetId,
      type: edge.type,
      connectionLabel: edge.connectionLabel,
      helperText: edge.helperText,
      weight: edge.weight,
    }));

    const simulation = d3
      .forceSimulation(nextNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimEdge>(nextEdges)
          .id((node) => node.id)
          .distance(102)
          .strength(0.5),
      )
      .force("charge", d3.forceManyBody().strength(-280))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.035))
      .force("y", d3.forceY(height / 2).strength(0.04))
      .force(
        "collision",
        d3.forceCollide<SimNode>().radius((node) => nodeRadius(node) + 18),
      );

    simulation.on("tick", () => {
      if (!mountedRef.current) {
        return;
      }

      for (const node of nextNodes) {
        node.x = Math.max(48, Math.min(width - 48, node.x ?? width / 2));
        node.y = Math.max(52, Math.min(height - 82, node.y ?? height / 2));
      }

      setSimNodes([...nextNodes]);
      setSimEdges([...nextEdges]);
    });

    return () => {
      simulation.stop();
    };
  }, [dimensions, visibleEdges, visibleNodes]);

  const selectedNode = useMemo(
    () => visibleNodes.find((node) => node.id === selectedNodeId) ?? null,
    [selectedNodeId, visibleNodes],
  );

  const selectedConnections = useMemo(() => {
    if (!selectedNodeId) {
      return [];
    }

    return visibleEdges.filter(
      (edge) => edge.sourceId === selectedNodeId || edge.targetId === selectedNodeId,
    );
  }, [selectedNodeId, visibleEdges]);

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

  function resetView() {
    setScope("all");
    setDensity("balanced");
    setHighlightReturning(true);
    setFocusSelected(true);
    setSelectedNodeId(null);
  }

  if (nodes.length === 0) {
    return (
      <section
        ref={containerRef}
        className="grid min-h-[560px] place-items-center rounded-bloom border border-bloom-border bg-bloom-surface md:min-h-[660px]"
      >
        <div className="px-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-blue-border bg-blue-bg">
            <span className="h-3 w-3 rounded-full bg-blue-border" />
          </div>
          <p className="font-serif text-[18px] text-bloom-text-primary">
            Your mind map is still forming
          </p>
          <p className="mt-2 max-w-[360px] text-[13px] leading-5 text-bloom-text-secondary">
            Write a little, save your entry, or ask Bloom a question. Themes will
            appear here as your thinking takes shape.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section ref={containerRef} className="relative overflow-hidden rounded-bloom border border-bloom-border bg-bloom-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bloom-border px-3 py-3 md:px-4">
        <div className="flex flex-wrap gap-2">
          {scopeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setScope(option.value);
                setSelectedNodeId(null);
              }}
              className={[
                "h-9 rounded-bloom-sm border px-3 text-[12px] font-medium",
                scope === option.value
                  ? "border-bloom-accent bg-bloom-accent-bg text-bloom-accent"
                  : "border-bloom-border bg-bloom-bg text-bloom-text-secondary",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-bloom-sm border border-bloom-border bg-bloom-bg p-1">
            {densityOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDensity(option.value)}
                className={[
                  "h-7 rounded-bloom-sm px-2.5 text-[11px]",
                  density === option.value
                    ? "bg-bloom-surface text-bloom-text-primary shadow-sm"
                    : "text-bloom-text-tertiary",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setHighlightReturning((current) => !current)}
            className={[
              "h-9 rounded-bloom-sm border px-3 text-[12px]",
              highlightReturning
                ? "border-amber-border bg-amber-bg text-amber-text"
                : "border-bloom-border bg-bloom-bg text-bloom-text-secondary",
            ].join(" ")}
          >
            Returning themes
          </button>
          <button
            type="button"
            onClick={() => setFocusSelected((current) => !current)}
            aria-label="Focus selected theme"
            className={[
              "grid h-9 w-9 place-items-center rounded-bloom-sm border",
              focusSelected
                ? "border-blue-border bg-blue-bg text-blue-text"
                : "border-bloom-border bg-bloom-bg text-bloom-text-secondary",
            ].join(" ")}
          >
            <LocateFixed className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={resetView}
            aria-label="Reset map view"
            className="grid h-9 w-9 place-items-center rounded-bloom-sm border border-bloom-border bg-bloom-bg text-bloom-text-secondary"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {visibleNodes.length === 0 ? (
        <div className="grid min-h-[560px] place-items-center md:min-h-[660px]">
          <div className="px-8 text-center">
            <p className="font-serif text-[18px] text-bloom-text-primary">
              Nothing to show in this view yet
            </p>
            <p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">
              Try all visible themes, or bring previous context into this entry.
            </p>
          </div>
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            role="img"
            aria-label="Mind map themes and connections"
            className="h-[560px] w-full bg-bloom-surface md:h-[660px]"
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
                  strokeWidth={edge.type === "reentry" ? 2.2 : 1.35}
                  className={[
                    edgeClassName(edge.type),
                    focusSelected && selectedNodeId && !connected ? "opacity-10" : "",
                  ].join(" ")}
                />
              );
            })}

            {simNodes.map((node) => {
              const color = colorClasses[getColorForTopic(node.label)];
              const dimmed =
                focusSelected && selectedNodeId && !connectedIds.has(node.id);
              const isSelected = selectedNodeId === node.id;
              const isReturning = themeKind(node) === "returning-theme";

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
                  {highlightReturning && isReturning ? (
                    <circle
                      r={nodeRadius(node) + 8}
                      className="fill-amber-bg stroke-amber-border opacity-80"
                      strokeWidth={1.5}
                    />
                  ) : null}
                  <circle
                    r={nodeRadius(node)}
                    className={color.fill}
                    stroke={isSelected ? "var(--bloom-accent)" : "white"}
                    strokeWidth={isSelected ? 3.4 : 2.4}
                  />
                  <text
                    y={nodeRadius(node) + 17}
                    textAnchor="middle"
                    className="fill-bloom-text-secondary text-[10px]"
                  >
                    {truncateLabel(node.label)}
                  </text>
                </g>
              );
            })}
          </svg>

          {hoveredNode ? (
            <div className="pointer-events-none absolute left-3 top-[74px] max-w-[260px] rounded-bloom-sm border border-bloom-border bg-bloom-surface px-3 py-2 shadow-sm">
              <p className="text-[11px] font-medium uppercase text-bloom-text-tertiary">
                {themeKindLabel(hoveredNode)}
              </p>
              <p className="mt-1 text-[12px] font-medium text-bloom-text-primary">
                {hoveredNode.label}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-bloom-text-secondary">
                {hoveredNode.summary.slice(0, 120)}
                {hoveredNode.summary.length > 120 ? "..." : ""}
              </p>
            </div>
          ) : null}

          <div className="absolute bottom-3 left-3 rounded-bloom-sm border border-bloom-border bg-bloom-surface/95 px-3 py-2">
            <p className="mb-2 text-[10px] uppercase tracking-[0.08em] text-bloom-text-tertiary">
              Connections
            </p>
            <div className="grid gap-1.5">
              {legendItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 text-[11px] text-bloom-text-secondary"
                >
                  <span className={["block w-7 border-t", item.className].join(" ")} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {selectedNode ? (
            <aside className="bloom-scrollbar absolute bottom-3 right-3 max-h-[250px] w-[260px] overflow-y-auto rounded-bloom border border-bloom-border bg-bloom-surface p-3 shadow-sm">
              <p className="text-[11px] font-medium uppercase text-bloom-text-tertiary">
                {themeKindLabel(selectedNode)}
              </p>
              <p className="mt-1 text-[14px] font-semibold text-bloom-text-primary">
                {selectedNode.label}
              </p>
              <p className="mt-2 text-[12px] leading-5 text-bloom-text-secondary">
                {selectedNode.summary}
              </p>
              <p className="mt-2 rounded-bloom-sm bg-gray-bg px-2 py-2 text-[11px] leading-4 text-bloom-text-secondary">
                {themeIntro(selectedNode)}
              </p>
              {selectedConnections.length > 0 ? (
                <div className="mt-3 border-t border-bloom-border pt-3">
                  <p className="text-[11px] font-medium text-bloom-text-tertiary">
                    Connected thoughts
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {selectedConnections.slice(0, 3).map((connection) => (
                      <p
                        key={`${connection.sourceId}-${connection.targetId}`}
                        className="text-[11px] leading-4 text-bloom-text-secondary"
                      >
                        {connectionLabel(connection)}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          ) : null}
        </>
      )}
    </section>
  );
}
