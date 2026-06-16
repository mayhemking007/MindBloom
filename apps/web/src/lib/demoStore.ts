import type {
  CalendarActivityDay,
  CalendarActivityResponse,
  CreateEntryRequest,
  CreateEntryMessageRequest,
  CreateNoteRequest,
  EntryDayGroup,
  EntryDocument,
  EntryDocumentResponse,
  EntryGraftRelevanceResponse,
  EntryGraftsResponse,
  EntryIngestResponse,
  EntryListResponse,
  EntryMessage,
  EntryMessageResponse,
  EntryMessagesResponse,
  EntryReflection,
  EntryReflectionResponse,
  EntryReflectionsResponse,
  EntryResponse,
  GraftByRelevanceRequest,
  GraphSnapshotResponse,
  MemoryType,
  JournalEntry,
  Note,
  NoteResponse,
  NotesResponse,
  PublicReflectionShareResponse,
  ReflectionShareLink,
  ReflectionShareLinkResponse,
  ReflectionShareLinksResponse,
  SettingsResponse,
  TopicPill,
  UpdateEntryRequest,
  UpdateNoteRequest,
  UpdateSettingsRequest,
  UpsertEntryDocumentRequest,
  UserSettings,
} from "@mindbloom/shared";
import type { BloomStreamHandlers } from "./api";

interface DemoState {
  entries: JournalEntry[];
  documents: EntryDocument[];
  messages: EntryMessage[];
  notes: Note[];
  grafts: Array<{
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
  }>;
  reflections: EntryReflection[];
  shareLinks: ReflectionShareLink[];
  settings: UserSettings;
}

const demoStorageKey = "mindbloom:demo:data:v1";
const demoOwnerId = "demo-local";

function nowIso(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function defaultSettings(): UserSettings {
  return {
    calendarEnabled: false,
    calendarMode: "gentle",
    streaksEnabled: false,
    updatedAt: nowIso(),
  };
}

function emptyState(): DemoState {
  return {
    entries: [],
    documents: [],
    messages: [],
    notes: [],
    grafts: [],
    reflections: [],
    shareLinks: [],
    settings: defaultSettings(),
  };
}

function readState(): DemoState {
  try {
    const raw = localStorage.getItem(demoStorageKey);
    if (!raw) {
      return emptyState();
    }
    return { ...emptyState(), ...(JSON.parse(raw) as Partial<DemoState>) };
  } catch {
    return emptyState();
  }
}

function writeState(state: DemoState): void {
  localStorage.setItem(demoStorageKey, JSON.stringify(state));
}

function updateState<T>(mutate: (state: DemoState) => T): T {
  const state = readState();
  const result = mutate(state);
  writeState(state);
  return result;
}

function groupEntries(entries: JournalEntry[]): EntryDayGroup[] {
  const groups = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    const date = entry.createdAt.split("T")[0] ?? entry.createdAt;
    groups.set(date, [...(groups.get(date) ?? []), entry]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, group]) => ({ date, entries: group }));
}

function groupNotes(notes: Note[]) {
  const groups = new Map<string, Note[]>();
  for (const note of notes) {
    const date = note.createdAt.split("T")[0] ?? note.createdAt;
    groups.set(date, [...(groups.get(date) ?? []), note]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, group]) => ({ date, notes: group }));
}

function getEntryOrThrow(state: DemoState, entryId: string): JournalEntry {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry) {
    throw new Error("Entry not found");
  }
  return entry;
}

function topicPillsFor(text: string, tags: string[] = []): TopicPill[] {
  const words = text
    .toLowerCase()
    .match(/[a-z]{4,}/g)
    ?.filter((word) => !["this", "that", "with", "from", "have", "your"].includes(word))
    .slice(0, 3) ?? [];
  return [...new Set([...tags, ...words])].slice(0, 5).map((label, index) => ({
    id: `demo-topic-${label}-${index}`,
    label,
    topicOrder: index + 1,
  }));
}

