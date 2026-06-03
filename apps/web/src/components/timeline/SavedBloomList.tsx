import type { SavedBloom } from "../../lib/bloomStore";
import { formatDate, getDateFromSessionId } from "../../lib/dateUtils";

interface SavedBloomListProps {
  blooms: SavedBloom[];
  selectedSessionId: string | null;
  onSelect: (bloom: SavedBloom) => void;
}

export function SavedBloomList({
  blooms,
  selectedSessionId,
  onSelect,
}: SavedBloomListProps) {
  if (blooms.length === 0) {
    return null;
  }

  return (
    <section className="py-5">
      <p className="label-text mb-3">Saved Sessions</p>
      <div className="space-y-2">
        {blooms.map((bloom) => {
          const date = getDateFromSessionId(bloom.sessionId);
          const selected = bloom.sessionId === selectedSessionId;

          return (
            <button
              key={bloom.sessionId}
              type="button"
              onClick={() => onSelect(bloom)}
              className={[
                "w-full rounded-bloom border bg-bloom-surface p-4 text-left transition-colors",
                selected
                  ? "border-purple-border"
                  : "border-bloom-border hover:border-bloom-border-mid",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-bloom-text-tertiary">
                    {date ? formatDate(date) : "Saved Bloom"}
                  </p>
                  <p className="mt-1 truncate font-serif text-[17px] text-bloom-text-primary">
                    {bloom.insights.mood}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-teal-border bg-teal-bg px-2.5 py-1 text-[10px] text-teal-text">
                  {bloom.insights.wordOfDay}
                </span>
              </div>
              <p className="mt-2 text-[12px] text-bloom-text-secondary">
                {bloom.insights.archetype}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
