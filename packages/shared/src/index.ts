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

export function getSessionIdForDate(date: string): string {
  return `mindbloom-session-${date}`;
}

export function getDateStamp(date = new Date()): string {
  return date.toISOString().split("T")[0] ?? "";
}

export function getTodaySessionId(date = new Date()): string {
  return getSessionIdForDate(getDateStamp(date));
}
