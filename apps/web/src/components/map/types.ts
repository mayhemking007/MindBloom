import type {
  GraphEdge,
  GraphMemory,
  GraphNode,
  GraphSnapshotResponse,
} from "@mindbloom/shared";

import type { ColorRamp } from "../../lib/topicColors";

export type MapViewType = "river" | "constellation";

export interface EnrichedMapNode extends GraphNode {
  color: ColorRamp;
  memories: GraphMemory[];
  topMemory: GraphMemory | null;
  edgesOut: GraphEdge[];
}

export interface MapViewsProps {
  snapshot: GraphSnapshotResponse;
  compact?: boolean;
}
