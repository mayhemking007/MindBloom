interface MapLegendProps {
  view: "river" | "constellation";
}

const riverItems = [
  { line: true, color: "border-bloom-border-mid", label: "Natural flow" },
  { line: true, color: "border-bloom-border-mid", dashed: true, label: "Topic pivot" },
  { line: true, color: "border-amber-border", label: "Returning thought" },
  { line: true, color: "border-purple-border", dotted: true, label: "Brought-in context" },
];

const constellationItems = [
  { dot: true, color: "bg-purple-text", size: "h-2 w-2", label: "Insight" },
  { dot: true, color: "bg-gray-text", size: "h-1.5 w-1.5", label: "Question" },
  { dot: true, color: "bg-gray-border", size: "h-1 w-1", label: "Fact" },
  { line: true, color: "border-amber-border", label: "Returning thought" },
  { line: true, color: "border-gray-border", dashed: true, label: "Related themes" },
];

export function MapLegend({ view }: MapLegendProps) {
  const items = view === "river" ? riverItems : constellationItems;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-bloom-text-secondary">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {"dot" in item && item.dot ? (
            <span className={`${item.size} rounded-full ${item.color}`} />
          ) : (
            <span
              className={[
                "block w-6 border-t",
                item.color,
                "dashed" in item && item.dashed ? "border-dashed" : "",
                "dotted" in item && item.dotted ? "border-dotted" : "",
              ].join(" ")}
            />
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
