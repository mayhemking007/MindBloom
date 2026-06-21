import type { GraphMemory } from "@mindbloom/shared";

import { constellationRamps, type ColorRamp } from "../../lib/topicColors";

interface RiverMemoryDotsProps {
  memories: GraphMemory[];
  color: ColorRamp;
  cardWidth: number;
  cardHeight: number;
  selectedMemoryId: string | null;
  onSelectMemory: (memory: GraphMemory) => void;
}

const DOTS_PER_RING = 10;

function dotDiameter(confidence: number): number {
  return 7 + Math.max(0, Math.min(1, confidence)) * 4;
}

export function RiverMemoryDots({
  memories,
  color,
  cardWidth,
  cardHeight,
  selectedMemoryId,
  onSelectMemory,
}: RiverMemoryDotsProps) {
  const fill = constellationRamps[color].mid;

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
      {memories.map((memory, index) => {
        const ring = Math.floor(index / DOTS_PER_RING);
        const indexInRing = index % DOTS_PER_RING;
        const dotsInRing = Math.min(DOTS_PER_RING, memories.length - ring * DOTS_PER_RING);
        const angle = -Math.PI / 2 + 0.32 + (indexInRing / dotsInRing) * Math.PI * 2;
        const diameter = dotDiameter(memory.confidence);
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const boundaryDistance = Math.min(
          cardWidth / 2 / Math.max(Math.abs(cosine), 0.001),
          cardHeight / 2 / Math.max(Math.abs(sine), 0.001),
        );
        const orbitDistance = boundaryDistance + 14 + ring * 11;
        const isSelected = selectedMemoryId === memory.id;

        return (
          <button
            key={memory.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectMemory(memory);
            }}
            aria-label={`View memory: ${memory.value}`}
            aria-pressed={isSelected}
            title={memory.value}
            data-memory-dot="true"
            data-memory-id={memory.id}
            data-memory-confidence={memory.confidence}
            className="pointer-events-auto absolute rounded-full transition-[box-shadow,opacity,transform] hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-border focus-visible:ring-offset-2"
            style={{
              width: diameter,
              height: diameter,
              left: cardWidth / 2 + cosine * orbitDistance - diameter / 2,
              top: cardHeight / 2 + sine * orbitDistance - diameter / 2,
              background: fill,
              opacity: isSelected
                ? 1
                : 0.58 + Math.max(0, Math.min(1, memory.confidence)) * 0.36,
              boxShadow: isSelected
                ? `0 0 0 3px color-mix(in srgb, ${fill} 26%, transparent)`
                : `0 0 0 1px color-mix(in srgb, ${fill} 20%, transparent)`,
              transform: isSelected ? "scale(1.28)" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
