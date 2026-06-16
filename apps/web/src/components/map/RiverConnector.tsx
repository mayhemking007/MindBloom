import type { GraphEdge } from "@mindbloom/shared";

interface RiverConnectorProps {
  edge: GraphEdge | undefined;
  driftScore: number;
}

export function RiverConnector({ edge, driftScore }: RiverConnectorProps) {
  const edgeType = edge?.type ?? "temporal";

  if (edgeType === "reentry") {
    return (
      <div className="relative mt-6 h-10 w-16 shrink-0">
        <div
          className="absolute left-1 right-1 top-1 h-5 rounded-t-bloom-sm border border-b-0"
          style={{ borderColor: "var(--map-reentry)" }}
        />
        <span
          className="absolute left-1/2 top-[-7px] -translate-x-1/2 whitespace-nowrap text-[9px] font-medium"
          style={{ color: "var(--map-reentry)" }}
        >
          returning
        </span>
        <div
          className="absolute left-0 right-0 top-7 border-t-2 opacity-70"
          style={{ borderColor: "var(--map-reentry)" }}
        />
      </div>
    );
  }

  const isPivot = driftScore > 0.5;
  const isSemantic = edgeType === "semantic";
  const isGrafted = edgeType === "grafted";

  return (
    <div className="relative mt-6 h-10 w-12 shrink-0">
      {isPivot ? (
        <span
          className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-[9px]"
          style={{ color: "var(--map-faint)" }}
        >
          pivot
        </span>
      ) : null}
      <div
        className={[
          "absolute left-0 right-0 top-7 border-t",
          isGrafted ? "border-dotted" : "",
          isSemantic ? "border-dashed" : "",
        ].join(" ")}
        style={{ borderColor: isGrafted ? "var(--map-grafted)" : "var(--map-line)" }}
      />
    </div>
  );
}
