import type { GraphMemory, MemoryType } from "@mindbloom/shared";
import { CheckSquare, HelpCircle, Lightbulb, Link, Pin, X } from "lucide-react";

import type { EnrichedMapNode } from "./types";

interface RiverDetailPanelProps {
  node: EnrichedMapNode;
  memory: GraphMemory | null;
  onClose: () => void;
}

const memoryIcon: Record<MemoryType, typeof Lightbulb> = {
  insight: Lightbulb,
  question: HelpCircle,
  fact: Pin,
  task: CheckSquare,
  reference: Link,
};

const memoryTypeLabels: Record<MemoryType, string> = {
  insight: "Insight",
  question: "Question",
  fact: "Fact",
  task: "Next step",
  reference: "Reference",
};

export function RiverDetailPanel({ node, memory, onClose }: RiverDetailPanelProps) {
  const MemoryIcon = memory ? memoryIcon[memory.memoryType] : null;

  return (
    <aside
      className="rounded-bloom border p-4 md:p-5"
      style={{
        background: "var(--map-card)",
        borderColor: "var(--map-card-border)",
        color: "var(--map-text)",
      }}
      aria-label={`${node.label} ${memory ? "memory" : "thought"} details`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--map-faint)" }}
          >
            {memory ? (
              <span className="flex items-center gap-1.5">
                {MemoryIcon ? <MemoryIcon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {memoryTypeLabels[memory.memoryType]}
              </span>
            ) : (
              `Thought ${node.topicOrder}`
            )}
          </p>
          <h3 className="mt-1 text-[16px] font-semibold leading-6">
            {memory ? `From ${node.label}` : node.label}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-bloom-sm transition-colors hover:bg-gray-bg"
          aria-label="Close details"
          title="Close details"
          style={{ color: "var(--map-muted)" }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p
        className={memory ? "mt-4 text-[14px] leading-6" : "mt-3 text-[13px] leading-5"}
        style={{ color: memory ? "var(--map-text)" : "var(--map-muted)" }}
      >
        {memory?.value ?? node.summary}
      </p>
    </aside>
  );
}
