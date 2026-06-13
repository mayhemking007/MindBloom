import type {
  AuthMeResponse,
  AuthResponse,
  BloomRequest,
  BloomResponse,
  CalendarActivityResponse,
  ChatRequest,
  ChatResponse,
  CreateEntryMessageRequest,
  CreateEntryRequest,
  CreateNoteRequest,
  EntryDocumentResponse,
  EntryGraftRelevanceResponse,
  EntryGraftsResponse,
  EntryIngestResponse,
  EntryListResponse,
  EntryMessage,
  EntryMessageResponse,
  EntryMessagesResponse,
  EntryReflectionResponse,
  EntryReflectionsResponse,
  EntryResponse,
  GraftByRelevanceRequest,
  GraphSnapshotResponse,
  LoginRequest,
  NoteResponse,
  NotesResponse,
  PublicReflectionShareResponse,
  ReflectRequest,
  ReflectResponse,
  ReflectionShareLinkResponse,
  ReflectionShareLinksResponse,
  RegisterRequest,
  SettingsResponse,
  TodaySessionResponse,
  TopicPill,
  UpdateEntryRequest,
  UpdateNoteRequest,
  UpdateSettingsRequest,
  UpsertEntryDocumentRequest,
} from "@mindbloom/shared";
import { demoStore } from "./demoStore";

export interface BloomStreamHandlers {
  onUserMessage?: (message: EntryMessage) => void;
  onToken?: (chunk: string) => void;
  onDone?: (payload: {
    message: EntryMessage;
    topicPills: TopicPill[];
  }) => void;
  onError?: (message: string) => void;
}

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

let apiOwnerKind: "authenticated" | "demo" = "demo";

export function setApiOwnerKind(ownerKind: "authenticated" | "demo") {
  apiOwnerKind = ownerKind;
}

function isDemoMode() {
  return apiOwnerKind === "demo";
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? (data as { error?: { message?: string } }).error?.message
        : undefined;
    throw new Error(message ?? "MindBloom could not reach the API.");
  }

  return data as T;
}

const credentialOptions = { credentials: "include" as const };

function jsonHeaders() {
  return {
    "Content-Type": "application/json",
  };
}

export async function registerUser(payload: RegisterRequest): Promise<AuthResponse> {
  const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<AuthResponse>(response);
}

export async function loginUser(payload: LoginRequest): Promise<AuthResponse> {
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<AuthResponse>(response);
}

export async function logoutUser(): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    await parseJsonResponse<unknown>(response);
  }
}

export async function getCurrentAuth(): Promise<AuthMeResponse> {
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, credentialOptions);
  return parseJsonResponse<AuthMeResponse>(response);
}

export async function getSettings(): Promise<SettingsResponse> {
  if (isDemoMode()) {
    return demoStore.getSettings();
  }
  const response = await fetch(`${apiBaseUrl}/api/settings`, credentialOptions);
  return parseJsonResponse<SettingsResponse>(response);
}

