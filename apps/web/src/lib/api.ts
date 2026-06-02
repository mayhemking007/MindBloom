import type {
  ChatRequest,
  ChatResponse,
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
