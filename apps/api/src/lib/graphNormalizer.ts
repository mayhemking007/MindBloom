import type {
  GraphEdge,
  GraphMemory,
  GraphNode,
  GraphSnapshotResponse,
  MemoryEdge,
  RecallFact,
  RecallResponse,
} from "@mindbloom/shared";
import type {
  GraphSnapshot,
  MemoryEdge as MemoGrafterMemoryEdge,
  MemoryNode,
  RetrievalResult,
  TopicEdge,
  TopicNode,
} from "memo-grafter";

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function normalizeTopicNode(node: TopicNode): GraphNode {
  return {
    id: node.id,
    sessionId: node.sessionId,
    segmentId: node.segmentId,
    label: node.label,
    summary: node.summary,
    tags: node.tags,
    messageRange: node.messageRange,
    topicOrder: node.topicOrder,
    driftScore: node.driftScore,
    agentColor: node.agentColor,
    fleetId: node.fleetId,
    agentId: node.agentId,
    createdAt: toIsoString(node.createdAt),
  };
}

export function normalizeTopicEdge(edge: TopicEdge): GraphEdge {
  return {
    sourceId: edge.srcId,
    targetId: edge.dstId,
    type: edge.type,
    weight: edge.weight,
  };
}

export function normalizeMemory(memory: MemoryNode): GraphMemory {
  return {
    id: memory.id,
    segmentId: memory.segmentId,
    topicNodeId: memory.topicNodeId,
    agentId: memory.agentId,
    sessionId: memory.sessionId,
    memoryType: memory.memoryType,
    sourceType: memory.sourceType,
    subject: memory.subject,
    predicate: memory.predicate,
    value: memory.value,
    confidence: memory.confidence,
    tags: memory.tags,
    sourceUrl: memory.sourceUrl,
    sourceTitle: memory.sourceTitle,
    supersededBy: memory.supersededBy,
    decayed: memory.decayed,
    hasConflict: memory.hasConflict,
    agentColor: memory.agentColor,
    fleetId: memory.fleetId,
    createdAt: toIsoString(memory.createdAt),
  };
}

export function normalizeMemoryEdge(edge: MemoGrafterMemoryEdge): MemoryEdge {
  return {
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    edgeType: edge.edgeType,
    weight: edge.weight,
    createdAt: toIsoString(edge.createdAt),
  };
}

export function normalizeGraphSnapshot(
  snapshot: GraphSnapshot,
): GraphSnapshotResponse {
  const nodesById = new Map(
    snapshot.nodes.map((node) => [node.id, normalizeTopicNode(node)]),
  );

  for (const snapshotNode of snapshot.snapshotNodes ?? []) {
    const node = normalizeTopicNode(snapshotNode.node);
    if (snapshotNode.graftOrigin) {
      node.graftOrigin = {
        sourceSessionId: snapshotNode.graftOrigin.sourceSessionId,
        sourceNodeId: snapshotNode.graftOrigin.sourceNodeId,
        graftedAt: toIsoString(snapshotNode.graftOrigin.graftedAt),
      };
    }
    nodesById.set(node.id, node);
  }

  return {
    sessionId: snapshot.sessionId,
    nodes: [...nodesById.values()],
    edges: snapshot.edges.map(normalizeTopicEdge),
    memories: snapshot.memories.map(normalizeMemory),
    memoryEdges: (snapshot.memoryEdges ?? []).map(normalizeMemoryEdge),
    capturedAt: snapshot.capturedAt,
  };
}

export function normalizeRecallResult(result: RetrievalResult): RecallResponse {
  const facts: RecallFact[] = result.facts.map((fact) => ({
    ...normalizeMemory(fact),
    similarity: fact.similarity,
  }));

  return {
    facts,
    nodes: result.nodes.map(normalizeTopicNode),
    tokenCount: result.tokenCount,
  };
}
