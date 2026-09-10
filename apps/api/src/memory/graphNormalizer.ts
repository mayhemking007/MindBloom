import type {
  GraphEdge,
  GraphEpisode,
  GraphThemeKind,
  GraphMemory,
  GraphNode,
  GraphSnapshotResponse,
  GraphTopicCluster,
  MemoryEdge,
  RecallFact,
  RecallResponse,
} from "@mindbloom/shared";
import type {
  GraphSnapshot,
  GraphSnapshotMemory,
  GraphSnapshotNode,
  Episode,
  MemoryEdge as MemoGrafterMemoryEdge,
  MemoryNode,
  RetrievalResult,
  TopicEdge,
  TopicNode,
} from "memo-grafter";

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toNullableIsoString(value: Date | string | null | undefined): string | null {
  return value ? toIsoString(value) : null;
}

function visualImportance(memory: MemoryNode): number {
  const quality = memory.quality;
  const base =
    quality.salience * 0.5 +
    quality.stability * 0.2 +
    quality.explicitness * 0.15 +
    quality.sourceReliability * 0.15;
  const reinforcementBoost = Math.min(0.1, Math.log2(memory.reinforcementCount ?? 1) * 0.025);
  return Math.max(0, Math.min(1, base + reinforcementBoost));
}

function friendlyThemeKind(node: TopicNode, hasGraftOrigin = false): GraphThemeKind {
  if (hasGraftOrigin) {
    return "brought-in-context";
  }
  if (node.driftScore >= 0.65) {
    return "returning-theme";
  }
  return "theme";
}

function friendlyThemeKindLabel(kind: GraphThemeKind): string {
  switch (kind) {
    case "brought-in-context":
      return "Brought-in context";
    case "returning-theme":
      return "Returning theme";
    default:
      return "Theme";
  }
}

function friendlyThemeHelper(kind: GraphThemeKind): string {
  switch (kind) {
    case "brought-in-context":
      return "A previous thought you chose to bring into this entry.";
    case "returning-theme":
      return "A thought that seems to be coming back with energy.";
    default:
      return "A thought MindBloom noticed in this entry.";
  }
}

function friendlyConnectionLabel(type: string): string {
  switch (type) {
    case "semantic":
      return "Related thought";
    case "reentry":
      return "Returning thought";
    case "grafted":
      return "Brought-in context";
    default:
      return "Connection";
  }
}

function friendlyConnectionHelper(type: string): string {
  switch (type) {
    case "semantic":
      return "These themes appear to be talking about similar ideas.";
    case "reentry":
      return "This thought has resurfaced in the entry.";
    case "grafted":
      return "This link comes from previous context you brought in.";
    default:
      return "These themes are connected in your writing.";
  }
}

function sourceLabelFromSessionId(sessionId: string): string {
  const match = /(\d{4}-\d{2}-\d{2})$/.exec(sessionId);
  if (!match) {
    return "an earlier entry";
  }

  return `an entry from ${match[1]}`;
}

export function normalizeTopicNode(
  node: TopicNode,
  snapshotNode?: GraphSnapshotNode,
): GraphNode {
  const kind = friendlyThemeKind(node);

  return {
    id: node.id,
    sessionId: node.sessionId,
    segmentId: node.segmentId,
    label: node.label,
    summary: node.summary,
    kind,
    kindLabel: friendlyThemeKindLabel(kind),
    helperText: friendlyThemeHelper(kind),
    tags: node.tags,
    messageRange: node.messageRange,
    topicOrder: node.topicOrder,
    driftScore: node.driftScore,
    agentColor: node.agentColor,
    fleetId: node.fleetId,
    agentId: node.agentId,
    suppressed: snapshotNode?.lifecycle?.suppressed ?? node.suppressed ?? false,
    suppressedAt: toNullableIsoString(
      snapshotNode?.lifecycle?.suppressedAt ?? node.suppressedAt,
    ),
    pinned: node.pinned ?? false,
    pinnedAt: toNullableIsoString(node.pinnedAt),
    episodeCount: node.episodeCount,
    firstActiveAt: node.firstActiveAt ? toIsoString(node.firstActiveAt) : undefined,
    lastActiveAt: node.lastActiveAt ? toIsoString(node.lastActiveAt) : undefined,
    lastEpisodeId: node.lastEpisodeId,
    revision: node.revision,
    clusterId: node.clusterId,
    createdAt: toIsoString(node.createdAt),
  };
}