export async function updateSettings(
  payload: UpdateSettingsRequest,
): Promise<SettingsResponse> {
  if (isDemoMode()) {
    return demoStore.updateSettings(payload);
  }
  const response = await fetch(`${apiBaseUrl}/api/settings`, {
    method: "PATCH",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<SettingsResponse>(response);
}

export async function getCalendarActivity(): Promise<CalendarActivityResponse> {
  if (isDemoMode()) {
    return demoStore.getCalendarActivity();
  }
  const response = await fetch(
    `${apiBaseUrl}/api/calendar/activity`,
    credentialOptions,
  );
  return parseJsonResponse<CalendarActivityResponse>(response);
}

export async function getTodaySession(): Promise<TodaySessionResponse> {
  const response = await fetch(`${apiBaseUrl}/api/session/today`);
  return parseJsonResponse<TodaySessionResponse>(response);
}

export async function sendChatMessage(
  payload: ChatRequest,
): Promise<ChatResponse> {
  const response = await fetch(`${apiBaseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse<ChatResponse>(response);
}

export async function generateBloom(
  sessionId: string,
): Promise<BloomResponse> {
  const payload: BloomRequest = { sessionId };
  const response = await fetch(`${apiBaseUrl}/api/bloom`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse<BloomResponse>(response);
}

export async function getSnapshot(
  sessionId: string,
): Promise<GraphSnapshotResponse> {
  const params = new URLSearchParams({ sessionId });
  const response = await fetch(`${apiBaseUrl}/api/snapshot?${params}`);
  return parseJsonResponse<GraphSnapshotResponse>(response);
}

export async function generateReflection(
  payload: ReflectRequest,
): Promise<ReflectResponse> {
  const response = await fetch(`${apiBaseUrl}/api/reflect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse<ReflectResponse>(response);
}

export async function listEntries(): Promise<EntryListResponse> {
  if (isDemoMode()) {
    return demoStore.listEntries();
  }
  const response = await fetch(`${apiBaseUrl}/api/entries`, credentialOptions);
  return parseJsonResponse<EntryListResponse>(response);
}

export async function updateEntry(
  entryId: string,
  payload: UpdateEntryRequest,
): Promise<EntryResponse> {
  if (isDemoMode()) {
    return demoStore.updateEntry(entryId, payload);
  }
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<EntryResponse>(response);
}

export async function createEntry(
  payload: CreateEntryRequest,
): Promise<EntryResponse> {
  if (isDemoMode()) {
    return demoStore.createEntry(payload);
  }
  const response = await fetch(`${apiBaseUrl}/api/entries`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<EntryResponse>(response);
}

export async function deleteEntry(entryId: string): Promise<void> {
  if (isDemoMode()) {
    demoStore.deleteEntry(entryId);
    return;
  }
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    await parseJsonResponse<unknown>(response);
  }
}

export async function getEntryDocument(
  entryId: string,
): Promise<EntryDocumentResponse> {
  if (isDemoMode()) {
    return demoStore.getEntryDocument(entryId);
  }
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}/document`, {
    ...credentialOptions,
  });
  return parseJsonResponse<EntryDocumentResponse>(response);
}

export async function saveEntryDocument(
  entryId: string,
  payload: UpsertEntryDocumentRequest,
): Promise<EntryDocumentResponse> {
  if (isDemoMode()) {
    return demoStore.saveEntryDocument(entryId, payload);
  }
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}/document`, {
    method: "PUT",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<EntryDocumentResponse>(response);
}

export async function ingestEntryDocument(
  entryId: string,
  payload: { content?: string; force?: boolean } = {},
): Promise<EntryIngestResponse> {
  if (isDemoMode()) {
    return demoStore.ingestEntryDocument(entryId, payload);
  }
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}/ingest`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<EntryIngestResponse>(response);
}

export async function getEntrySnapshot(
  entryId: string,
  scope = "overall",
): Promise<GraphSnapshotResponse> {
  if (isDemoMode()) {
    return demoStore.getEntrySnapshot(entryId);
  }
  const params = new URLSearchParams({ scope });
  const response = await fetch(
    `${apiBaseUrl}/api/entries/${entryId}/snapshot?${params}`,
    credentialOptions,
  );
  return parseJsonResponse<GraphSnapshotResponse>(response);
}

export async function listEntryMessages(
  entryId: string,
): Promise<EntryMessagesResponse> {
  if (isDemoMode()) {
    return demoStore.listEntryMessages(entryId);
  }
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}/messages`, {
    ...credentialOptions,
  });
  return parseJsonResponse<EntryMessagesResponse>(response);
}

export async function createEntryMessage(
  entryId: string,
  payload: CreateEntryMessageRequest,
): Promise<EntryMessageResponse> {
  if (isDemoMode()) {
    return demoStore.createEntryMessage(entryId, payload);
  }
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}/messages`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<EntryMessageResponse>(response);
}

export async function streamEntryMessage(
  entryId: string,
  content: string,
  handlers: BloomStreamHandlers,
  signal?: AbortSignal,
  context?: {
    documentDraft?: string;
    entryTags?: string[];
    broughtInContext?: string[];
    selectedText?: string;
  },
): Promise<void> {
  if (isDemoMode()) {
    await demoStore.streamEntryMessage(entryId, content, handlers);
    return;
  }
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}/messages/stream`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify({ content, ...context }),
    signal,
  });

  if (!response.ok || !response.body) {
    await parseJsonResponse<unknown>(response);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function processEvent(rawEvent: string) {
    const lines = rawEvent.split("\n");
    const event = lines
      .find((line) => line.startsWith("event:"))
      ?.slice("event:".length)
      .trim();
    const data = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .join("\n");

    if (!event || !data) {
      return;
    }

    const payload = JSON.parse(data) as unknown;
    if (
      event === "user-message" &&
      payload &&
      typeof payload === "object" &&
      "message" in payload
    ) {
      handlers.onUserMessage?.((payload as { message: EntryMessage }).message);
      return;
    }

    if (
      event === "token" &&
      payload &&
      typeof payload === "object" &&
      "chunk" in payload
    ) {
      handlers.onToken?.(String((payload as { chunk: string }).chunk));
      return;
    }

    if (
      event === "done" &&
      payload &&
      typeof payload === "object" &&
      "message" in payload
    ) {
      handlers.onDone?.(
        payload as { message: EntryMessage; topicPills: TopicPill[] },
      );
      return;
    }

    if (
      event === "error" &&
      payload &&
      typeof payload === "object" &&
      "message" in payload
    ) {
      handlers.onError?.(String((payload as { message: string }).message));
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let boundaryIndex = buffer.indexOf("\n\n");
    while (boundaryIndex !== -1) {
      const rawEvent = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);
      processEvent(rawEvent);
      boundaryIndex = buffer.indexOf("\n\n");
    }

    if (done) {
      if (buffer.trim()) {
        processEvent(buffer);
      }
      break;
    }
  }
}

