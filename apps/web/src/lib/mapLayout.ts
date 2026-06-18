import type { GraphMemory } from "@mindbloom/shared";

import type { EnrichedMapNode } from "../components/map/types";

export interface StarPoint {
  x: number;
  y: number;
  r: number;
  opacity: number;
  memory: GraphMemory;
  node: EnrichedMapNode;
}

export interface ConstellationGroup {
  node: EnrichedMapNode;
  cx: number;
  cy: number;
  radius: number;
  importance: number;
  stars: StarPoint[];
}

const opacityByType: Record<string, number> = {
  insight: 0.95,
  question: 0.76,
  fact: 0.58,
  task: 0.64,
  reference: 0.52,
};

function confidenceToRadius(confidence: number): number {
  const clamped = Math.max(0, Math.min(1, confidence));
  return 3 + clamped * 5;
}

function topicRadius(node: EnrichedMapNode, degree: number): number {
  const memoryWeight = Math.min(node.memories.length, 5) * 2.2;
  const degreeWeight = Math.min(degree, 4) * 1.6;
  const driftWeight = Math.max(0, Math.min(1, node.driftScore)) * 4;
  return 8 + memoryWeight + degreeWeight + driftWeight;
}

function sunflowerPoints(
  count: number,
  topicCoreRadius: number,
  starRadii: number[],
): Array<{ x: number; y: number }> {
  const goldenAngle = 2.399963;
  const firstAngle = -Math.PI / 4;

  return Array.from({ length: count }, (_, index) => {
    const starRadius = starRadii[index] ?? 5;
    const orbitBand = Math.floor(index / 7) * 14;
    const stagger = index % 2 === 0 ? 0 : 5;
    const radius = topicCoreRadius + starRadius + 12 + orbitBand + stagger;
    const theta = firstAngle + index * goldenAngle;

    return {
      x: radius * Math.cos(theta),
      y: radius * Math.sin(theta),
    };
  });
}

export function computeConstellationLayout(
  nodes: EnrichedMapNode[],
  width: number,
  height: number,
): ConstellationGroup[] {
  if (nodes.length === 0) {
    return [];
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const ringRadius = Math.min(width, height) * (nodes.length <= 2 ? 0.24 : 0.34);
  const degreeByNodeId = new Map(
    nodes.map((node) => [
      node.id,
      node.edgesOut.length +
        nodes.reduce(
          (count, candidate) =>
            count +
            candidate.edgesOut.filter((edge) => edge.targetId === node.id).length,
          0,
        ),
    ]),
  );

  return nodes.map((node, index) => {
    const angle = (index / nodes.length) * Math.PI * 2 - Math.PI / 2;
    const cx = centerX + ringRadius * Math.cos(angle);
    const cy = centerY + ringRadius * Math.sin(angle);
    const degree = degreeByNodeId.get(node.id) ?? 0;
    const radius = topicRadius(node, degree);
    const importance = Math.min(1, (radius - 8) / 18);
    const starRadii = node.memories.map((memory) =>
      confidenceToRadius(memory.confidence),
    );
    const offsets = sunflowerPoints(node.memories.length, radius, starRadii);

    const stars = node.memories.map((memory, memoryIndex) => ({
      x: cx + (offsets[memoryIndex]?.x ?? 0),
      y: cy + (offsets[memoryIndex]?.y ?? 0),
      r: starRadii[memoryIndex] ?? confidenceToRadius(memory.confidence),
      opacity: opacityByType[memory.memoryType] ?? 0.62,
      memory,
      node,
    }));

    return { node, cx, cy, radius, importance, stars };
  });
}
