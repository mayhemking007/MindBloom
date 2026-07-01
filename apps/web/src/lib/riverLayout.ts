import type { GraphEdge } from "@mindbloom/shared";

import type { EnrichedMapNode } from "../components/map/types";

export const RIVER_CARD_HEIGHT = 88;

const DESKTOP_CARD_WIDTH = 150;
const MIN_CARD_WIDTH = 128;
const MAX_COLUMNS = 5;
const MAX_BRANCH_PATHS = 8;
const MAX_TOTAL_PATHS = 18;

export interface RiverLayoutNode {
  node: EnrichedMapNode;
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  column: number;
}

export type RiverPathKind = "flow" | "branch" | "return" | "grafted";

export interface RiverPath {
  id: string;
  fromId: string;
  toId: string;
  d: string;
  kind: RiverPathKind;
  parentRelation: boolean;
}

export interface RiverLayout {
  nodes: RiverLayoutNode[];
  paths: RiverPath[];
  parentByNodeId: Map<string, string>;
  height: number;
}

function edgeBetween(edges: GraphEdge[], firstId: string, secondId: string): GraphEdge | undefined {
  return edges.find(
    (edge) =>
      (edge.sourceId === firstId && edge.targetId === secondId) ||
      (edge.sourceId === secondId && edge.targetId === firstId),
  );
}

function pathKind(edge: GraphEdge | undefined): RiverPathKind {
  if (edge?.type === "reentry") {
    return "return";
  }
  if (edge?.type === "grafted") {
    return "grafted";
  }
  return edge?.type === "semantic" ? "branch" : "flow";
}

function relationPriority(edge: GraphEdge): number {
  switch (edge.type) {
    case "reentry":
      return 4;
    case "semantic":
      return 3;
    case "grafted":
      return 2;
    default:
      return 1;
  }
}

function selectParents(nodes: EnrichedMapNode[], edges: GraphEdge[]): Map<string, string> {
  const orderById = new Map(nodes.map((node, index) => [node.id, index]));
  const parentByNodeId = new Map<string, string>();

  nodes.slice(1).forEach((node, index) => {
    const nodeIndex = index + 1;
    const candidates = edges
      .filter((edge) => edge.sourceId === node.id || edge.targetId === node.id)
      .map((edge) => {
        const otherId = edge.sourceId === node.id ? edge.targetId : edge.sourceId;
        return { edge, otherId, otherIndex: orderById.get(otherId) ?? Number.MAX_SAFE_INTEGER };
      })
      .filter(({ otherIndex }) => otherIndex < nodeIndex)
      .sort((left, right) => {
        const priority = relationPriority(right.edge) - relationPriority(left.edge);
        return priority !== 0 ? priority : right.edge.weight - left.edge.weight;
      });

    parentByNodeId.set(node.id, candidates[0]?.otherId ?? nodes[nodeIndex - 1]!.id);
  });

  return parentByNodeId;
}

function primaryPath(source: RiverLayoutNode, target: RiverLayoutNode, bend: number): string {
  if (source.row === target.row) {
    const movingRight = target.x > source.x;
    const startX = movingRight ? source.x + source.width : source.x;
    const endX = movingRight ? target.x : target.x + target.width;
    const startY = source.y + source.height / 2;
    const endY = target.y + target.height / 2;
    const span = Math.abs(endX - startX);
    const direction = movingRight ? 1 : -1;

    return `M ${startX} ${startY} C ${startX + direction * span * 0.38} ${startY + bend}, ${endX - direction * span * 0.38} ${endY + bend}, ${endX} ${endY}`;
  }

  const startX = source.x + source.width / 2;
  const endX = target.x + target.width / 2;
  const startY = source.y + source.height;
  const endY = target.y;
  const turnDirection = source.column === 0 ? -1 : 1;
  const turnDepth = 46 * turnDirection;

  return `M ${startX} ${startY} C ${startX + turnDepth} ${startY + 30}, ${endX + turnDepth} ${endY - 30}, ${endX} ${endY}`;
}

function branchPath(
  source: RiverLayoutNode,
  target: RiverLayoutNode,
  branchIndex: number,
): string {
  if (source.row === target.row) {
    const startX = source.x + source.width / 2;
    const endX = target.x + target.width / 2;
    const topY = Math.min(source.y, target.y);
    const lift = 36 + Math.min(40, Math.abs(target.column - source.column) * 8 + branchIndex * 4);

    return `M ${startX} ${source.y} C ${startX} ${topY - lift}, ${endX} ${topY - lift}, ${endX} ${target.y}`;
  }

  const startX = source.x + source.width / 2;
  const endX = target.x + target.width / 2;
  const startY = source.y + source.height;
  const endY = target.y;
  const verticalSpan = Math.max(70, endY - startY);
  const naturalPull = (endX - startX) * 0.32;
  const outwardPull = startX <= endX ? -24 - branchIndex * 7 : 24 + branchIndex * 7;
  const pull = naturalPull + outwardPull;

  return `M ${startX} ${startY} C ${startX + pull} ${startY + verticalSpan * 0.32}, ${endX - pull} ${endY - verticalSpan * 0.32}, ${endX} ${endY}`;
}

