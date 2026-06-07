import { randomBytes, randomUUID } from "node:crypto";
import type {
  EntryDayGroup,
  EntryDocument,
  EntryGraft,
  EntryMessage,
  EntryMessageRole,
  EntryMode,
  EntryOwnerKind,
  EntryPurpose,
  EntryReflection,
  JournalEntry,
  JournalEntryStatus,
  Note,
  NoteDayGroup,
  NoteSourceType,
  ReflectionCard,
  ReflectionShareLink,
} from "@mindbloom/shared";

export interface OwnerScope {
  ownerId: string;
  ownerKind: EntryOwnerKind;
}

export interface CreateEntryInput extends OwnerScope {
  title?: string;
  purpose: EntryPurpose;
  mode: EntryMode;
  allowFutureContext?: boolean;
}

export interface UpdateEntryInput {
  title?: string;
  purpose?: EntryPurpose;
  mode?: EntryMode;
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

function nowIso(): string {
  return new Date().toISOString();
}

export function getMemoSessionIdForEntry(entryId: string): string {
  return `mindbloom-entry-${entryId}`;
}

function getDateStampFromIso(value: string): string {
  return value.split("T")[0] ?? value;
}

function assertOwner(entry: JournalEntry, owner: OwnerScope): void {
  if (entry.ownerId !== owner.ownerId || entry.ownerKind !== owner.ownerKind) {
    throw new Error("Entry does not belong to owner scope");
  }
}

export class InMemoryEntryStore {
  private readonly entries = new Map<string, JournalEntry>();

  private readonly documents = new Map<string, EntryDocument>();

  private readonly messages = new Map<string, EntryMessage>();

  private readonly notes = new Map<string, Note>();

  private readonly grafts = new Map<string, EntryGraft>();

  private readonly reflections = new Map<string, EntryReflection>();

  private readonly shareLinks = new Map<string, ReflectionShareLink>();

  createEntry(input: CreateEntryInput): JournalEntry {
    const id = randomUUID();
    const timestamp = nowIso();
    const entry: JournalEntry = {
      id,
      ownerId: input.ownerId,
      ownerKind: input.ownerKind,
      title: input.title?.trim() || "Untitled entry",
      purpose: input.purpose,
      mode: input.mode,
      status: "draft",
      memoSessionId: getMemoSessionIdForEntry(id),
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      allowFutureContext: input.allowFutureContext ?? true,
    };

    this.entries.set(entry.id, entry);
    return entry;
  }

  getEntry(entryId: string): JournalEntry | undefined {
    return this.entries.get(entryId);
  }

  getOwnedEntry(entryId: string, owner: OwnerScope): JournalEntry | undefined {
    const entry = this.getEntry(entryId);
    if (!entry) {
      return undefined;
    }

    assertOwner(entry, owner);
    return entry;
  }

