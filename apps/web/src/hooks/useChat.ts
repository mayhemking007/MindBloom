import { useCallback, useEffect, useMemo, useState } from "react";
import type { TopicPill } from "@mindbloom/shared";

import { getTodaySession, sendChatMessage } from "../lib/api";
import {
  type ChatMessage,
  loadStoredChat,
  saveStoredChat,
} from "../lib/chatStorage";

const OPENING_PROMPTS = [
  "What's on your mind today?",
  "How are you actually doing right now?",
  "What happened today that you're still thinking about?",
  "What would you like to sit with for a moment?",
];

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOpeningPrompt(): ChatMessage {
  const index = Math.floor(Math.random() * OPENING_PROMPTS.length);
  return {
    id: "opening-prompt",
    role: "assistant",
    content: OPENING_PROMPTS[index] ?? OPENING_PROMPTS[0],
  };
}

export function useChat() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [topicPills, setTopicPills] = useState<TopicPill[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        setLoadingSession(true);
        const today = await getTodaySession();
        if (!active) {
          return;
        }

        const stored = loadStoredChat(today.sessionId);
        setSessionId(today.sessionId);
        setMessages(stored?.messages.length ? stored.messages : [getOpeningPrompt()]);
        setTopicPills(stored?.topicPills ?? []);
      } catch (sessionError) {
        if (!active) {
          return;
        }

        setError(
          sessionError instanceof Error
            ? sessionError.message
            : "MindBloom could not start today's session.",
        );
        setMessages([getOpeningPrompt()]);
      } finally {
        if (active) {
          setLoadingSession(false);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    saveStoredChat(sessionId, { messages, topicPills });
  }, [messages, sessionId, topicPills]);

  const userMessageCount = useMemo(
    () => messages.filter((message) => message.role === "user").length,
    [messages],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!sessionId || !trimmed || sending) {
        return;
      }

      const userMessage: ChatMessage = {
        id: createId("user"),
        role: "user",
        content: trimmed,
      };

      setMessages((current) => [...current, userMessage]);
      setSending(true);
      setError(null);

      try {
        const response = await sendChatMessage({
          sessionId,
          message: trimmed,
        });

        const assistantMessage: ChatMessage = {
          id: createId("assistant"),
          role: "assistant",
          content: response.reply,
        };

        setMessages((current) => [...current, assistantMessage]);
        setTopicPills(response.topicPills);
      } catch (chatError) {
        setError(
          chatError instanceof Error
            ? chatError.message
            : "MindBloom could not send that message.",
        );
      } finally {
        setSending(false);
      }
    },
    [sending, sessionId],
  );

  return {
    error,
    loadingSession,
    messages,
    sendMessage,
    sending,
    sessionId,
    topicPills,
    userMessageCount,
  };
}