export function buildRiverLayout(
  nodes: EnrichedMapNode[],
  edges: GraphEdge[],
  containerWidth: number,
): RiverLayout {
  const width = Math.max(280, containerWidth);
  const horizontalPadding = width < 520 ? 14 : 24;
  const topPadding = width < 520 ? 64 : 84;
  const bottomPadding = 24;
  const horizontalGap = width < 720 ? 30 : 44;
  const availableWidth = width - horizontalPadding * 2;
  const cardWidth = Math.min(
    DESKTOP_CARD_WIDTH,
    Math.max(MIN_CARD_WIDTH, availableWidth),
  );
  const columns = Math.max(
    1,
    Math.min(
      MAX_COLUMNS,
      Math.floor((availableWidth + horizontalGap) / (cardWidth + horizontalGap)),
    ),
  );
  const actualGap =
    columns > 1 ? (availableWidth - cardWidth * columns) / (columns - 1) : 0;
  const singleColumnOffset = columns === 1 ? (availableWidth - cardWidth) / 2 : 0;
  const rowGap = width < 520 ? 60 : 72;

  const layoutNodes = nodes.map((node, index): RiverLayoutNode => {
    const row = Math.floor(index / columns);
    const positionInRow = index % columns;
    const column = row % 2 === 0 ? positionInRow : columns - positionInRow - 1;
    return {
      node,
      x: horizontalPadding + singleColumnOffset + column * (cardWidth + actualGap),
      y: topPadding + row * (RIVER_CARD_HEIGHT + rowGap),
      width: cardWidth,
      height: RIVER_CARD_HEIGHT,
      row,
      column,
    };
  });

  const layoutById = new Map(layoutNodes.map((item) => [item.node.id, item]));
  const parentByNodeId = selectParents(nodes, edges);
  const paths: RiverPath[] = [];
  const seenRelations = new Set<string>();

  layoutNodes.slice(0, -1).forEach((source, index) => {
    const target = layoutNodes[index + 1]!;
    const edge = edgeBetween(edges, source.node.id, target.node.id);
    const id = `flow-${source.node.id}-${target.node.id}`;
    paths.push({
      id,
      fromId: source.node.id,
      toId: target.node.id,
      d: primaryPath(source, target, index % 2 === 0 ? -13 : 13),
      kind: pathKind(edge),
      parentRelation: parentByNodeId.get(target.node.id) === source.node.id,
    });
    seenRelations.add([source.node.id, target.node.id].sort().join(":"));
  });

  const rankedEdges = [...edges].sort((left, right) => {
    const priority = relationPriority(right) - relationPriority(left);
    return priority !== 0 ? priority : right.weight - left.weight;
  });
  let branchPathCount = 0;

  rankedEdges.forEach((edge, branchIndex) => {
    if (branchPathCount >= MAX_BRANCH_PATHS || paths.length >= MAX_TOTAL_PATHS) {
      return;
    }

    const source = layoutById.get(edge.sourceId);
    const target = layoutById.get(edge.targetId);
    if (!source || !target) {
      return;
    }

    const pairKey = [source.node.id, target.node.id].sort().join(":");
    if (seenRelations.has(pairKey)) {
      return;
    }

    const sourceOrder = source.node.topicOrder;
    const targetOrder = target.node.topicOrder;
    const earlier = sourceOrder <= targetOrder ? source : target;
    const later = sourceOrder <= targetOrder ? target : source;
    const kind = pathKind(edge);
    const id = `${kind}-${earlier.node.id}-${later.node.id}`;

    if (paths.some((path) => path.id === id)) {
      return;
    }

    paths.push({
      id,
      fromId: earlier.node.id,
      toId: later.node.id,
      d: branchPath(earlier, later, branchIndex % 4),
      kind,
      parentRelation: parentByNodeId.get(later.node.id) === earlier.node.id,
    });
    branchPathCount += 1;
  });

  const rows = Math.max(1, Math.ceil(nodes.length / columns));
  return {
    nodes: layoutNodes,
    paths,
    parentByNodeId,
    height:
      topPadding +
      bottomPadding +
      rows * RIVER_CARD_HEIGHT +
      (rows - 1) * rowGap,
  };
}

export function directConnectionSelection(
  selectedId: string | null,
  paths: RiverPath[],
): { nodeIds: Set<string>; pathIds: Set<string> } {
  const nodeIds = new Set<string>();
  const pathIds = new Set<string>();
  if (!selectedId) {
    return { nodeIds, pathIds };
  }

  nodeIds.add(selectedId);
  for (const path of paths) {
    if (path.fromId === selectedId || path.toId === selectedId) {
      nodeIds.add(path.fromId);
      nodeIds.add(path.toId);
      pathIds.add(path.id);
    }
  }

  return { nodeIds, pathIds };
}
