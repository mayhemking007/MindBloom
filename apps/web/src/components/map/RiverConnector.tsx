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
        <div className="absolute left-1 right-1 top-1 h-5 rounded-t-bloom-sm border border-b-0 border-amber-border" />
        <span className="absolute left-1/2 top-[-7px] -translate-x-1/2 whitespace-nowrap text-[9px] font-medium text-amber-text">
          returning
        </span>
        <div className="absolute left-0 right-0 top-7 border-t-2 border-amber-border opacity-70" />
      </div>
    );
  }

  const isPivot = driftScore > 0.5;
  const isSemantic = edgeType === "semantic";
  const isGrafted = edgeType === "grafted";

  return (
    <div className="relative mt-6 h-10 w-12 shrink-0">
      {isPivot ? (
        <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-[9px] text-bloom-text-tertiary">
          pivot
        </span>
      ) : null}
      <div
        className={[
          "absolute left-0 right-0 top-7 border-t",
          isGrafted ? "border-purple-border border-dotted" : "border-bloom-border-mid",
          isSemantic ? "border-dashed" : "",
        ].join(" ")}
      />
    </div>
  );
}