  listEntries(owner: OwnerScope): JournalEntry[] {
    return [...this.entries.values()]
      .filter(
        (entry) =>
          entry.ownerId === owner.ownerId && entry.ownerKind === owner.ownerKind,
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  listEntriesGroupedByDay(owner: OwnerScope): EntryDayGroup[] {
    const groups = new Map<string, JournalEntry[]>();

    for (const entry of this.listEntries(owner)) {
      const date = getDateStampFromIso(entry.createdAt);
      groups.set(date, [...(groups.get(date) ?? []), entry]);
    }

    return [...groups.entries()]
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([date, entries]) => ({ date, entries }));
  }

  updateEntry(entryId: string, input: UpdateEntryInput): JournalEntry | undefined {
    const existing = this.entries.get(entryId);
    if (!existing) {
      return undefined;
    }

    const updated: JournalEntry = {
      ...existing,
      ...input,
      title: input.title?.trim() || existing.title,
      updatedAt: nowIso(),
    };

    this.entries.set(entryId, updated);
    return updated;
  }

  deleteEntry(entryId: string): boolean {
    const deleted = this.entries.delete(entryId);
    if (!deleted) {
      return false;
    }

    this.documents.delete(entryId);
    for (const [messageId, message] of this.messages.entries()) {
      if (message.entryId === entryId) {
        this.messages.delete(messageId);
      }
    }
    for (const [graftId, graft] of this.grafts.entries()) {
      if (graft.entryId === entryId) {
        this.grafts.delete(graftId);
      }
    }
    for (const [reflectionId, reflection] of this.reflections.entries()) {
      if (reflection.entryId === entryId) {
        this.reflections.delete(reflectionId);
        for (const [shareLinkId, shareLink] of this.shareLinks.entries()) {
          if (shareLink.reflectionId === reflectionId) {
            this.shareLinks.delete(shareLinkId);
          }
        }
      }
    }

    return true;
  }

  upsertDocument(input: UpsertDocumentInput): EntryDocument {
    const existing = this.documents.get(input.entryId);
    if (
      existing &&
      existing.content === input.content &&
      input.lastIngestedVersion === undefined
    ) {
      return existing;
    }

    const timestamp = nowIso();
    const document: EntryDocument = {
      id: existing?.id ?? randomUUID(),
      entryId: input.entryId,
      content: input.content,
      version: (existing?.version ?? 0) + 1,
      lastIngestedVersion:
        input.lastIngestedVersion ?? existing?.lastIngestedVersion ?? null,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    this.documents.set(input.entryId, document);
    return document;
  }

  getDocument(entryId: string): EntryDocument | undefined {
    return this.documents.get(entryId);
  }

  markDocumentIngested(entryId: string, version: number): EntryDocument | undefined {
    const existing = this.documents.get(entryId);
    if (!existing) {
      return undefined;
    }

    const updated: EntryDocument = {
      ...existing,
      lastIngestedVersion: version,
      updatedAt: nowIso(),
    };

    this.documents.set(entryId, updated);
    return updated;
  }

  addMessage(input: AddMessageInput): EntryMessage {
    const message: EntryMessage = {
      id: randomUUID(),
      entryId: input.entryId,
      role: input.role,
      content: input.content,
      createdAt: input.createdAt ?? nowIso(),
    };

    this.messages.set(message.id, message);
    return message;
  }

  listMessages(entryId: string): EntryMessage[] {
    return [...this.messages.values()]
      .filter((message) => message.entryId === entryId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  createNote(input: CreateNoteInput): Note {
    const timestamp = nowIso();
    const note: Note = {
      id: randomUUID(),
      ownerId: input.ownerId,
      ownerKind: input.ownerKind,
      entryId: input.entryId ?? null,
      title: input.title?.trim() || "Untitled note",
      body: input.body,
      sourceType: input.sourceType,
      sourceMessageId: input.sourceMessageId ?? null,
      sourceReflectionId: input.sourceReflectionId ?? null,
      sourceReflectionCardId: input.sourceReflectionCardId ?? null,
      color: input.color ?? null,
      pinned: input.pinned ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.notes.set(note.id, note);
    return note;
  }

  listNotes(owner: OwnerScope): Note[] {
    return [...this.notes.values()]
      .filter(
        (note) => note.ownerId === owner.ownerId && note.ownerKind === owner.ownerKind,
      )
      .sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
  }

  listNotesGroupedByDay(owner: OwnerScope): NoteDayGroup[] {
    const groups = new Map<string, Note[]>();

    for (const note of this.listNotes(owner)) {
      const date = getDateStampFromIso(note.createdAt);
      groups.set(date, [...(groups.get(date) ?? []), note]);
    }

    return [...groups.entries()]
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([date, notes]) => ({ date, notes }));
  }

  listNotesForEntry(entryId: string, owner: OwnerScope): Note[] {
    return this.listNotes(owner).filter((note) => note.entryId === entryId);
  }

  getNote(noteId: string): Note | undefined {
    return this.notes.get(noteId);
  }

  updateNote(noteId: string, input: UpdateNoteInput): Note | undefined {
    const existing = this.notes.get(noteId);
    if (!existing) {
      return undefined;
    }

    const updated: Note = {
      ...existing,
      ...input,
      title: input.title?.trim() || existing.title,
      updatedAt: nowIso(),
    };

    this.notes.set(noteId, updated);
    return updated;
  }

  deleteNote(noteId: string): boolean {
    return this.notes.delete(noteId);
  }

  createGraft(input: CreateGraftInput): EntryGraft {
    const graft: EntryGraft = {
      id: randomUUID(),
      entryId: input.entryId,
      query: input.query,
      sourceEntryId: input.sourceEntryId ?? null,
      sourceEntryTitle: input.sourceEntryTitle ?? null,
      sourceEntryCreatedAt: input.sourceEntryCreatedAt ?? null,
      sourceSessionId: input.sourceSessionId ?? null,
      sourceThemeId: input.sourceThemeId ?? null,
      themeLabel: input.themeLabel,
      similarity: input.similarity ?? null,
      graftedAt: input.graftedAt ?? nowIso(),
    };

    this.grafts.set(graft.id, graft);
    return graft;
  }

  listGrafts(entryId: string): EntryGraft[] {
    return [...this.grafts.values()]
      .filter((graft) => graft.entryId === entryId)
      .sort((a, b) => b.graftedAt.localeCompare(a.graftedAt));
  }

  createReflection(input: CreateReflectionInput): EntryReflection {
    const reflection: EntryReflection = {
      id: randomUUID(),
      entryId: input.entryId,
      cards: input.cards,
      graphSnapshot: input.graphSnapshot,
      createdAt: input.createdAt ?? nowIso(),
    };

    this.reflections.set(reflection.id, reflection);
    return reflection;
  }

  listReflections(entryId: string): EntryReflection[] {
    return [...this.reflections.values()]
      .filter((reflection) => reflection.entryId === entryId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getReflection(reflectionId: string): EntryReflection | undefined {
    return this.reflections.get(reflectionId);
  }

  createShareLink(input: CreateShareLinkInput): ReflectionShareLink {
    const shareLink: ReflectionShareLink = {
      id: randomUUID(),
      reflectionId: input.reflectionId,
      token: randomBytes(24).toString("base64url"),
      selectedCardIds: input.selectedCardIds,
      createdAt: nowIso(),
      expiresAt: input.expiresAt ?? null,
      revokedAt: null,
    };

    this.shareLinks.set(shareLink.id, shareLink);
    return shareLink;
  }

  listShareLinks(reflectionId: string): ReflectionShareLink[] {
    return [...this.shareLinks.values()]
      .filter((shareLink) => shareLink.reflectionId === reflectionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getShareLink(shareLinkId: string): ReflectionShareLink | undefined {
    return this.shareLinks.get(shareLinkId);
  }

  getShareLinkByToken(token: string): ReflectionShareLink | undefined {
    return [...this.shareLinks.values()].find(
      (shareLink) => shareLink.token === token,
    );
  }

  revokeShareLink(shareLinkId: string): ReflectionShareLink | undefined {
    const existing = this.shareLinks.get(shareLinkId);
    if (!existing) {
      return undefined;
    }

    const revoked: ReflectionShareLink = {
      ...existing,
      revokedAt: existing.revokedAt ?? nowIso(),
    };

    this.shareLinks.set(shareLinkId, revoked);
    return revoked;
  }

  clear(): void {
    this.entries.clear();
    this.documents.clear();
    this.messages.clear();
    this.notes.clear();
    this.grafts.clear();
    this.reflections.clear();
    this.shareLinks.clear();
  }
}

export const entryStore = new InMemoryEntryStore();
