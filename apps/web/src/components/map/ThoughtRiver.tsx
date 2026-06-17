import { useState } from "react";
import type { GraphEdge } from "@mindbloom/shared";

import { DriftTerrain } from "./DriftTerrain";
import { MapLegend } from "./MapLegend";
import { RiverCard } from "./RiverCard";
import { RiverConnector } from "./RiverConnector";
import type { EnrichedMapNode } from "./types";

interface ThoughtRiverProps {
  nodes: EnrichedMapNode[];
  edges: GraphEdge[];
}

function edgeBetween(edges: GraphEdge[], fromId: string, toId: string): GraphEdge | undefined {
  return edges.find(
    (edge) =>
      (edge.sourceId === fromId && edge.targetId === toId) ||
      (edge.sourceId === toId && edge.targetId === fromId),
  );
}

export function ThoughtRiver({ nodes, edges }: ThoughtRiverProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <div className="overflow-x-auto pb-3">
        <div className="flex min-w-max items-start px-1 py-3">
          {nodes.map((node, index) => {
            const nextNode = nodes[index + 1];
            const edge = nextNode ? edgeBetween(edges, node.id, nextNode.id) : undefined;
            const isExpanded = expandedId === node.id;

            return (
              <div key={node.id} className="flex items-start">
                <RiverCard
                  node={node}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedId(isExpanded ? null : node.id)}
                />
                {nextNode ? (
                  <RiverConnector edge={edge} driftScore={nextNode.driftScore} />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <DriftTerrain nodes={nodes} />
      <div className="mt-4">
        <MapLegend view="river" />
      </div>
    </div>
  );
}
