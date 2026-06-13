import { randomBytes, randomUUID } from "node:crypto";
import type {
  CalendarActivityDay,
  EntryDayGroup,
  EntryDocument,
  EntryGraft,
  EntryMessage,
  EntryMessageRole,
  EntryOwnerKind,
  EntryReflection,
  JournalEntry,
  JournalEntryStatus,
  Note,
  NoteDayGroup,
  NoteSourceType,
  ReflectionCard,
  ReflectionShareLink,
  UpdateSettingsRequest,
  UserSettings,
} from "@mindbloom/shared";

import { query } from "../config/db.js";
import { appTables } from "../db/schema.js";

export interface OwnerScope {
  ownerId: string;
  ownerKind: EntryOwnerKind;
}

export interface CreateEntryInput extends OwnerScope {
  title?: string;
  tags?: string[];
  purpose?: string;
  allowFutureContext?: boolean;
}

export interface UpdateEntryInput {
  title?: string;
  tags?: string[];
  purpose?: string;
  status?: JournalEntryStatus;
  allowFutureContext?: boolean;
  completedAt?: string | null;
}

export interface UpsertDocumentInput {
  entryId: string;
  content: string;
  lastIngestedVersion?: number | null;
}

export interface AddMessageInput {
  entryId: string;
  role: EntryMessageRole;
  content: string;
  createdAt?: string;
}

