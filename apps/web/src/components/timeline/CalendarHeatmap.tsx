import type { SavedBloom } from "../../lib/bloomStore";
import { getDateFromSessionId, getRecentDateStamps } from "../../lib/dateUtils";

interface CalendarHeatmapProps {
  blooms: SavedBloom[];
  selectedDate: string | null;
  onSelect: (bloom: SavedBloom) => void;
}

const weekdays = ["M", "T", "W", "T", "F", "S", "S"];

export function CalendarHeatmap({
  blooms,
  selectedDate,
  onSelect,
}: CalendarHeatmapProps) {
  const dates = getRecentDateStamps(35);
  const bloomByDate = new Map(
    blooms
      .map((bloom) => [getDateFromSessionId(bloom.sessionId), bloom] as const)
      .filter((entry): entry is [string, SavedBloom] => Boolean(entry[0])),
  );

  return (
    <section className="border-y border-bloom-border py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="label-text">Recent Blooms</p>
        <p className="text-[11px] text-bloom-text-tertiary">Last 5 weeks</p>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center">
        {weekdays.map((weekday, index) => (
          <span
            key={`${weekday}-${index}`}
            className="text-[10px] text-bloom-text-tertiary"
          >
            {weekday}
          </span>
        ))}

        {dates.map((date) => {
          const bloom = bloomByDate.get(date);
          const selected = date === selectedDate;

          return (
            <button
              key={date}
              type="button"
              disabled={!bloom}
              aria-label={bloom ? `Open Bloom for ${date}` : `No Bloom for ${date}`}
              onClick={() => bloom && onSelect(bloom)}
              className={[
                "aspect-square w-full rounded-bloom-sm border transition-colors",
                bloom
                  ? "border-purple-border bg-purple-bg hover:bg-bloom-accent-bg"
                  : "border-bloom-border bg-bloom-surface",
                selected ? "ring-2 ring-bloom-accent ring-offset-1 ring-offset-bloom-bg" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "mx-auto block h-1.5 w-1.5 rounded-full",
                  bloom ? "bg-purple-border" : "bg-gray-border opacity-30",
                ].join(" ")}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
