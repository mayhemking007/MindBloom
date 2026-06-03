import type {
  BloomRequest,
  BloomResponse,
  ChatRequest,
  ChatResponse,
  GraphSnapshotResponse,
  ReflectRequest,
  ReflectResponse,
  TodaySessionResponse,
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
