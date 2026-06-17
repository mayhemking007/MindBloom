import type { GraphMemory, MemoryType } from "@mindbloom/shared";
import { CheckSquare, HelpCircle, Lightbulb, Link, Pin } from "lucide-react";

import { colorClasses } from "../../lib/topicColors";
import type { EnrichedMapNode } from "./types";

interface RiverCardProps {
  node: EnrichedMapNode;
  isExpanded: boolean;
  onToggle: () => void;
}

const memoryIcon: Record<MemoryType, typeof Lightbulb> = {
  insight: Lightbulb,
  question: HelpCircle,
  fact: Pin,
  task: CheckSquare,
  reference: Link,
};

const memoryTone: Record<MemoryType, string> = {
  insight: "border-purple-border bg-purple-bg text-purple-text",
  question: "border-teal-border bg-teal-bg text-teal-text",
  fact: "border-amber-border bg-amber-bg text-amber-text",
  task: "border-blue-border bg-blue-bg text-blue-text",
  reference: "border-gray-border bg-gray-bg text-gray-text",
};

const memoryTypeLabels: Record<MemoryType, string> = {
  insight: "Insights",
  question: "Questions",
  fact: "Facts",
  task: "Tasks",
  reference: "References",
};

function previewText(value: string): string {
  return value.length > 76 ? `${value.slice(0, 73)}...` : value;
}

function groupMemories(memories: GraphMemory[]): Array<[MemoryType, GraphMemory[]]> {
  const grouped = new Map<MemoryType, GraphMemory[]>();
  for (const memory of memories) {
    grouped.set(memory.memoryType, [...(grouped.get(memory.memoryType) ?? []), memory]);
  }
  return [...grouped.entries()];
}

export function RiverCard({ node, isExpanded, onToggle }: RiverCardProps) {
  const color = colorClasses[node.color];
  const uniqueTypes = [...new Set(node.memories.map((memory) => memory.memoryType))].slice(0, 2);

  return (
    <div className="w-[190px] shrink-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="min-h-[150px] w-full rounded-bloom border p-4 text-left shadow-sm transition-colors"
        style={{
          background: "var(--map-card)",
          borderColor: isExpanded ? "var(--map-line)" : "var(--map-card-border)",
          color: "var(--map-text)",
        }}
      >
        <span className={`mb-4 block h-1 rounded-full ${color.dot}`} />
        <span className="block text-[14px] font-semibold leading-5">
          {node.label}
        </span>
        {node.topMemory ? (
          <span
            className="mt-2 block text-[12px] font-medium leading-5"
            style={{ color: "var(--map-muted)" }}
          >
            {previewText(node.topMemory.value)}
          </span>
        ) : (
          <span
            className="mt-2 block text-[12px] font-medium leading-5"
            style={{ color: "var(--map-faint)" }}
          >
            {previewText(node.summary)}
          </span>
        )}
        {uniqueTypes.length > 0 ? (
          <span className="mt-4 flex flex-wrap gap-1.5">
            {uniqueTypes.map((type) => (
              <span
                key={type}
                className={[
                  "rounded-bloom-sm border px-2 py-0.5 text-[11px] font-semibold",
                  memoryTone[type],
                ].join(" ")}
              >
                {type}
              </span>
            ))}
          </span>
        ) : null}
      </button>

      {isExpanded ? (
        <div
          className="mt-2 rounded-bloom-sm border p-3"
          style={{
            background: "var(--map-canvas)",
            borderColor: "var(--map-border)",
          }}
        >
          {node.memories.length === 0 ? (
            <p className="text-[12px] leading-5" style={{ color: "var(--map-faint)" }}>
              No extracted memories yet.
            </p>
          ) : (
            <div className="space-y-3">
              {groupMemories(node.memories).map(([type, memories]) => {
                const Icon = memoryIcon[type];
                return (
                  <section key={type}>
                    <p
                      className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                      style={{ color: "var(--map-faint)" }}
                    >
                      <Icon className="h-3 w-3" aria-hidden="true" />
                      {memoryTypeLabels[type]}
                    </p>
                    <div className="space-y-1.5">
                      {memories.map((memory) => (
                        <p
                          key={memory.id}
                          className="text-[12px] leading-5"
                          style={{ color: "var(--map-muted)" }}
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
      ) : null}
    </div>
  );
}
