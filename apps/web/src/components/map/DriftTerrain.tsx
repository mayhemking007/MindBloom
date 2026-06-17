import type { EnrichedMapNode } from "./types";

interface DriftTerrainProps {
  nodes: EnrichedMapNode[];
}

function driftToHeight(score: number): number {
  return Math.round(15 + Math.max(0, Math.min(1, score)) * 80);
}

function heightColor(height: number): string {
  if (height < 30) {
    return "var(--map-terrain-low)";
  }
  if (height < 50) {
    return "color-mix(in srgb, var(--map-terrain-low) 45%, var(--map-terrain-mid))";
  }
  if (height < 68) {
    return "var(--map-terrain-mid)";
  }
  if (height < 82) {
    return "color-mix(in srgb, var(--map-terrain-mid) 45%, var(--map-terrain-high))";
  }
  return "var(--map-terrain-high)";
}

export function DriftTerrain({ nodes }: DriftTerrainProps) {
  if (nodes.length < 2) {
    return null;
  }

  const segments = nodes.slice(1).map((node, index) => ({
    height: driftToHeight(node.driftScore),
    label: index === 0 ? "start" : index === nodes.length - 2 ? "end" : "",
  }));

  return (
    <div className="mt-7 border-t pt-5" style={{ borderColor: "var(--map-border)" }}>
      <p
        className="mb-3 text-[11px] font-semibold uppercase tracking-[0.09em]"
        style={{ color: "var(--map-faint)" }}
      >
        Topic shift intensity
      </p>
      <div className="flex h-16 items-end gap-1 pb-5">
        {segments.map((segment, index) => (
          <div
            key={`${index}-${segment.height}`}
            className="relative min-w-2 flex-1 rounded-t-[3px] transition-[height]"
            style={{
              height: `${segment.height}%`,
              background: heightColor(segment.height),
            }}
            title={`Drift intensity: ${Math.round((segment.height - 15) / 0.8)}%`}
          >
            {segment.label ? (
              <span
                className="absolute bottom-[-18px] left-1/2 -translate-x-1/2 text-[10px] font-medium"
                style={{ color: "var(--map-faint)" }}
              >
                {segment.label}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