export async function listEntryGrafts(
  entryId: string,
): Promise<EntryGraftsResponse> {
  if (isDemoMode()) {
    return demoStore.listEntryGrafts(entryId);
  }
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}/grafts`, {
    ...credentialOptions,
  });
  return parseJsonResponse<EntryGraftsResponse>(response);
}

export async function graftEntryByRelevance(
  entryId: string,
  payload: GraftByRelevanceRequest,
): Promise<EntryGraftRelevanceResponse> {
  if (isDemoMode()) {
    return demoStore.graftEntryByRelevance(entryId, payload);
  }
  const response = await fetch(
    `${apiBaseUrl}/api/entries/${entryId}/grafts/relevance`,
    {
      method: "POST",
      headers: jsonHeaders(),
      credentials: "include",
      body: JSON.stringify(payload),
    },
  );
  return parseJsonResponse<EntryGraftRelevanceResponse>(response);
}

export async function listEntryReflections(
  entryId: string,
): Promise<EntryReflectionsResponse> {
  if (isDemoMode()) {
    return demoStore.listEntryReflections(entryId);
  }
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}/reflections`, {
    ...credentialOptions,
  });
  return parseJsonResponse<EntryReflectionsResponse>(response);
}

export async function createEntryReflection(
  entryId: string,
): Promise<EntryReflectionResponse> {
  if (isDemoMode()) {
    return demoStore.createEntryReflection(entryId);
  }
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}/reflections`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify({}),
  });
  return parseJsonResponse<EntryReflectionResponse>(response);
}

export async function getEntryReflection(
  entryId: string,
  reflectionId: string,
): Promise<EntryReflectionResponse> {
  if (isDemoMode()) {
    return demoStore.getEntryReflection(entryId, reflectionId);
  }
  const response = await fetch(
    `${apiBaseUrl}/api/entries/${entryId}/reflections/${reflectionId}`,
    {
      ...credentialOptions,
    },
  );
  return parseJsonResponse<EntryReflectionResponse>(response);
}

export async function listReflectionShareLinks(
  reflectionId: string,
): Promise<ReflectionShareLinksResponse> {
  if (isDemoMode()) {
    return demoStore.listReflectionShareLinks(reflectionId);
  }
  const response = await fetch(
    `${apiBaseUrl}/api/reflections/${reflectionId}/share-links`,
    {
      ...credentialOptions,
    },
  );
  return parseJsonResponse<ReflectionShareLinksResponse>(response);
}

export async function createReflectionShareLink(
  reflectionId: string,
  payload: { selectedCardIds: string[]; expiresAt?: string | null },
): Promise<ReflectionShareLinkResponse> {
  if (isDemoMode()) {
    return demoStore.createReflectionShareLink(reflectionId, payload);
  }
  const response = await fetch(
    `${apiBaseUrl}/api/reflections/${reflectionId}/share-links`,
    {
      method: "POST",
      headers: jsonHeaders(),
      credentials: "include",
      body: JSON.stringify(payload),
    },
  );
  return parseJsonResponse<ReflectionShareLinkResponse>(response);
}

export async function revokeReflectionShareLink(
  shareLinkId: string,
): Promise<void> {
  if (isDemoMode()) {
    demoStore.revokeReflectionShareLink(shareLinkId);
    return;
  }
  const response = await fetch(`${apiBaseUrl}/api/share-links/${shareLinkId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    await parseJsonResponse<unknown>(response);
  }
}

export async function getPublicReflectionShare(
  token: string,
): Promise<PublicReflectionShareResponse> {
  if (isDemoMode()) {
    return demoStore.getPublicReflectionShare(token);
  }
  const response = await fetch(`${apiBaseUrl}/api/share/${token}`);
  return parseJsonResponse<PublicReflectionShareResponse>(response);
}

export async function listNotes(): Promise<NotesResponse> {
  if (isDemoMode()) {
    return demoStore.listNotes();
  }
  const response = await fetch(`${apiBaseUrl}/api/notes`, credentialOptions);
  return parseJsonResponse<NotesResponse>(response);
}

export async function createNote(
  payload: CreateNoteRequest,
): Promise<NoteResponse> {
  if (isDemoMode()) {
    return demoStore.createNote(payload);
  }
  const response = await fetch(`${apiBaseUrl}/api/notes`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<NoteResponse>(response);
}

export async function updateNote(
  noteId: string,
  payload: UpdateNoteRequest,
): Promise<NoteResponse> {
  if (isDemoMode()) {
    return demoStore.updateNote(noteId, payload);
  }
  const response = await fetch(`${apiBaseUrl}/api/notes/${noteId}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<NoteResponse>(response);
}

export async function deleteNote(noteId: string): Promise<void> {
  if (isDemoMode()) {
    demoStore.deleteNote(noteId);
    return;
  }
  const response = await fetch(`${apiBaseUrl}/api/notes/${noteId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    await parseJsonResponse<unknown>(response);
  }
}
