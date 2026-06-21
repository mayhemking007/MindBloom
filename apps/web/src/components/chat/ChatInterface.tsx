import { Send, Settings } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { BloomOverlay } from "../bloom/BloomOverlay";
import { useBloom } from "../../hooks/useBloom";
import { useChat } from "../../hooks/useChat";
import { BloomCTA } from "./BloomCTA";
import { ChatBubble } from "./ChatBubble";
import { TopicPills } from "./TopicPills";

function formatToday(): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());
}

export function ChatInterface() {
  const {
    error,
    loadingSession,
    messages,
    sendMessage,
    sending,
    sessionId,
    topicPills,
    userMessageCount,
  } = useChat();
  const {
    bloomData,
    error: bloomError,
    generateBloom,
    loading: bloomLoading,
  } = useBloom(sessionId);
  const [draft, setDraft] = useState("");
  const [bloomOpen, setBloomOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, topicPills]);

  const canSend = Boolean(sessionId && draft.trim() && !sending);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) {
      return;
    }

    const message = draft;
    setDraft("");
    await sendMessage(message);
  }

  function handleBloom() {
    setBloomOpen(true);
    if (!bloomData && !bloomLoading) {
      void generateBloom();
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[760px] flex-col bg-bloom-bg md:border-x md:border-bloom-border">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-bloom-border bg-bloom-bg px-4 md:px-6">
        <div>
          <h1 className="font-serif text-[24px] font-normal leading-none">
            MindBloom
          </h1>
          <p className="mt-1 text-[11px] text-bloom-text-tertiary">
            {formatToday()}
          </p>
        </div>
        <button
          type="button"
          aria-label="Settings"
          className="grid h-8 w-8 place-items-center rounded-full border border-bloom-border bg-bloom-surface text-bloom-text-tertiary"
        >
          <Settings className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </header>

      <section className="flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6 md:pt-6">
        <div className="flex flex-col gap-2.5">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          {sending ? (
            <div className="flex justify-start">
              <div className="rounded-bloom border border-bloom-border bg-bloom-surface px-4 py-3 text-[15px] text-bloom-text-tertiary">
                Thinking...
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </section>

      <div className="sticky bottom-[60px] z-20 w-full border-t border-bloom-border bg-bloom-bg px-4 pb-3 pt-3 md:bottom-0 md:px-6">
        <div className="space-y-3">
          {topicPills.length > 0 ? <TopicPills topics={topicPills} /> : null}
          {userMessageCount >= 5 ? (
            <BloomCTA onBloom={handleBloom} />
          ) : null}
          {error ? (
            <p className="rounded-bloom-sm border border-coral-border bg-coral-bg px-3 py-2 text-[12px] text-coral-text">
              {error}
            </p>
          ) : null}
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={1}
              disabled={loadingSession}
              placeholder={
                loadingSession ? "Opening today's session..." : "Write a thought..."
              }
              className="max-h-28 min-h-11 flex-1 resize-none rounded-bloom border border-bloom-border bg-bloom-surface px-4 py-3 text-[15px] leading-5 text-bloom-text-primary outline-none transition-colors placeholder:text-bloom-text-tertiary focus:border-bloom-border-mid"
            />
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-bloom bg-bloom-accent text-bloom-on-accent transition-colors hover:bg-bloom-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" strokeWidth={1.9} />
            </button>
          </form>
        </div>
      </div>
      <BloomOverlay
        bloomData={bloomData}
        error={bloomError}
        loading={bloomLoading}
        onClose={() => setBloomOpen(false)}
        open={bloomOpen}
      />
    </main>
  );
}