export interface CreateNoteInput extends OwnerScope {
  entryId?: string | null;
  title?: string;
  body: string;
  sourceType: NoteSourceType;
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

export interface UpdateNoteInput {
  title?: string;
  body?: string;
  color?: string | null;
  pinned?: boolean;
}

export interface CreateGraftInput {
  entryId: string;
  query: string;
  sourceEntryId?: string | null;
  sourceEntryTitle?: string | null;
  sourceEntryCreatedAt?: string | null;
  sourceSessionId?: string | null;
  sourceThemeId?: string | null;
  themeLabel: string;
  similarity?: number | null;
  graftedAt?: string;
}

export interface CreateReflectionInput {
  entryId: string;
  cards: ReflectionCard[];
  graphSnapshot: EntryReflection["graphSnapshot"];
  createdAt?: string;
}

export interface CreateShareLinkInput {
  reflectionId: string;
  selectedCardIds: string[];
  expiresAt?: string | null;
}

type EntryRow = {
  id: string;
  owner_id: string;
  owner_kind: EntryOwnerKind;
  title: string;
  tags: string[];
  status: JournalEntryStatus;
  memo_session_id: string;
  allow_future_context: boolean;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
};

type DocumentRow = {
  id: string;
  entry_id: string;
  content: string;
  version: number;
  last_ingested_version: number | null;
  created_at: Date;
  updated_at: Date;
};

type MessageRow = {
  id: string;
  entry_id: string;
  role: EntryMessageRole;
  content: string;
  created_at: Date;
};

type NoteRow = {
  id: string;
  owner_id: string;
  owner_kind: EntryOwnerKind;
  entry_id: string | null;
  title: string;
  body: string;
  source_type: NoteSourceType;
  source_message_id: string | null;
  source_reflection_id: string | null;
  source_reflection_card_id: string | null;
  source_selection_start: number | null;
  source_selection_end: number | null;
  source_excerpt: string | null;
  source_path: string | null;
  color: string | null;
  pinned: boolean;
  created_at: Date;
  updated_at: Date;
};

type GraftRow = {
  id: string;
  entry_id: string;
  query: string;
  source_entry_id: string | null;
  source_entry_title: string | null;
  source_entry_created_at: Date | null;
  source_session_id: string | null;
  source_theme_id: string | null;
  theme_label: string;
  similarity: number | null;
  grafted_at: Date;
};

type ReflectionRow = {
  id: string;
  entry_id: string;
  cards: ReflectionCard[];
  graph_snapshot: EntryReflection["graphSnapshot"];
  created_at: Date;
};

type ShareLinkRow = {
  id: string;
  reflection_id: string;
  token: string;
  selected_card_ids: string[];
  created_at: Date;
  expires_at: Date | null;
  revoked_at: Date | null;
};

type SettingsRow = {
  owner_id: string;
  owner_kind: EntryOwnerKind;
  calendar_enabled: boolean;
  calendar_mode: UserSettings["calendarMode"];
  streaks_enabled: boolean;
  updated_at: Date;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function getMemoSessionIdForEntry(entryId: string): string {
  return `mindbloom-entry-${entryId}`;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function getDateStampFromIso(value: string): string {
  return value.split("T")[0] ?? value;
}

function normalizeEntryTags(tags?: string[], legacyPurpose?: string): string[] {
  const values = [...(tags ?? [])];
  if (legacyPurpose) {
    values.push(legacyPurpose);
  }

  const normalized = values
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

  return [...new Set(normalized)];
}

function createDefaultSettings(): UserSettings {
  return {
    calendarEnabled: false,
    calendarMode: "gentle",
    streaksEnabled: false,
    updatedAt: nowIso(),
  };
}

function getMoodColor(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("calm") || normalized.includes("steady")) return "teal";
  if (normalized.includes("bright") || normalized.includes("happy")) return "amber";
  if (normalized.includes("tender") || normalized.includes("soft")) return "pink";
  if (normalized.includes("heavy") || normalized.includes("tired")) return "blue";
  return "purple";
}

function toEntry(row: EntryRow): JournalEntry {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerKind: row.owner_kind,
    title: row.title,
    tags: row.tags ?? [],
    status: row.status,
    memoSessionId: row.memo_session_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    completedAt: row.completed_at ? toIso(row.completed_at) : null,
    allowFutureContext: row.allow_future_context,
  };
}

function toDocument(row: DocumentRow): EntryDocument {
  return {
    id: row.id,
    entryId: row.entry_id,
    content: row.content,
    version: row.version,
    lastIngestedVersion: row.last_ingested_version,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toMessage(row: MessageRow): EntryMessage {
  return {
    id: row.id,
    entryId: row.entry_id,
    role: row.role,
    content: row.content,
    createdAt: toIso(row.created_at),
  };
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerKind: row.owner_kind,
    entryId: row.entry_id,
    title: row.title,
    body: row.body,
    sourceType: row.source_type,
    sourceMessageId: row.source_message_id,
    sourceReflectionId: row.source_reflection_id,
    sourceReflectionCardId: row.source_reflection_card_id,
    sourceSelectionStart: row.source_selection_start,
    sourceSelectionEnd: row.source_selection_end,
    sourceExcerpt: row.source_excerpt,
    sourcePath: row.source_path,
    color: row.color,
    pinned: row.pinned,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toGraft(row: GraftRow): EntryGraft {
  return {
    id: row.id,
    entryId: row.entry_id,
    query: row.query,
    sourceEntryId: row.source_entry_id,
    sourceEntryTitle: row.source_entry_title,
    sourceEntryCreatedAt: row.source_entry_created_at
      ? toIso(row.source_entry_created_at)
      : null,
    sourceSessionId: row.source_session_id,
    sourceThemeId: row.source_theme_id,
    themeLabel: row.theme_label,
    similarity: row.similarity,
    graftedAt: toIso(row.grafted_at),
  };
}

function toReflection(row: ReflectionRow): EntryReflection {
  return {
    id: row.id,
    entryId: row.entry_id,
    cards: row.cards,
    graphSnapshot: row.graph_snapshot,
    createdAt: toIso(row.created_at),
  };
}

function toShareLink(row: ShareLinkRow): ReflectionShareLink {
  return {
    id: row.id,
    reflectionId: row.reflection_id,
    token: row.token,
    selectedCardIds: row.selected_card_ids,
    createdAt: toIso(row.created_at),
    expiresAt: row.expires_at ? toIso(row.expires_at) : null,
    revokedAt: row.revoked_at ? toIso(row.revoked_at) : null,
  };
}

function toSettings(row: SettingsRow): UserSettings {
  return {
    calendarEnabled: row.calendar_enabled,
    calendarMode: row.calendar_mode,
    streaksEnabled: row.streaks_enabled,
    updatedAt: toIso(row.updated_at),
  };
}

function groupEntries(entries: JournalEntry[]): EntryDayGroup[] {
  const groups = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    const date = getDateStampFromIso(entry.createdAt);
    groups.set(date, [...(groups.get(date) ?? []), entry]);
  }
  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([date, groupEntries]) => ({ date, entries: groupEntries }));
}

function groupNotes(notes: Note[]): NoteDayGroup[] {
  const groups = new Map<string, Note[]>();
  for (const note of notes) {
    const date = getDateStampFromIso(note.createdAt);
    groups.set(date, [...(groups.get(date) ?? []), note]);
  }
  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([date, groupNotes]) => ({ date, notes: groupNotes }));
}

export const entryStore = {
  async getSettings(owner: OwnerScope): Promise<UserSettings> {
    const result = await query<SettingsRow>(
      `SELECT * FROM ${appTables.userSettings}
       WHERE owner_id = $1 AND owner_kind = $2`,
      [owner.ownerId, owner.ownerKind],
    );
    const existing = result.rows[0];
    if (existing) {
      return toSettings(existing);
    }

    const defaults = createDefaultSettings();
    await query(
      `INSERT INTO ${appTables.userSettings}
        (owner_id, owner_kind, calendar_enabled, calendar_mode, streaks_enabled, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (owner_kind, owner_id) DO NOTHING`,
      [
        owner.ownerId,
        owner.ownerKind,
        defaults.calendarEnabled,
        defaults.calendarMode,
        defaults.streaksEnabled,
        defaults.updatedAt,
      ],
    );
    return defaults;
  },

  async updateSettings(
    owner: OwnerScope,
    input: UpdateSettingsRequest,
  ): Promise<UserSettings> {
    const existing = await this.getSettings(owner);
    const calendarMode = input.calendarMode ?? existing.calendarMode;
    const streaksEnabled =
      calendarMode === "habit"
        ? (input.streaksEnabled ?? existing.streaksEnabled)
        : false;
    const updated = {
      ...existing,
      ...input,
      calendarMode,
      streaksEnabled,
    };

    const result = await query<SettingsRow>(
      `INSERT INTO ${appTables.userSettings}
        (owner_id, owner_kind, calendar_enabled, calendar_mode, streaks_enabled, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (owner_kind, owner_id)
       DO UPDATE SET
         calendar_enabled = EXCLUDED.calendar_enabled,
         calendar_mode = EXCLUDED.calendar_mode,
         streaks_enabled = EXCLUDED.streaks_enabled,
         updated_at = now()
       RETURNING *`,
      [
        owner.ownerId,
        owner.ownerKind,
        updated.calendarEnabled,
        updated.calendarMode,
        updated.streaksEnabled,
      ],
    );

    return toSettings(result.rows[0]!);
  },

  async createEntry(input: CreateEntryInput): Promise<JournalEntry> {
    const id = randomUUID();
    const timestamp = nowIso();
    const result = await query<EntryRow>(
      `INSERT INTO ${appTables.journalEntries}
        (id, owner_id, owner_kind, title, tags, status, memo_session_id,
         allow_future_context, created_at, updated_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $8, null)
       RETURNING *`,
      [
        id,
        input.ownerId,
        input.ownerKind,
        input.title?.trim() || "Untitled entry",
        normalizeEntryTags(input.tags, input.purpose),
        getMemoSessionIdForEntry(id),
        input.allowFutureContext ?? true,
        timestamp,
      ],
    );

    return toEntry(result.rows[0]!);
  },

  async getEntry(entryId: string): Promise<JournalEntry | undefined> {
    const result = await query<EntryRow>(
      `SELECT * FROM ${appTables.journalEntries} WHERE id = $1`,
      [entryId],
    );
    return result.rows[0] ? toEntry(result.rows[0]) : undefined;
  },

  async listEntries(owner: OwnerScope): Promise<JournalEntry[]> {
    const result = await query<EntryRow>(
      `SELECT * FROM ${appTables.journalEntries}
       WHERE owner_id = $1 AND owner_kind = $2
       ORDER BY updated_at DESC`,
      [owner.ownerId, owner.ownerKind],
    );
    return result.rows.map(toEntry);
  },

  async listEntriesGroupedByDay(owner: OwnerScope): Promise<EntryDayGroup[]> {
    return groupEntries(await this.listEntries(owner));
  },

  async updateEntry(
    entryId: string,
    input: UpdateEntryInput,
  ): Promise<JournalEntry | undefined> {
    const existing = await this.getEntry(entryId);
    if (!existing) {
      return undefined;
    }

    const tags =
      input.tags !== undefined || input.purpose !== undefined
        ? normalizeEntryTags(input.tags ?? existing.tags, input.purpose)
        : existing.tags;
    const result = await query<EntryRow>(
      `UPDATE ${appTables.journalEntries}
       SET title = $2,
           tags = $3,
           status = $4,
           allow_future_context = $5,
           completed_at = $6,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        entryId,
        input.title?.trim() || existing.title,
        tags,
        input.status ?? existing.status,
        input.allowFutureContext ?? existing.allowFutureContext,
        Object.hasOwn(input, "completedAt")
          ? input.completedAt
          : existing.completedAt,
      ],
    );

    return result.rows[0] ? toEntry(result.rows[0]) : undefined;
  },

  async deleteEntry(entryId: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM ${appTables.journalEntries} WHERE id = $1`,
      [entryId],
    );
    return (result.rowCount ?? 0) > 0;
  },

  async upsertDocument(input: UpsertDocumentInput): Promise<EntryDocument> {
    const existing = await this.getDocument(input.entryId);
    if (
      existing &&
      existing.content === input.content &&
      input.lastIngestedVersion === undefined
    ) {
      return existing;
    }

    const result = await query<DocumentRow>(
      `INSERT INTO ${appTables.entryDocuments}
        (id, entry_id, content, version, last_ingested_version, created_at, updated_at)
       VALUES ($1, $2, $3, 1, $4, now(), now())
       ON CONFLICT (entry_id)
       DO UPDATE SET
         content = EXCLUDED.content,
         version = ${appTables.entryDocuments}.version + 1,
         last_ingested_version = COALESCE(EXCLUDED.last_ingested_version, ${appTables.entryDocuments}.last_ingested_version),
         updated_at = now()
       RETURNING *`,
      [
        existing?.id ?? randomUUID(),
        input.entryId,
        input.content,
        input.lastIngestedVersion ?? existing?.lastIngestedVersion ?? null,
      ],
    );

    return toDocument(result.rows[0]!);
  },

  async getDocument(entryId: string): Promise<EntryDocument | undefined> {
    const result = await query<DocumentRow>(
      `SELECT * FROM ${appTables.entryDocuments} WHERE entry_id = $1`,
      [entryId],
    );
    return result.rows[0] ? toDocument(result.rows[0]) : undefined;
  },

  async markDocumentIngested(
    entryId: string,
    version: number,
  ): Promise<EntryDocument | undefined> {
    const result = await query<DocumentRow>(
      `UPDATE ${appTables.entryDocuments}
       SET last_ingested_version = $2, updated_at = now()
       WHERE entry_id = $1
       RETURNING *`,
      [entryId, version],
    );
    return result.rows[0] ? toDocument(result.rows[0]) : undefined;
  },

  async addMessage(input: AddMessageInput): Promise<EntryMessage> {
    const result = await query<MessageRow>(
      `INSERT INTO ${appTables.entryMessages}
        (id, entry_id, role, content, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        randomUUID(),
        input.entryId,
        input.role,
        input.content,
        input.createdAt ?? nowIso(),
      ],
    );
    return toMessage(result.rows[0]!);
  },

  async listMessages(entryId: string): Promise<EntryMessage[]> {
    const result = await query<MessageRow>(
      `SELECT * FROM ${appTables.entryMessages}
       WHERE entry_id = $1
       ORDER BY created_at ASC`,
      [entryId],
    );
    return result.rows.map(toMessage);
  },

  async createNote(input: CreateNoteInput): Promise<Note> {
    const result = await query<NoteRow>(
      `INSERT INTO ${appTables.notes}
        (id, owner_id, owner_kind, entry_id, title, body, source_type,
         source_message_id, source_reflection_id, source_reflection_card_id,
         source_selection_start, source_selection_end, source_excerpt, source_path,
         color, pinned, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now(), now())
       RETURNING *`,
      [
        randomUUID(),
        input.ownerId,
        input.ownerKind,
        input.entryId ?? null,
        input.title?.trim() || "Untitled note",
        input.body,
        input.sourceType,
        input.sourceMessageId ?? null,
        input.sourceReflectionId ?? null,
        input.sourceReflectionCardId ?? null,
        input.sourceSelectionStart ?? null,
        input.sourceSelectionEnd ?? null,
        input.sourceExcerpt ?? null,
        input.sourcePath ?? null,
        input.color ?? null,
        input.pinned ?? false,
      ],
    );
    return toNote(result.rows[0]!);
  },

  async listNotes(owner: OwnerScope): Promise<Note[]> {
    const result = await query<NoteRow>(
      `SELECT * FROM ${appTables.notes}
       WHERE owner_id = $1 AND owner_kind = $2
       ORDER BY pinned DESC, created_at DESC`,
      [owner.ownerId, owner.ownerKind],
    );
    return result.rows.map(toNote);
  },

  async listNotesGroupedByDay(owner: OwnerScope): Promise<NoteDayGroup[]> {
    return groupNotes(await this.listNotes(owner));
  },

  async listNotesForEntry(entryId: string, owner: OwnerScope): Promise<Note[]> {
    const notes = await this.listNotes(owner);
    return notes.filter((note) => note.entryId === entryId);
  },

  async getNote(noteId: string): Promise<Note | undefined> {
    const result = await query<NoteRow>(
      `SELECT * FROM ${appTables.notes} WHERE id = $1`,
      [noteId],
    );
    return result.rows[0] ? toNote(result.rows[0]) : undefined;
  },

  async updateNote(
    noteId: string,
    input: UpdateNoteInput,
  ): Promise<Note | undefined> {
    const existing = await this.getNote(noteId);
    if (!existing) {
      return undefined;
    }

    const result = await query<NoteRow>(
      `UPDATE ${appTables.notes}
       SET title = $2,
           body = $3,
           color = $4,
           pinned = $5,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        noteId,
        input.title?.trim() || existing.title,
        input.body ?? existing.body,
        Object.hasOwn(input, "color") ? input.color : existing.color,
        input.pinned ?? existing.pinned,
      ],
    );
    return result.rows[0] ? toNote(result.rows[0]) : undefined;
  },

