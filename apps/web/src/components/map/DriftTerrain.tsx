import type { EnrichedMapNode } from "./types";

interface DriftTerrainProps {
  nodes: EnrichedMapNode[];
}

function driftToHeight(score: number): number {
  return Math.round(15 + Math.max(0, Math.min(1, score)) * 80);
}

function heightColor(height: number): string {
  if (height < 30) {
    return "bg-purple-bg";
  }
  if (height < 50) {
    return "bg-purple-border/60";
  }
  if (height < 68) {
    return "bg-purple-border";
  }
  if (height < 82) {
    return "bg-bloom-accent/75";
  }
  return "bg-bloom-accent";
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
    <div className="mt-6 border-t border-bloom-border pt-4">
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.08em] text-bloom-text-tertiary">
        Topic shift intensity
      </p>
      <div className="flex h-14 items-end gap-1 pb-4">
        {segments.map((segment, index) => (
          <div
            key={`${index}-${segment.height}`}
            className={[
              "relative min-w-2 flex-1 rounded-t-[3px] transition-[height]",
              heightColor(segment.height),
            ].join(" ")}
            style={{ height: `${segment.height}%` }}
            title={`Drift intensity: ${Math.round((segment.height - 15) / 0.8)}%`}
          >
            {segment.label ? (
              <span className="absolute bottom-[-16px] left-1/2 -translate-x-1/2 text-[9px] text-bloom-text-tertiary">
                {segment.label}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
