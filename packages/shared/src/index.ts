export interface HealthResponse {
  ok: boolean;
  service: "mindbloom-api";
  version: string;
}

export interface TodaySessionResponse {
  sessionId: string;
  date: string;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
}

export interface TopicPill {
  id: string;
  label: string;
  topicOrder: number;
}

export interface ChatResponse {
  reply: string;
  topicPills: TopicPill[];
}

export interface ApiErrorResponse {
  error: {
    message: string;
  };
}

export interface GraftOrigin {
  sourceSessionId: string;
  sourceNodeId: string;
  graftedAt: string;
}

export interface GraphNode {
  id: string;
  sessionId: string;
  segmentId: string;
  label: string;
  summary: string;
  tags?: string[];
  messageRange: [number, number];
  topicOrder: number;
  driftScore: number;
  agentColor: string | null;
  fleetId: string | null;
  agentId: string | null;
  createdAt: string;
  graftOrigin?: GraftOrigin;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  type: string;
  weight: number;
}

export type MemoryType = "fact" | "insight" | "question" | "task" | "reference";

export type MemorySourceType = "conversation" | "note" | "document" | "code";

export interface GraphMemory {
  id: string;
  segmentId: string;
  topicNodeId: string;
  agentId: string | null;
  sessionId: string;
  memoryType: MemoryType;
  sourceType: MemorySourceType;
  subject: string;
  predicate: string;
  value: string;
  confidence: number;
  tags?: string[];
  sourceUrl: string | null;
  sourceTitle: string | null;
  supersededBy: string | null;
  decayed: boolean;
  hasConflict?: boolean;
  agentColor: string | null;
  fleetId: string | null;
  createdAt: string;
}

export interface MemoryEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: "semantic" | "conflicts" | "updates" | "related";
  weight: number;
  createdAt: string;
}

export interface GraphSnapshotResponse {
  sessionId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  memories: GraphMemory[];
  memoryEdges: MemoryEdge[];
  capturedAt: string;
}

export interface RecallFact extends GraphMemory {
  similarity: number;
}

export interface RecallResponse {
  facts: RecallFact[];
  nodes: GraphNode[];
  tokenCount: number;
}

export interface BloomRequest {
  sessionId: string;
}

export interface BloomInsights {
  mood: string;
  moodArc: string;
  archetype: string;
  archetypeCaption: string;
  sessionSong: string;
  wordOfDay: string;
  wordOfDayCopy: string;
  recurringThread: string;
  shareableTagline: string;
}

export interface BloomResponse {
  insights: BloomInsights;
  snapshot: GraphSnapshotResponse;
  topWord: string;
  sessionId: string;
  capturedAt: string;
}

export interface ReflectRequest {
  sourceSessionIds: string[];
  reflectionSessionId?: string;
}

export interface ReflectionInsights {
  recurringThemes: string[];
  resurfacingTopics: string[];
  emotionalShifts: string;
  questionsForNextWeek: string[];
  weeklyTagline: string;
}

export interface GraftedSource {
  reflectionNodeId: string;
  sourceSessionId: string;
  sourceNodeId: string;
  graftedAt: string;
}

export interface ReflectResponse {
  reflectionSessionId: string;
  sourceSessionIds: string[];
  insights: ReflectionInsights;
  snapshot: GraphSnapshotResponse;
  graftedSources: GraftedSource[];
  capturedAt: string;
}

export function getSessionIdForDate(date: string): string {
  return `mindbloom-session-${date}`;
}

export function getDateStamp(date = new Date()): string {
  return date.toISOString().split("T")[0] ?? "";
}

export function getTodaySessionId(date = new Date()): string {
  return getSessionIdForDate(getDateStamp(date));
}

export function getIsoWeekStamp(date = new Date()): string {
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );

  return `${utcDate.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}

export function getReflectionSessionId(date = new Date()): string {
  return `mindbloom-reflection-${getIsoWeekStamp(date)}`;
}