  async deleteNote(noteId: string): Promise<boolean> {
    const result = await query(`DELETE FROM ${appTables.notes} WHERE id = $1`, [
      noteId,
    ]);
    return (result.rowCount ?? 0) > 0;
  },

  async createGraft(input: CreateGraftInput): Promise<EntryGraft> {
    const result = await query<GraftRow>(
      `INSERT INTO ${appTables.entryGrafts}
        (id, entry_id, query, source_entry_id, source_entry_title,
         source_entry_created_at, source_session_id, source_theme_id,
         theme_label, similarity, grafted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        randomUUID(),
        input.entryId,
        input.query,
        input.sourceEntryId ?? null,
        input.sourceEntryTitle ?? null,
        input.sourceEntryCreatedAt ?? null,
        input.sourceSessionId ?? null,
        input.sourceThemeId ?? null,
        input.themeLabel,
        input.similarity ?? null,
        input.graftedAt ?? nowIso(),
      ],
    );
    return toGraft(result.rows[0]!);
  },

  async listGrafts(entryId: string): Promise<EntryGraft[]> {
    const result = await query<GraftRow>(
      `SELECT * FROM ${appTables.entryGrafts}
       WHERE entry_id = $1
       ORDER BY grafted_at DESC`,
      [entryId],
    );
    return result.rows.map(toGraft);
  },

  async createReflection(input: CreateReflectionInput): Promise<EntryReflection> {
    const result = await query<ReflectionRow>(
      `INSERT INTO ${appTables.entryReflections}
        (id, entry_id, cards, graph_snapshot, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        randomUUID(),
        input.entryId,
        JSON.stringify(input.cards),
        JSON.stringify(input.graphSnapshot),
        input.createdAt ?? nowIso(),
      ],
    );
    return toReflection(result.rows[0]!);
  },

