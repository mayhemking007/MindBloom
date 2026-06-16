interface MapLegendProps {
  view: "river" | "constellation";
}

const riverItems = [
  { line: true, color: "var(--map-line)", label: "Natural flow" },
  { line: true, color: "var(--map-line)", dashed: true, label: "Topic pivot" },
  { line: true, color: "var(--map-reentry)", label: "Returning thought" },
  { line: true, color: "var(--map-grafted)", dotted: true, label: "Brought-in context" },
];

const constellationItems = [
  { dot: true, color: "var(--map-insight)", size: "h-2 w-2", label: "Insight" },
  { dot: true, color: "var(--map-muted)", size: "h-1.5 w-1.5", label: "Question" },
  { dot: true, color: "var(--map-faint)", size: "h-1 w-1", label: "Fact" },
  { line: true, color: "var(--map-reentry)", label: "Returning thought" },
  { line: true, color: "var(--map-line)", dashed: true, label: "Related themes" },
];

export function MapLegend({ view }: MapLegendProps) {
  const items = view === "river" ? riverItems : constellationItems;

  return (
    <div
      className="flex flex-wrap gap-x-4 gap-y-2 text-[11px]"
      style={{ color: "var(--map-muted)" }}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {"dot" in item && item.dot ? (
            <span
              className={`${item.size} rounded-full`}
              style={{ background: item.color }}
            />
          ) : (
            <span
              className={[
                "block w-6 border-t",
                "dashed" in item && item.dashed ? "border-dashed" : "",
                "dotted" in item && item.dotted ? "border-dotted" : "",
              ].join(" ")}
              style={{ borderColor: item.color }}
            />
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
