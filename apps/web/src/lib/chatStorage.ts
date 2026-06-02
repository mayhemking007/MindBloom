import type { TopicPill } from "@mindbloom/shared";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface StoredChatSession {
  messages: ChatMessage[];
  topicPills: TopicPill[];
}

function getChatStorageKey(sessionId: string): string {
  return `mindbloom:chat:${sessionId}`;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as ChatMessage;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

export function loadStoredChat(sessionId: string): StoredChatSession | null {
  try {
    const raw = sessionStorage.getItem(getChatStorageKey(sessionId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredChatSession>;
    if (!Array.isArray(parsed.messages)) {
      return null;
    }

    return {
      messages: parsed.messages.filter(isChatMessage),
      topicPills: Array.isArray(parsed.topicPills) ? parsed.topicPills : [],
    };
  } catch {
    return null;
  }
}

export function saveStoredChat(
  sessionId: string,
  session: StoredChatSession,
): void {
  sessionStorage.setItem(getChatStorageKey(sessionId), JSON.stringify(session));
}