  async listReflections(entryId: string): Promise<EntryReflection[]> {
    const result = await query<ReflectionRow>(
      `SELECT * FROM ${appTables.entryReflections}
       WHERE entry_id = $1
       ORDER BY created_at DESC`,
      [entryId],
    );
    return result.rows.map(toReflection);
  },

  async getReflection(reflectionId: string): Promise<EntryReflection | undefined> {
    const result = await query<ReflectionRow>(
      `SELECT * FROM ${appTables.entryReflections} WHERE id = $1`,
      [reflectionId],
    );
    return result.rows[0] ? toReflection(result.rows[0]) : undefined;
  },

  async listCalendarActivity(owner: OwnerScope): Promise<CalendarActivityDay[]> {
    const entries = await this.listEntries(owner);
    const notes = await this.listNotes(owner);
    const days = new Map<string, CalendarActivityDay>();
    const ensureDay = (date: string): CalendarActivityDay => {
      const existing = days.get(date);
      if (existing) return existing;
      const day = {
        date,
        entryCount: 0,
        noteCount: 0,
        reflectionCount: 0,
        moodLabel: null,
        moodColor: null,
      } satisfies CalendarActivityDay;
      days.set(date, day);
      return day;
    };

    for (const entry of entries) ensureDay(getDateStampFromIso(entry.createdAt)).entryCount += 1;
    for (const note of notes) ensureDay(getDateStampFromIso(note.createdAt)).noteCount += 1;
    for (const entry of entries) {
      for (const reflection of await this.listReflections(entry.id)) {
        const day = ensureDay(getDateStampFromIso(reflection.createdAt));
        day.reflectionCount += 1;
        const moodCard = reflection.cards.find((card) => card.type === "mood");
        if (moodCard) {
          day.moodLabel = moodCard.body || moodCard.title;
          day.moodColor = getMoodColor(day.moodLabel);
        }
      }
    }

    return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
  },

