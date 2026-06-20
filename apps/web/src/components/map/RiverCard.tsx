import { colorClasses } from "../../lib/topicColors";
import type { EnrichedMapNode } from "./types";

interface RiverCardProps {
  node: EnrichedMapNode;
  isSelected: boolean;
  isDimmed: boolean;
  onSelect: () => void;
}

function previewText(value: string): string {
  return value.length > 76 ? `${value.slice(0, 73)}...` : value;
}

export function RiverCard({ node, isSelected, isDimmed, onSelect }: RiverCardProps) {
  const color = colorClasses[node.color];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`Select ${node.label}`}
      className="h-full w-full rounded-bloom border p-4 text-left shadow-sm transition-[border-color,box-shadow,opacity,transform] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-border"
      style={{
        background: "var(--map-card)",
        borderColor: isSelected ? "var(--map-text)" : "var(--map-card-border)",
        boxShadow: isSelected
          ? "0 0 0 2px var(--map-card), 0 0 0 4px var(--map-line)"
          : "0 2px 8px rgba(0, 0, 0, 0.06)",
        color: "var(--map-text)",
        opacity: isDimmed ? 0.42 : 1,
      }}
    >
      <span className="flex items-center justify-between gap-3">
        <span className={`block h-1 w-12 rounded-full ${color.dot}`} />
        <span className="text-[10px] font-semibold" style={{ color: "var(--map-faint)" }}>
          {String(node.topicOrder).padStart(2, "0")}
        </span>
      </span>
      <span className="mt-3 block max-h-10 overflow-hidden text-[14px] font-semibold leading-5">
        {node.label}
      </span>
      <span
        className="mt-2 block max-h-10 overflow-hidden text-[12px] font-medium leading-5"
        style={{ color: node.topMemory ? "var(--map-muted)" : "var(--map-faint)" }}
      >
        {previewText(node.topMemory?.value ?? node.summary)}
      </span>
      <span className="mt-2 block text-[10px] font-medium" style={{ color: "var(--map-faint)" }}>
        {node.memories.length} {node.memories.length === 1 ? "memory" : "memories"}
      </span>
    </button>
  );
}
