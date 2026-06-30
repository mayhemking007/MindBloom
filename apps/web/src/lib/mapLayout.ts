import type { GraphMemory } from "@mindbloom/shared";

import type { EnrichedMapNode } from "../components/map/types";

export interface StarPoint {
  x: number;
  y: number;
  r: number;
  opacity: number;
  rotation: number;
  points: number;
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

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: string, salt: number): number {
  let value = hashString(`${seed}:${salt}`);
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return ((value >>> 0) % 10000) / 10000;
}

function topicPosition(
  node: EnrichedMapNode,
  index: number,
  count: number,
  width: number,
  height: number,
) {
  const marginX = 96;
  const marginY = 76;
  const lane = count <= 1 ? 0.5 : index / Math.max(1, count - 1);
  const seed = `${node.id}:${node.label}`;
  const drift = Math.max(0, Math.min(1, node.driftScore));
  const xJitter = (seededUnit(seed, 1) - 0.5) * 150;
  const yJitter = (seededUnit(seed, 2) - 0.5) * 118;
  const wave = Math.sin((index + seededUnit(seed, 3)) * 1.9) * 52;
  const x =
    marginX +
    lane * (width - marginX * 2) +
    xJitter +
    (drift - 0.5) * 44;
  const y =
    marginY +
    seededUnit(seed, 4) * (height - marginY * 2) +
    yJitter +
    wave;

  return {
    x: Math.max(marginX, Math.min(width - marginX, x)),
    y: Math.max(marginY, Math.min(height - marginY, y)),
  };
}

function constellationOffsets(
  node: EnrichedMapNode,
  count: number,
  topicCoreRadius: number,
  starRadii: number[],
): Array<{ x: number; y: number; rotation: number; points: number }> {
  const offsets = Array.from({ length: count }, (_, index) => {
    const starRadius = starRadii[index] ?? 5;
    const seed = `${node.id}:${node.memories[index]?.id ?? index}`;
    const arm = index % 6;
    const band = Math.floor(index / 6);
    const baseAngles = [-1.22, -0.48, 0.18, 0.92, 1.74, 2.62];
    const angle =
      (baseAngles[arm] ?? 0) +
      (seededUnit(seed, 1) - 0.5) * 0.42 +
      band * 0.22;
    const radius =
      topicCoreRadius +
      starRadius +
      24 +
      band * 30 +
      seededUnit(seed, 2) * 20;
    const lean = (seededUnit(seed, 3) - 0.5) * 22;

    return {
      x: radius * Math.cos(angle) + lean,
      y: radius * Math.sin(angle) - lean * 0.35,
      rotation: seededUnit(seed, 4) * 360,
      points: seededUnit(seed, 5) > 0.72 ? 6 : 5,
    };
  });

  for (let pass = 0; pass < 5; pass += 1) {
    for (let leftIndex = 0; leftIndex < offsets.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < offsets.length; rightIndex += 1) {
        const left = offsets[leftIndex]!;
        const right = offsets[rightIndex]!;
        const dx = right.x - left.x;
        const dy = right.y - left.y;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        const minDistance =
          (starRadii[leftIndex] ?? 5) + (starRadii[rightIndex] ?? 5) + 9;

        if (distance >= minDistance) {
          continue;
        }

        const push = (minDistance - distance) / 2;
        const ux = dx / distance;
        const uy = dy / distance;
        left.x -= ux * push;
        left.y -= uy * push;
        right.x += ux * push;
        right.y += uy * push;
      }
    }
  }

  return offsets.map((offset, index) => {
    const distance = Math.max(0.001, Math.hypot(offset.x, offset.y));
    const minDistance = topicCoreRadius + (starRadii[index] ?? 5) + 18;
    if (distance >= minDistance) {
      return offset;
    }

    const scale = minDistance / distance;
    return {
      ...offset,
      x: offset.x * scale,
      y: offset.y * scale,
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
    const position = topicPosition(node, index, nodes.length, width, height);
    const cx = position.x;
    const cy = position.y;
    const degree = degreeByNodeId.get(node.id) ?? 0;
    const radius = topicRadius(node, degree);
    const importance = Math.min(1, (radius - 8) / 18);
    const starRadii = node.memories.map((memory) =>
      confidenceToRadius(memory.confidence),
    );
    const offsets = constellationOffsets(node, node.memories.length, radius, starRadii);

    const stars = node.memories.map((memory, memoryIndex) => ({
      x: cx + (offsets[memoryIndex]?.x ?? 0),
      y: cy + (offsets[memoryIndex]?.y ?? 0),
      r: starRadii[memoryIndex] ?? confidenceToRadius(memory.confidence),
      opacity: opacityByType[memory.memoryType] ?? 0.62,
      rotation: offsets[memoryIndex]?.rotation ?? 0,
      points: offsets[memoryIndex]?.points ?? 5,
      memory,
      node,
    }));

    return { node, cx, cy, radius, importance, stars };
  });
}