  async createShareLink(input: CreateShareLinkInput): Promise<ReflectionShareLink> {
    const result = await query<ShareLinkRow>(
      `INSERT INTO ${appTables.reflectionShareLinks}
        (id, reflection_id, token, selected_card_ids, created_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, now(), $5, null)
       RETURNING *`,
      [
        randomUUID(),
        input.reflectionId,
        randomBytes(24).toString("base64url"),
        input.selectedCardIds,
        input.expiresAt ?? null,
      ],
    );
    return toShareLink(result.rows[0]!);
  },

  async listShareLinks(reflectionId: string): Promise<ReflectionShareLink[]> {
    const result = await query<ShareLinkRow>(
      `SELECT * FROM ${appTables.reflectionShareLinks}
       WHERE reflection_id = $1
       ORDER BY created_at DESC`,
      [reflectionId],
    );
    return result.rows.map(toShareLink);
  },

  async getShareLink(shareLinkId: string): Promise<ReflectionShareLink | undefined> {
    const result = await query<ShareLinkRow>(
      `SELECT * FROM ${appTables.reflectionShareLinks} WHERE id = $1`,
      [shareLinkId],
    );
    return result.rows[0] ? toShareLink(result.rows[0]) : undefined;
  },

  async getShareLinkByToken(token: string): Promise<ReflectionShareLink | undefined> {
    const result = await query<ShareLinkRow>(
      `SELECT * FROM ${appTables.reflectionShareLinks} WHERE token = $1`,
      [token],
    );
    return result.rows[0] ? toShareLink(result.rows[0]) : undefined;
  },

  async revokeShareLink(
    shareLinkId: string,
  ): Promise<ReflectionShareLink | undefined> {
    const result = await query<ShareLinkRow>(
      `UPDATE ${appTables.reflectionShareLinks}
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE id = $1
       RETURNING *`,
      [shareLinkId],
    );
    return result.rows[0] ? toShareLink(result.rows[0]) : undefined;
  },

  async clear(): Promise<void> {
    await query(`DELETE FROM ${appTables.reflectionShareLinks}`);
    await query(`DELETE FROM ${appTables.entryReflections}`);
    await query(`DELETE FROM ${appTables.notes}`);
    await query(`DELETE FROM ${appTables.entryGrafts}`);
    await query(`DELETE FROM ${appTables.entryMessages}`);
    await query(`DELETE FROM ${appTables.entryDocuments}`);
    await query(`DELETE FROM ${appTables.journalEntries}`);
    await query(`DELETE FROM ${appTables.userSettings}`);
  },
};
