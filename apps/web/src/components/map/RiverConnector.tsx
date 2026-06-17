import type { GraphEdge } from "@mindbloom/shared";

interface RiverConnectorProps {
  edge: GraphEdge | undefined;
  driftScore: number;
}

export function RiverConnector({ edge, driftScore }: RiverConnectorProps) {
  const edgeType = edge?.type ?? "temporal";

  if (edgeType === "reentry") {
    return (
      <div className="relative mt-7 h-12 w-20 shrink-0">
        <div
          className="absolute left-2 right-2 top-0 h-7 rounded-t-bloom-sm border-2 border-b-0"
          style={{ borderColor: "var(--map-reentry)" }}
        />
        <span
          className="absolute left-1/2 top-[-12px] -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold"
          style={{ color: "var(--map-reentry)" }}
        >
          returning
        </span>
        <div
          className="absolute left-0 right-0 top-9 border-t-2 opacity-80"
          style={{ borderColor: "var(--map-reentry)" }}
        />
      </div>
    );
  }

  const isPivot = driftScore > 0.5;
  const isSemantic = edgeType === "semantic";
  const isGrafted = edgeType === "grafted";

  return (
    <div className="relative mt-7 h-12 w-16 shrink-0">
      {isPivot || edgeType === "temporal" ? (
        <span
          className="absolute left-1/2 top-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium"
          style={{ color: "var(--map-faint)" }}
        >
          {isPivot ? "pivot" : "natural"}
        </span>
      ) : null}
      <div
        className={[
          "absolute left-0 right-0 top-9 border-t",
          isGrafted ? "border-dotted" : "",
          isSemantic ? "border-dashed" : "",
        ].join(" ")}
        style={{ borderColor: isGrafted ? "var(--map-grafted)" : "var(--map-line)" }}
      />
    </div>
  );
}
