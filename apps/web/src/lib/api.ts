import type {
  BloomRequest,
  BloomResponse,
  ChatRequest,
  ChatResponse,
  CreateEntryMessageRequest,
  CreateEntryRequest,
  CreateNoteRequest,
  EntryDocumentResponse,
  EntryGraftRelevanceResponse,
  EntryGraftsResponse,
  EntryListResponse,
  EntryMessageResponse,
  EntryMessagesResponse,
  EntryResponse,
  GraftByRelevanceRequest,
  GraphSnapshotResponse,
  NoteResponse,
  NotesResponse,
  ReflectRequest,
  ReflectResponse,
  TodaySessionResponse,
  UpdateEntryRequest,
  UpdateNoteRequest,
  UpsertEntryDocumentRequest,
} from "@mindbloom/shared";

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

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

const ownerHeaders = {
  "x-mindbloom-owner-kind": "authenticated",
  "x-mindbloom-owner-id": "local-web-user",
};

function jsonHeaders() {
  return {
    "Content-Type": "application/json",
    ...ownerHeaders,
  };
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
  const response = await fetch(`${apiBaseUrl}/api/entries`, {
    headers: ownerHeaders,
  });
  return parseJsonResponse<EntryListResponse>(response);
}

export async function updateEntry(
  entryId: string,
  payload: UpdateEntryRequest,
): Promise<EntryResponse> {
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<EntryResponse>(response);
}

export async function createEntry(
  payload: CreateEntryRequest,
): Promise<EntryResponse> {
  const response = await fetch(`${apiBaseUrl}/api/entries`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<EntryResponse>(response);
}

export async function getEntryDocument(
  entryId: string,
): Promise<EntryDocumentResponse> {
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}/document`, {
    headers: ownerHeaders,
  });
  return parseJsonResponse<EntryDocumentResponse>(response);
}

export async function saveEntryDocument(
  entryId: string,
  payload: UpsertEntryDocumentRequest,
): Promise<EntryDocumentResponse> {
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}/document`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<EntryDocumentResponse>(response);
}

export async function listEntryMessages(
  entryId: string,
): Promise<EntryMessagesResponse> {
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}/messages`, {
    headers: ownerHeaders,
  });
  return parseJsonResponse<EntryMessagesResponse>(response);
}

export async function createEntryMessage(
  entryId: string,
  payload: CreateEntryMessageRequest,
): Promise<EntryMessageResponse> {
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}/messages`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<EntryMessageResponse>(response);
}

export async function listEntryGrafts(
  entryId: string,
): Promise<EntryGraftsResponse> {
  const response = await fetch(`${apiBaseUrl}/api/entries/${entryId}/grafts`, {
    headers: ownerHeaders,
  });
  return parseJsonResponse<EntryGraftsResponse>(response);
}

export async function graftEntryByRelevance(
  entryId: string,
  payload: GraftByRelevanceRequest,
): Promise<EntryGraftRelevanceResponse> {
  const response = await fetch(
    `${apiBaseUrl}/api/entries/${entryId}/grafts/relevance`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    },
  );
  return parseJsonResponse<EntryGraftRelevanceResponse>(response);
}

export async function listNotes(): Promise<NotesResponse> {
  const response = await fetch(`${apiBaseUrl}/api/notes`, {
    headers: ownerHeaders,
  });
  return parseJsonResponse<NotesResponse>(response);
}

export async function createNote(
  payload: CreateNoteRequest,
): Promise<NoteResponse> {
  const response = await fetch(`${apiBaseUrl}/api/notes`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<NoteResponse>(response);
}

export async function updateNote(
  noteId: string,
  payload: UpdateNoteRequest,
): Promise<NoteResponse> {
  const response = await fetch(`${apiBaseUrl}/api/notes/${noteId}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<NoteResponse>(response);
}

export async function deleteNote(noteId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/notes/${noteId}`, {
    method: "DELETE",
    headers: ownerHeaders,
  });

  if (!response.ok) {
    await parseJsonResponse<unknown>(response);
  }
}
