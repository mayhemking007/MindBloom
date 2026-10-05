export interface HealthResponse {
  ok: boolean;
  service: "mindbloom-api";
  version: string;
}

export interface TodaySessionResponse {
  sessionId: string;
  date: string;
}

export type MindBloomDocumentSource = "notion";
export type MindBloomDocumentStatus = "pending" | "ready" | "failed";
export type MindBloomIngestionStatus = "idle" | "accepted" | "queued" | "running" | "retry_pending" | "completed" | "completed_with_warnings" | "failed" | "cancelled" | "abandoned";
export type MindBloomIngestionPhase = "accepted" | "segmenting" | "extracted" | "selected" | "embedded" | "prepared" | "committed" | "finished";

export interface MindBloomIngestionSummary {
  runId: string | null;
  status: MindBloomIngestionStatus;
  phase: MindBloomIngestionPhase | null;
  counts: Record<string, unknown>;
  warnings: Array<{ code: string; operation: string; stage?: string }>;
  durationMs: number | null;
}

export interface MindBloomDocument {
  id: string;
  source: MindBloomDocumentSource;
  externalId: string;
  title: string;
  content: string;
  sourceUrl: string;
  sourceCreatedAt: string;
  sourceUpdatedAt: string;
  memoSessionId: string;
  status: MindBloomDocumentStatus;
  ingestion: MindBloomIngestionSummary;
  lastSyncedAt: string | null;
  syncState: "in_sync" | "local_changes";
  localSavedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotionPageSummary {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  importedDocumentId: string | null;
}

export interface NotionPagesResponse { pages: NotionPageSummary[]; }
export interface MindBloomDocumentsResponse { documents: MindBloomDocument[]; }
export interface MindBloomDocumentResponse { document: MindBloomDocument; }
export interface UpdateNotionDocumentRequest {
  content: string;
  expectedSourceUpdatedAt: string;
}
export interface SaveMindBloomDocumentRequest { content: string; }
export interface ImportNotionPagesRequest { pageIds: string[]; }
export interface ImportNotionPageResult {
  pageId: string;
  document: MindBloomDocument | null;
  status: "imported" | "processing" | "unchanged" | "failed";
  error?: string;
}
export interface ImportNotionPagesResponse { results: ImportNotionPageResult[]; }

export interface RelatedThought {
  id: string;
  memoryId: string;
  documentId: string;
  documentTitle: string;
  sourceUrl: string;
  text: string;
  theme: string;
  memoryType: MemoryType;
  sectionId: string | null;
  sectionTitle: string | null;
  relevance: number | null;
}
export interface RelatedThoughtsResponse { thoughts: RelatedThought[]; }

export interface NotionBloomMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
export interface NotionBloomRequest { question?: string; thoughtId?: string; }
export interface NotionBloomResponse {
  answer: string;
  messages: NotionBloomMessage[];
  sources: RelatedThought[];
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

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface AuthMeResponse {
  user: AuthUser | null;
  ownerKind: EntryOwnerKind;
}

export type CalendarMode = "gentle" | "habit";

export interface UserSettings {
  calendarEnabled: boolean;
  calendarMode: CalendarMode;
  streaksEnabled: boolean;
  updatedAt: string;
}

export interface UpdateSettingsRequest {
  calendarEnabled?: boolean;
  calendarMode?: CalendarMode;
  streaksEnabled?: boolean;
}

export interface SettingsResponse {
  settings: UserSettings;
}

export interface CalendarActivityDay {
  date: string;
  entryCount: number;
  noteCount: number;
  reflectionCount: number;
  moodLabel: string | null;
  moodColor: string | null;
}

export interface CalendarActivityResponse {
  days: CalendarActivityDay[];
  settings: UserSettings;
}

export type SuggestedEntryTag = "journal" | "idea" | "brainstorm";

export type JournalEntryStatus = "draft" | "completed";

export type EntryOwnerKind = "authenticated" | "demo";

export interface JournalEntry {
  id: string;
  ownerId: string;
  ownerKind: EntryOwnerKind;
  title: string;
  tags: string[];
  status: JournalEntryStatus;
  memoSessionId: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  allowFutureContext: boolean;
}

export interface EntryDocument {
  id: string;
  entryId: string;
  content: string;
  version: number;
  lastIngestedVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

export type EntryMessageRole = "user" | "assistant" | "system";

export interface EntryMessage {
  id: string;
  entryId: string;
  role: EntryMessageRole;
  content: string;
  createdAt: string;
}

export interface EntryTheme {
  id: string;
  entryId: string;
  label: string;
  summary: string;
  topicOrder: number;
  source: "current-entry" | "brought-in-context";
}

export interface EntryGraft {
  id: string;
  entryId: string;
  query: string;
  sourceEntryId: string | null;
  sourceEntryTitle: string | null;
  sourceEntryCreatedAt: string | null;
  sourceSessionId: string | null;
  sourceThemeId: string | null;
  themeLabel: string;
  similarity: number | null;
  graftedAt: string;
}

export type NoteSourceType =
  | "entry-selection"
  | "bloom-message"
  | "reflection-card"
  | "blank";

export interface Note {
  id: string;
  ownerId: string;
  ownerKind: EntryOwnerKind;
  entryId: string | null;
  title: string;
  body: string;
  sourceType: NoteSourceType;
  sourceMessageId: string | null;
  sourceReflectionId: string | null;
  sourceReflectionCardId: string | null;
  sourceSelectionStart: number | null;
  sourceSelectionEnd: number | null;
  sourceExcerpt: string | null;
  sourcePath: string | null;
  color: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteDayGroup {
  date: string;
  notes: Note[];
}

export interface CreateNoteRequest {
  title?: string;
  body: string;
  entryId?: string | null;
  sourceType?: NoteSourceType;
  sourceMessageId?: string | null;
  sourceReflectionId?: string | null;
  sourceReflectionCardId?: string | null;
  sourceSelectionStart?: number | null;
  sourceSelectionEnd?: number | null;
  sourceExcerpt?: string | null;
  sourcePath?: string | null;
  color?: string | null;
  pinned?: boolean;
}

export interface UpdateNoteRequest {
  title?: string;
  body?: string;
  color?: string | null;
  pinned?: boolean;
}

export interface NoteResponse {
  note: Note;
}

export interface NotesResponse {
  notes: Note[];
  groups: NoteDayGroup[];
}

export interface ReflectionCard {
  id: string;
  type:
    | "stats"
    | "mood"
    | "takeaways"
    | "mind-map"
    | "quote"
    | "song"
    | "weather"
    | "word"
    | "question";
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface EntryReflection {
  id: string;
  entryId: string;
  cards: ReflectionCard[];
  graphSnapshot: GraphSnapshotResponse | null;
  createdAt: string;
}

export interface CreateEntryReflectionRequest {
  force?: boolean;
}

export interface EntryReflectionResponse {
  reflection: EntryReflection;
}

export interface EntryReflectionsResponse {
  reflections: EntryReflection[];
}

export interface ReflectionShareLink {
  id: string;
  reflectionId: string;
  token: string;
  selectedCardIds: string[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface CreateReflectionShareLinkRequest {
  selectedCardIds: string[];
  expiresAt?: string | null;
}

export interface ReflectionShareLinkResponse {
  shareLink: ReflectionShareLink;
}

export interface ReflectionShareLinksResponse {
  shareLinks: ReflectionShareLink[];
}

export interface PublicReflectionShareResponse {
  token: string;
  cards: ReflectionCard[];
  createdAt: string;
  expiresAt: string | null;
}

export interface EntryDayGroup {
  date: string;
  entries: JournalEntry[];
}

export interface CreateEntryRequest {
  title?: string;
  tags?: string[];
  purpose?: SuggestedEntryTag;
  allowFutureContext?: boolean;
}

export interface UpdateEntryRequest {
  title?: string;
  tags?: string[];
  purpose?: SuggestedEntryTag;
  status?: JournalEntryStatus;
  allowFutureContext?: boolean;
  completedAt?: string | null;
}

export interface EntryListResponse {
  groups: EntryDayGroup[];
  entries: JournalEntry[];
}

export interface EntryResponse {
  entry: JournalEntry;
}

export interface UpsertEntryDocumentRequest {
  content: string;
}

export interface EntryDocumentResponse {
  document: EntryDocument | null;
}

export interface CreateEntryMessageRequest {
  role: EntryMessageRole;
  content: string;
}

export interface EntryMessagesResponse {
  messages: EntryMessage[];
}

export interface EntryMessageResponse {
  message: EntryMessage;
}

export interface IngestEntryRequest {
  content?: string;
  force?: boolean;
}

export type EntryIngestSkippedReason =
  | "no-document"
  | "empty-document"
  | "unchanged-document";

export interface EntryIngestResponse {
  document: EntryDocument | null;
  ingested: boolean;
  cleared?: boolean;
  skippedReason?: EntryIngestSkippedReason;
  topicPills: TopicPill[];
}

export type GraftExpansionStrategy = "none" | "graph";

export interface GraftByRelevanceRequest {
  query: string;
  sourceEntryIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  maxThemes?: number;
  minSimilarity?: number;
  expansionDepth?: number;
  expansionStrategy?: GraftExpansionStrategy;
}

export interface EntryGraftsResponse {
  grafts: EntryGraft[];
}

export interface EntryGraftRelevanceResponse {
  grafts: EntryGraft[];
  topicPills: TopicPill[];
  tokenCount: number;
}

export interface GraftOrigin {
  sourceSessionId: string;
  sourceNodeId: string;
  graftedAt: string;
  sourceLabel?: string;
}

export type GraphThemeKind =
  | "theme"
  | "returning-theme"
  | "brought-in-context";

export interface GraphNode {
  id: string;
  sessionId: string;
  segmentId: string;
  label: string;
  summary: string;
  kind?: GraphThemeKind;
  kindLabel?: string;
  helperText?: string;
  tags?: string[];
  messageRange: [number, number];
  topicOrder: number;
  driftScore: number;
  agentColor: string | null;
  fleetId: string | null;
  agentId: string | null;
  suppressed?: boolean;
  suppressedAt?: string | null;
  pinned?: boolean;
  pinnedAt?: string | null;
  episodeCount?: number;
  firstActiveAt?: string;
  lastActiveAt?: string;
  lastEpisodeId?: string | null;
  revision?: number;
  clusterId?: string | null;
  createdAt: string;
  graftOrigin?: GraftOrigin;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  type: string;
  connectionLabel?: string;
  helperText?: string;
  weight: number;
}

export type MemoryType = "fact" | "insight" | "question" | "task" | "reference";

export type MemorySourceType = "conversation" | "note" | "document" | "code";

export interface GraphMemoryQuality {
  explicitness: number;
  sourceReliability: number;
  stability: number;
  salience: number;
}

export interface GraphMemoryProvenance {
  speaker: "user" | "assistant" | "system" | "document";
  messageIndexes: number[];
  sessionId: string;
  extractionMethod:
    | "explicit"
    | "inferred"
    | "user-confirmed"
    | "document-extraction";
}

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
  quality: GraphMemoryQuality;
  /** MindBloom-owned display weight. This is not a probability or truth score. */
  visualImportance: number;
  qualityDefaulted?: Array<keyof GraphMemoryQuality>;
  qualityOrigin?: "extracted" | "provided" | "legacy";
  provenance?: GraphMemoryProvenance | null;
  reinforcementCount?: number;
  lastReinforcedAt?: string | null;
  tags?: string[];
  sourceUrl: string | null;
  sourceTitle: string | null;
  supersededBy: string | null;
  decayed: boolean;
  forgotten?: boolean;
  forgottenAt?: string | null;
  hasConflict?: boolean;
  agentColor: string | null;
  fleetId: string | null;
  createdAt: string;
}

export interface GraphEpisode {
  id: string;
  sessionId: string;
  segmentId: string;
  topicId: string;
  summary: string;
  intent: string;
  outcome: string;
  openQuestion: string | null;
  messageRange: [number, number];
  episodeOrder: number;
  sourceType: MemorySourceType;
  source?: string;
  tags?: string[];
  assignmentMethod: "created" | "embedding" | "llm" | "backfill";
  assignmentSimilarity: number | null;
  createdAt: string;
}

export interface GraphTopicCluster {
  id: string;
  sessionId: string;
  label: string;
  normalizedLabel: string;
  aliases?: string[];
  description: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
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
  episodes: GraphEpisode[];
  clusters: GraphTopicCluster[];
  capturedAt: string;
}

export interface RecallFact extends GraphMemory {
  similarity: number;
}

export interface RecallResponse {
  facts: RecallFact[];
  nodes: GraphNode[];
  episodes: Array<GraphEpisode & { similarity: number }>;
  tokenCount: number;
  tokenBudget?: number;
  query?: {
    original: string;
    retrieval: string;
    contextualized: boolean;
    contextMessageCount: number;
    status: "not-needed" | "applied" | "fallback" | "disabled";
  };
  selection?: {
    candidateCount: number;
    memoryCandidateCount: number;
    topicCandidateCount: number;
    episodeCandidateCount?: number;
    rankedCount: number;
    selectedFactCount: number;
    selectedTopicCount: number;
    selectedEpisodeCount?: number;
    topicOnlyMatchCount: number;
    reason:
      | "exhausted"
      | "fact-limit"
      | "topic-limit"
      | "relative-score"
      | "score-gap"
      | "token-budget";
  };
  topicMatches?: Array<{
    topicId: string;
    matchedBy: Array<"memory" | "topic">;
    score: number;
  }>;
  degraded?: boolean;
  warnings?: Array<{ code: string; operation: string; stage?: string }>;
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
