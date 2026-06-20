import type { GraphMemory, MemoryType } from "@mindbloom/shared";
import { CheckSquare, HelpCircle, Lightbulb, Link, Pin, X } from "lucide-react";

import type { EnrichedMapNode } from "./types";

interface RiverDetailPanelProps {
  node: EnrichedMapNode;
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
  insight: "Insights",
  question: "Questions",
  fact: "Facts",
  task: "Next steps",
  reference: "References",
};

function groupMemories(memories: GraphMemory[]): Array<[MemoryType, GraphMemory[]]> {
  const grouped = new Map<MemoryType, GraphMemory[]>();
  for (const memory of memories) {
    grouped.set(memory.memoryType, [...(grouped.get(memory.memoryType) ?? []), memory]);
  }
  return [...grouped.entries()];
}

export function RiverDetailPanel({ node, onClose }: RiverDetailPanelProps) {
  return (
    <aside
      className="rounded-bloom border p-4 md:p-5"
      style={{
        background: "var(--map-card)",
        borderColor: "var(--map-card-border)",
        color: "var(--map-text)",
      }}
      aria-label={`${node.label} thought details`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--map-faint)" }}
          >
            Thought {node.topicOrder}
          </p>
          <h3 className="mt-1 text-[16px] font-semibold leading-6">{node.label}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-bloom-sm transition-colors hover:bg-gray-bg"
          aria-label="Close thought details"
          title="Close thought details"
          style={{ color: "var(--map-muted)" }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p className="mt-3 text-[13px] leading-5" style={{ color: "var(--map-muted)" }}>
        {node.summary}
      </p>

      <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--map-border)" }}>
        {node.memories.length === 0 ? (
          <p className="text-[12px] leading-5" style={{ color: "var(--map-faint)" }}>
            No extracted memories yet.
          </p>
        ) : (
          <div className="space-y-4">
            {groupMemories(node.memories).map(([type, memories]) => {
              const Icon = memoryIcon[type];
              return (
                <section key={type}>
                  <p
                    className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: "var(--map-faint)" }}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {memoryTypeLabels[type]}
                  </p>
                  <div className="space-y-2">
                    {memories.map((memory) => (
                      <p
                        key={memory.id}
                        className="rounded-bloom-sm border px-3 py-2 text-[12px] leading-5"
                        style={{
                          background: "var(--map-canvas)",
                          borderColor: "var(--map-border)",
                          color: "var(--map-muted)",
                        }}
                      >
                        {memory.value}
                      </p>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