const demoMemoryTypes: MemoryType[] = ["insight", "question", "fact"];

function demoMemoryValue(label: string, type: MemoryType): string {
  switch (type) {
    case "insight":
      return `There is energy around ${label}, and it may be asking for attention.`;
    case "question":
      return `What would make ${label} feel clearer or lighter today?`;
    case "fact":
      return `${label} appeared as a theme in this entry.`;
    case "task":
      return `Choose one small next step for ${label}.`;
    case "reference":
      return `This entry mentioned ${label} as useful context.`;
    default:
      return `${label} appeared as a theme in this entry.`;
  }
}

export const demoStore = {
  listEntries(): EntryListResponse {
    const entries = readState().entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { entries, groups: groupEntries(entries) };
  },

  createEntry(payload: CreateEntryRequest): EntryResponse {
    return updateState((state) => {
      if (state.entries.length >= 1) {
        throw new Error("Demo mode supports one journal entry");
      }
      const timestamp = nowIso();
      const entry: JournalEntry = {
        id: id("demo-entry"),
        ownerId: demoOwnerId,
        ownerKind: "demo",
        title: payload.title?.trim() || "Untitled entry",
        tags: [...new Set([...(payload.tags ?? []), payload.purpose].filter(Boolean) as string[])],
        status: "draft",
        memoSessionId: id("demo-session"),
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt: null,
        allowFutureContext: payload.allowFutureContext ?? true,
      };
      state.entries.unshift(entry);
      return { entry };
    });
  },

  updateEntry(entryId: string, payload: UpdateEntryRequest): EntryResponse {
    return updateState((state) => {
      const entry = getEntryOrThrow(state, entryId);
      Object.assign(entry, {
        ...payload,
        title: payload.title?.trim() || entry.title,
        tags: payload.tags ?? entry.tags,
        updatedAt: nowIso(),
      });
      return { entry };
    });
  },

  deleteEntry(entryId: string): void {
    updateState((state) => {
      state.entries = state.entries.filter((entry) => entry.id !== entryId);
      state.documents = state.documents.filter((doc) => doc.entryId !== entryId);
      state.messages = state.messages.filter((message) => message.entryId !== entryId);
      state.notes = state.notes.filter((note) => note.entryId !== entryId);
      state.grafts = state.grafts.filter((graft) => graft.entryId !== entryId);
      state.reflections = state.reflections.filter((reflection) => reflection.entryId !== entryId);
    });
  },

  getEntryDocument(entryId: string): EntryDocumentResponse {
    return { document: readState().documents.find((doc) => doc.entryId === entryId) ?? null };
  },

  saveEntryDocument(entryId: string, payload: UpsertEntryDocumentRequest): EntryDocumentResponse {
    return updateState((state) => {
      getEntryOrThrow(state, entryId);
      const existing = state.documents.find((doc) => doc.entryId === entryId);
      if (existing && existing.content === payload.content) {
        return { document: existing };
      }
      const timestamp = nowIso();
      const document: EntryDocument = {
        id: existing?.id ?? id("demo-document"),
        entryId,
        content: payload.content,
        version: (existing?.version ?? 0) + 1,
        lastIngestedVersion: existing?.lastIngestedVersion ?? null,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      state.documents = state.documents.filter((doc) => doc.entryId !== entryId);
      state.documents.push(document);
      return { document };
    });
  },

  ingestEntryDocument(entryId: string, payload: { content?: string; force?: boolean } = {}): EntryIngestResponse {
    return updateState((state) => {
      let saved = state.documents.find((doc) => doc.entryId === entryId);
      if (payload.content !== undefined) {
        getEntryOrThrow(state, entryId);
        if (!saved || saved.content !== payload.content) {
          const timestamp = nowIso();
          saved = {
            id: saved?.id ?? id("demo-document"),
            entryId,
            content: payload.content,
            version: (saved?.version ?? 0) + 1,
            lastIngestedVersion: saved?.lastIngestedVersion ?? null,
            createdAt: saved?.createdAt ?? timestamp,
            updatedAt: timestamp,
          };
          state.documents = state.documents.filter((doc) => doc.entryId !== entryId);
          state.documents.push(saved);
        }
      }
      if (!saved) {
        return { document: null, ingested: false, skippedReason: "no-document", topicPills: [] };
      }
      if (saved.content.trim().length < 12) {
        saved.lastIngestedVersion = saved.version;
        return { document: saved, ingested: false, cleared: true, skippedReason: "empty-document", topicPills: [] };
      }
      if (!payload.force && saved.lastIngestedVersion === saved.version) {
        return { document: saved, ingested: false, skippedReason: "unchanged-document", topicPills: topicPillsFor(saved.content) };
      }
      saved.lastIngestedVersion = saved.version;
      return { document: saved, ingested: true, topicPills: topicPillsFor(saved.content) };
    });
  },

  getEntrySnapshot(entryId: string): GraphSnapshotResponse {
    const state = readState();
    const entry = getEntryOrThrow(state, entryId);
    const doc = state.documents.find((item) => item.entryId === entryId);
    const nodes = topicPillsFor(doc?.content ?? "", entry.tags).map((pill) => ({
      id: pill.id,
      sessionId: entry.memoSessionId,
      segmentId: "demo-segment",
      label: pill.label,
      summary: `Demo theme from this entry: ${pill.label}.`,
      kind: "theme" as const,
      kindLabel: "Theme",
      helperText: "Stored locally in this browser.",
      tags: [],
      messageRange: [0, 0] as [number, number],
      topicOrder: pill.topicOrder,
      driftScore: 0,
      agentColor: null,
      fleetId: null,
      agentId: null,
      createdAt: entry.createdAt,
    }));
    const memories = nodes.flatMap((node, nodeIndex) =>
      demoMemoryTypes.slice(0, nodeIndex === 0 ? 3 : 2).map((memoryType, memoryIndex) => ({
        id: `${node.id}-memory-${memoryType}`,
        segmentId: node.segmentId,
        topicNodeId: node.id,
        agentId: null,
        sessionId: node.sessionId,
        memoryType,
        sourceType: "document" as const,
        subject: node.label,
        predicate: memoryType,
        value: demoMemoryValue(node.label, memoryType),
        confidence: Math.max(0.52, 0.92 - nodeIndex * 0.08 - memoryIndex * 0.12),
        tags: [],
        sourceUrl: null,
        sourceTitle: entry.title,
        supersededBy: null,
        decayed: false,
        hasConflict: false,
        agentColor: null,
        fleetId: null,
        createdAt: entry.createdAt,
      })),
    );
    const edges = nodes.slice(1).map((node, index) => ({
      sourceId: nodes[index]?.id ?? node.id,
      targetId: node.id,
      type: index % 3 === 1 ? "semantic" : index % 3 === 2 ? "reentry" : "temporal",
      connectionLabel: index % 3 === 2 ? "Returning thought" : "Related thought",
      helperText: "Demo connection between nearby themes.",
      weight: 0.7,
    }));
    return {
      sessionId: entry.memoSessionId,
      nodes,
      edges,
      memories,
      memoryEdges: [],
      capturedAt: nowIso(),
    };
  },

  listEntryMessages(entryId: string): EntryMessagesResponse {
    return { messages: readState().messages.filter((message) => message.entryId === entryId) };
  },

  createEntryMessage(entryId: string, payload: CreateEntryMessageRequest): EntryMessageResponse {
    return updateState((state) => {
      getEntryOrThrow(state, entryId);
      const message: EntryMessage = {
        id: id("demo-message"),
        entryId,
        role: payload.role,
        content: payload.content,
        createdAt: nowIso(),
      };
      state.messages.push(message);
      return { message };
    });
  },

  async streamEntryMessage(
    entryId: string,
    content: string,
    handlers: BloomStreamHandlers,
  ): Promise<void> {
    const userMessage = this.createEntryMessage(entryId, { role: "user", content }).message;
    handlers.onUserMessage?.(userMessage);
    const reply = "In demo mode, Bloom keeps this conversation local to your browser. I can still help you shape the thought here.";
    handlers.onToken?.(reply);
    const assistantMessage = this.createEntryMessage(entryId, { role: "assistant", content: reply }).message;
    handlers.onDone?.({ message: assistantMessage, topicPills: topicPillsFor(content) });
  },

  listEntryGrafts(entryId: string): EntryGraftsResponse {
    return { grafts: readState().grafts.filter((graft) => graft.entryId === entryId) };
  },

  graftEntryByRelevance(entryId: string, payload: GraftByRelevanceRequest): EntryGraftRelevanceResponse {
    return updateState((state) => {
      getEntryOrThrow(state, entryId);
      const graft = {
        id: id("demo-graft"),
        entryId,
        query: payload.query,
        sourceEntryId: null,
        sourceEntryTitle: "Local demo context",
        sourceEntryCreatedAt: null,
        sourceSessionId: null,
        sourceThemeId: null,
        themeLabel: payload.query,
        similarity: null,
        graftedAt: nowIso(),
      };
      state.grafts.unshift(graft);
      return { grafts: [graft], topicPills: topicPillsFor(payload.query), tokenCount: 0 };
    });
  },

  listEntryReflections(entryId: string): EntryReflectionsResponse {
    return { reflections: readState().reflections.filter((reflection) => reflection.entryId === entryId) };
  },

  createEntryReflection(entryId: string): EntryReflectionResponse {
    return updateState((state) => {
      const entry = getEntryOrThrow(state, entryId);
      const doc = state.documents.find((item) => item.entryId === entryId);
      const reflection: EntryReflection = {
        id: id("demo-reflection"),
        entryId,
        graphSnapshot: this.getEntrySnapshot(entryId),
        createdAt: nowIso(),
        cards: [
          { id: "mood", type: "mood", title: "Demo Mood", body: doc?.content ? "Reflective" : "Unwritten" },
          { id: "word", type: "word", title: "Your Word Today", body: entry.tags[0] ?? "Begin" },
          { id: "question", type: "question", title: "Question", body: "What feels worth keeping from this entry?" },
        ],
      };
      state.reflections.unshift(reflection);
      return { reflection };
    });
  },

  getEntryReflection(entryId: string, reflectionId: string): EntryReflectionResponse {
    const reflection = readState().reflections.find((item) => item.id === reflectionId && item.entryId === entryId);
    if (!reflection) throw new Error("Reflection not found");
    return { reflection };
  },

  listReflectionShareLinks(reflectionId: string): ReflectionShareLinksResponse {
    return { shareLinks: readState().shareLinks.filter((link) => link.reflectionId === reflectionId) };
  },

  createReflectionShareLink(reflectionId: string, payload: { selectedCardIds: string[]; expiresAt?: string | null }): ReflectionShareLinkResponse {
    return updateState((state) => {
      const reflection = state.reflections.find((item) => item.id === reflectionId);
      if (!reflection) throw new Error("Reflection not found");
      const validIds = new Set(reflection.cards.map((card) => card.id));
      const invalid = payload.selectedCardIds.find((cardId) => !validIds.has(cardId));
      if (invalid) throw new Error(`Unknown reflection card: ${invalid}`);
      const shareLink: ReflectionShareLink = {
        id: id("demo-share"),
        reflectionId,
        token: randomToken(),
        selectedCardIds: [...new Set(payload.selectedCardIds)],
        createdAt: nowIso(),
        expiresAt: payload.expiresAt ?? null,
        revokedAt: null,
      };
      state.shareLinks.unshift(shareLink);
      return { shareLink };
    });
  },

  revokeReflectionShareLink(shareLinkId: string): void {
    updateState((state) => {
      const link = state.shareLinks.find((item) => item.id === shareLinkId);
      if (link) link.revokedAt = nowIso();
    });
  },

  getPublicReflectionShare(token: string): PublicReflectionShareResponse {
    const state = readState();
    const link = state.shareLinks.find((item) => item.token === token && !item.revokedAt);
    if (!link) throw new Error("Shared reflection not found");
    const reflection = state.reflections.find((item) => item.id === link.reflectionId);
    if (!reflection) throw new Error("Shared reflection not found");
    const selected = new Set(link.selectedCardIds);
    return {
      token,
      cards: reflection.cards.filter((card) => selected.has(card.id)),
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
    };
  },

  listNotes(): NotesResponse {
    const notes = readState().notes.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
    return { notes, groups: groupNotes(notes) };
  },

  createNote(payload: CreateNoteRequest): NoteResponse {
    return updateState((state) => {
      const note: Note = {
        id: id("demo-note"),
        ownerId: demoOwnerId,
        ownerKind: "demo",
        entryId: payload.entryId ?? null,
        title: payload.title?.trim() || "Untitled note",
        body: payload.body,
        sourceType: payload.sourceType ?? "blank",
        sourceMessageId: payload.sourceMessageId ?? null,
        sourceReflectionId: payload.sourceReflectionId ?? null,
        sourceReflectionCardId: payload.sourceReflectionCardId ?? null,
        sourceSelectionStart: payload.sourceSelectionStart ?? null,
        sourceSelectionEnd: payload.sourceSelectionEnd ?? null,
        sourceExcerpt: payload.sourceExcerpt ?? null,
        sourcePath: payload.sourcePath ?? null,
        color: payload.color ?? null,
        pinned: payload.pinned ?? false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.notes.unshift(note);
      return { note };
    });
  },

  updateNote(noteId: string, payload: UpdateNoteRequest): NoteResponse {
    return updateState((state) => {
      const note = state.notes.find((item) => item.id === noteId);
      if (!note) throw new Error("Note not found");
      Object.assign(note, payload, { title: payload.title?.trim() || note.title, updatedAt: nowIso() });
      return { note };
    });
  },

  deleteNote(noteId: string): void {
    updateState((state) => {
      state.notes = state.notes.filter((note) => note.id !== noteId);
    });
  },

  getSettings(): SettingsResponse {
    return { settings: readState().settings };
  },

  updateSettings(payload: UpdateSettingsRequest): SettingsResponse {
    return updateState((state) => {
      state.settings = {
        ...state.settings,
        ...payload,
        streaksEnabled: (payload.calendarMode ?? state.settings.calendarMode) === "habit"
          ? (payload.streaksEnabled ?? state.settings.streaksEnabled)
          : false,
        updatedAt: nowIso(),
      };
      return { settings: state.settings };
    });
  },

  getCalendarActivity(): CalendarActivityResponse {
    const state = readState();
    const days = new Map<string, CalendarActivityDay>();
    const ensure = (date: string) => {
      const existing = days.get(date);
      if (existing) return existing;
      const day: CalendarActivityDay = { date, entryCount: 0, noteCount: 0, reflectionCount: 0, moodLabel: null, moodColor: null };
      days.set(date, day);
      return day;
    };
    for (const entry of state.entries) ensure(entry.createdAt.split("T")[0] ?? entry.createdAt).entryCount += 1;
    for (const note of state.notes) ensure(note.createdAt.split("T")[0] ?? note.createdAt).noteCount += 1;
    for (const reflection of state.reflections) ensure(reflection.createdAt.split("T")[0] ?? reflection.createdAt).reflectionCount += 1;
    return { days: [...days.values()].sort((a, b) => b.date.localeCompare(a.date)), settings: state.settings };
  },
};

function randomToken(): string {
  const values = new Uint8Array(18);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(36).padStart(2, "0")).join("");
}