export function normalizeTopicEdge(edge: TopicEdge): GraphEdge {
  return {
    sourceId: edge.srcId,
    targetId: edge.dstId,
    type: edge.type,
    connectionLabel: friendlyConnectionLabel(edge.type),
    helperText: friendlyConnectionHelper(edge.type),
    weight: edge.weight,
  };
}

export function normalizeMemory(
  memory: MemoryNode,
  snapshotMemory?: GraphSnapshotMemory,
): GraphMemory {
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
    quality: memory.quality,
    visualImportance: visualImportance(memory),
    qualityDefaulted: memory.qualityDefaulted,
    qualityOrigin: memory.qualityOrigin,
    provenance: memory.provenance,
    reinforcementCount: memory.reinforcementCount,
    lastReinforcedAt: toNullableIsoString(memory.lastReinforcedAt),
    tags: memory.tags,
    sourceUrl: memory.sourceUrl,
    sourceTitle: memory.sourceTitle,
    supersededBy:
      snapshotMemory?.lifecycle?.supersededBy ?? memory.supersededBy,
    decayed: snapshotMemory?.lifecycle?.decayed ?? memory.decayed,
    forgotten:
      snapshotMemory?.lifecycle?.forgotten ?? memory.forgotten ?? false,
    forgottenAt: toNullableIsoString(
      snapshotMemory?.lifecycle?.forgottenAt ?? memory.forgottenAt,
    ),
    hasConflict:
      snapshotMemory?.lifecycle?.hasConflict ?? memory.hasConflict,
    agentColor: memory.agentColor,
    fleetId: memory.fleetId,
    createdAt: toIsoString(memory.createdAt),
  };
}

export function normalizeEpisode(episode: Episode): GraphEpisode {
  return {
    id: episode.id,
    sessionId: episode.sessionId,
    segmentId: episode.segmentId,
    topicId: episode.topicId,
    summary: episode.summary,
    intent: episode.intent,
    outcome: episode.outcome,
    openQuestion: episode.openQuestion,
    messageRange: episode.messageRange,
    episodeOrder: episode.episodeOrder,
    sourceType: episode.sourceType,
    source: episode.source,
    tags: episode.tags,
    assignmentMethod: episode.assignmentMethod,
    assignmentSimilarity: episode.assignmentSimilarity,
    createdAt: toIsoString(episode.createdAt),
  };
}

function normalizeCluster(
  cluster: NonNullable<GraphSnapshot["clusters"]>[number],
): GraphTopicCluster {
  return {
    ...cluster,
    createdAt: toIsoString(cluster.createdAt),
    updatedAt: toIsoString(cluster.updatedAt),
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
    const node = normalizeTopicNode(snapshotNode.node, snapshotNode);
    if (snapshotNode.graftOrigin) {
      const kind = friendlyThemeKind(snapshotNode.node, true);
      node.kind = kind;
      node.kindLabel = friendlyThemeKindLabel(kind);
      node.helperText = friendlyThemeHelper(kind);
      node.graftOrigin = {
        sourceSessionId: snapshotNode.graftOrigin.sourceSessionId,
        sourceNodeId: snapshotNode.graftOrigin.sourceNodeId,
        graftedAt: toIsoString(snapshotNode.graftOrigin.graftedAt),
        sourceLabel: sourceLabelFromSessionId(
          snapshotNode.graftOrigin.sourceSessionId,
        ),
      };
    }
    nodesById.set(node.id, node);
  }

  return {
    sessionId: snapshot.sessionId,
    nodes: [...nodesById.values()],
    edges: snapshot.edges.map(normalizeTopicEdge),
    memories: (snapshot.snapshotMemories ?? []).length
      ? snapshot.snapshotMemories.map((snapshotMemory) =>
          normalizeMemory(snapshotMemory.memory, snapshotMemory),
        )
      : snapshot.memories.map((memory) => normalizeMemory(memory)),
    memoryEdges: (snapshot.memoryEdges ?? []).map(normalizeMemoryEdge),
    episodes: (snapshot.episodes ?? []).map(normalizeEpisode),
    clusters: (snapshot.clusters ?? []).map(normalizeCluster),
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
    nodes: result.nodes.map((node) => normalizeTopicNode(node)),
    episodes: (result.episodes ?? []).map((episode) => ({
      ...normalizeEpisode(episode),
      similarity: episode.similarity,
    })),
    tokenCount: result.tokenCount,
    tokenBudget: result.tokenBudget,
    query: result.query,
    selection: result.selection,
    topicMatches: result.topicMatches,
    degraded: result.degraded,
    warnings: result.warnings?.map(({ code, operation, stage }) => ({
      code,
      operation,
      stage,
    })),
  };
}
