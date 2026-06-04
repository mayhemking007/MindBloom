import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Menu,
  MessageCircle,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  EntryDayGroup,
  EntryMessage,
  JournalEntry,
  TopicPill,
} from "@mindbloom/shared";

import {
  createEntry,
  createEntryMessage,
  getEntryDocument,
  listEntries,
  listEntryMessages,
  saveEntryDocument,
  sendChatMessage,
} from "../../lib/api";

const purposeLabels: Record<JournalEntry["purpose"], string> = {
  journal: "Journal",
  idea: "Idea",
  brainstorm: "Brainstorm",
};

const modeLabels: Record<JournalEntry["mode"], string> = {
  classic: "Classic",
  chat: "Bloom",
  mixed: "Mixed",
};

function formatDay(date: string): string {
  const today = new Date().toISOString().split("T")[0];
  if (date === today) {
    return "Today";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function entryIcon(purpose: JournalEntry["purpose"]) {
  if (purpose === "idea") {
    return Lightbulb;
  }
  if (purpose === "brainstorm") {
    return Sparkles;
  }
  return BookOpen;
}

interface EntrySidebarProps {
  groups: EntryDayGroup[];
  selectedEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onCreateEntry: () => void;
  isOpen: boolean;
  onClose: () => void;
}

function EntrySidebar({
  groups,
  selectedEntryId,
  onSelectEntry,
  onCreateEntry,
  isOpen,
  onClose,
}: EntrySidebarProps) {
  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-40 w-[292px] border-r border-bloom-border bg-bloom-surface transition-transform md:static md:z-auto md:h-dvh md:w-[280px] md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}
      aria-label="Journal entries"
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-bloom-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-serif text-[24px] leading-tight">Entries</p>
              <p className="mt-1 text-[12px] text-bloom-text-tertiary">
                Write, think, return
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-bloom-sm text-bloom-text-tertiary hover:bg-gray-bg md:hidden"
              aria-label="Close entries"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={onCreateEntry}
            className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-bloom-sm bg-bloom-accent px-3 text-[13px] font-medium text-white"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Entry
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {groups.length === 0 ? (
            <p className="px-2 text-[13px] leading-5 text-bloom-text-secondary">
              Your first journal entry will appear here.
            </p>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <section key={group.date}>
                  <h2 className="px-2 text-[11px] font-medium uppercase text-bloom-text-tertiary">
                    {formatDay(group.date)}
                  </h2>
                  <div className="mt-2 space-y-1">
                    {group.entries.map((entry) => {
                      const Icon = entryIcon(entry.purpose);
                      const isSelected = entry.id === selectedEntryId;

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            onSelectEntry(entry);
                            onClose();
                          }}
                          className={[
                            "flex w-full items-start gap-3 rounded-bloom-sm px-3 py-3 text-left transition-colors",
                            isSelected
                              ? "bg-bloom-accent-bg text-bloom-accent-text"
                              : "text-bloom-text-primary hover:bg-gray-bg",
                          ].join(" ")}
                        >
                          <Icon
                            className="mt-0.5 h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium">
                              {entry.title}
                            </span>
                            <span className="mt-1 block text-[11px] text-bloom-text-tertiary">
                              {purposeLabels[entry.purpose]} ·{" "}
                              {modeLabels[entry.mode]}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

interface BloomSidebarProps {
  entry: JournalEntry | null;
  messages: EntryMessage[];
  topicPills: TopicPill[];
  isOpen: boolean;
  isSending: boolean;
  error: string | null;
  onToggle: () => void;
  onSend: (message: string) => void;
}

function BloomSidebar({
  entry,
  messages,
  topicPills,
  isOpen,
  isSending,
  error,
  onToggle,
  onSend,
}: BloomSidebarProps) {
  const [draft, setDraft] = useState("");
  const bloomMessages = messages.filter((message) => message.role !== "system");

  function submitMessage() {
    const message = draft.trim();
    if (!message || isSending || !entry) {
      return;
    }
    setDraft("");
    onSend(message);
  }

  return (
    <aside
      className={[
        "border-l border-bloom-border bg-bloom-surface transition-all duration-200",
        isOpen ? "w-full md:w-[340px]" : "w-full md:w-[56px]",
      ].join(" ")}
      aria-label="Bloom assistant"
    >
      <div className="flex h-full min-h-[320px] flex-col">
        <div className="flex items-center justify-between border-b border-bloom-border px-4 py-3">
          {isOpen ? (
            <div>
              <p className="text-[13px] font-semibold">Bloom</p>
              <p className="text-[11px] text-bloom-text-tertiary">
                Help when you want it
              </p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            className="flex h-9 w-9 items-center justify-center rounded-bloom-sm text-bloom-text-tertiary hover:bg-gray-bg"
            aria-label={isOpen ? "Collapse Bloom" : "Open Bloom"}
          >
            {isOpen ? (
              <PanelRightClose className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {isOpen ? (
          <>
            <div className="border-b border-bloom-border px-4 py-3">
              <p className="text-[11px] font-medium uppercase text-bloom-text-tertiary">
                Current themes
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {topicPills.length > 0 ? (
                  topicPills.map((pill) => (
                    <span
                      key={pill.id}
                      className="rounded-full border border-teal-border bg-teal-bg px-3 py-1 text-[12px] text-teal-text"
                    >
                      {pill.label}
                    </span>
                  ))
                ) : (
                  <span className="text-[12px] leading-5 text-bloom-text-tertiary">
                    Themes will appear after Bloom has more to work with.
                  </span>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {bloomMessages.length === 0 ? (
                <div className="rounded-bloom-sm border border-dashed border-bloom-border-mid bg-bloom-bg p-4">
                  <p className="text-[13px] leading-5 text-bloom-text-secondary">
                    Ask Bloom to help continue, reframe an idea, or explore what
                    you are trying to say.
                  </p>
                </div>
              ) : (
                bloomMessages.map((message) => (
                  <div
                    key={message.id}
                    className={[
                      "rounded-bloom-sm px-3 py-2 text-[13px] leading-5",
                      message.role === "user"
                        ? "ml-8 bg-bloom-accent text-white"
                        : "mr-8 border border-bloom-border bg-bloom-bg text-bloom-text-primary",
                    ].join(" ")}
                  >
                    {message.content}
                  </div>
                ))
              )}
              {error ? (
                <p className="text-[12px] text-coral-text">{error}</p>
              ) : null}
            </div>

            <div className="border-t border-bloom-border p-3">
              <label className="sr-only" htmlFor="bloom-message">
                Ask Bloom
              </label>
              <div className="flex items-end gap-2 rounded-bloom-sm border border-bloom-border bg-bloom-bg p-2">
                <textarea
                  id="bloom-message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitMessage();
                    }
                  }}
                  placeholder="Ask Bloom..."
                  rows={2}
                  className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-1 text-[13px] outline-none placeholder:text-bloom-text-tertiary"
                />
                <button
                  type="button"
                  onClick={submitMessage}
                  disabled={!draft.trim() || isSending || !entry}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-bloom-sm bg-bloom-accent text-white disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send message to Bloom"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}

export function JournalWorkspace() {
  const [groups, setGroups] = useState<EntryDayGroup[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [documentDraft, setDocumentDraft] = useState("");
  const [messages, setMessages] = useState<EntryMessage[]>([]);
  const [topicPills, setTopicPills] = useState<TopicPill[]>([]);
  const [isEntryDrawerOpen, setEntryDrawerOpen] = useState(false);
  const [isBloomOpen, setBloomOpen] = useState(true);
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [isSending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autosaveTimer = useRef<number | null>(null);

  const entries = useMemo(
    () => groups.flatMap((group) => group.entries),
    [groups],
  );

  async function refreshEntries(preferredEntryId?: string) {
    const response = await listEntries();
    let nextGroups = response.groups;
    let nextEntries = response.entries;

    if (nextEntries.length === 0) {
      const created = await createEntry({
        title: "Untitled entry",
        purpose: "journal",
        mode: "classic",
      });
      const refreshed = await listEntries();
      nextGroups = refreshed.groups;
      nextEntries = refreshed.entries;
      setSelectedEntry(created.entry);
    }

    setGroups(nextGroups);
    const nextSelected =
      nextEntries.find((entry) => entry.id === preferredEntryId) ??
      nextEntries[0] ??
      null;
    setSelectedEntry((current) =>
      current && nextEntries.some((entry) => entry.id === current.id)
        ? current
        : nextSelected,
    );
  }

  useEffect(() => {
    let isMounted = true;

    async function loadWorkspace() {
      setLoading(true);
      setError(null);
      try {
        await refreshEntries();
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "MindBloom could not load your entries.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadWorkspace();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedEntry) {
      return;
    }

    let isMounted = true;

    async function loadEntryDetails(entry: JournalEntry) {
      setError(null);
      try {
        const [documentResponse, messageResponse] = await Promise.all([
          getEntryDocument(entry.id),
          listEntryMessages(entry.id),
        ]);
        if (!isMounted) {
          return;
        }
        setDocumentDraft(documentResponse.document?.content ?? "");
        setMessages(messageResponse.messages);
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "MindBloom could not open this entry.",
          );
        }
      }
    }

    loadEntryDetails(selectedEntry);

    return () => {
      isMounted = false;
    };
  }, [selectedEntry?.id]);

  useEffect(() => {
    if (!selectedEntry) {
      return;
    }

    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
    }

    autosaveTimer.current = window.setTimeout(() => {
      saveEntryDocument(selectedEntry.id, { content: documentDraft }).catch(
        () => {
          setError("MindBloom could not autosave this entry.");
        },
      );
    }, 900);

    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
      }
    };
  }, [documentDraft, selectedEntry?.id]);

  async function handleCreateEntry() {
    setError(null);
    try {
      const created = await createEntry({
        title: "Untitled entry",
        purpose: "journal",
        mode: "classic",
      });
      await refreshEntries(created.entry.id);
      setSelectedEntry(created.entry);
      setEntryDrawerOpen(false);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "MindBloom could not create a new entry.",
      );
    }
  }

  async function handleManualSave() {
    if (!selectedEntry) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveEntryDocument(selectedEntry.id, { content: documentDraft });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "MindBloom could not save this entry.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleBloomMessage(content: string) {
    if (!selectedEntry) {
      return;
    }

    setSending(true);
    setError(null);
    try {
      const userMessage = await createEntryMessage(selectedEntry.id, {
        role: "user",
        content,
      });
      setMessages((current) => [...current, userMessage.message]);

      const reply = await sendChatMessage({
        sessionId: selectedEntry.memoSessionId,
        message: content,
      });
      const assistantMessage = await createEntryMessage(selectedEntry.id, {
        role: "assistant",
        content: reply.reply,
      });
      setMessages((current) => [...current, assistantMessage.message]);
      setTopicPills(reply.topicPills);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Bloom could not respond right now.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-bloom-bg">
      <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)_auto]">
        {isEntryDrawerOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/20 md:hidden"
            aria-label="Close entries overlay"
            onClick={() => setEntryDrawerOpen(false)}
          />
        ) : null}

        <EntrySidebar
          groups={groups}
          selectedEntryId={selectedEntry?.id ?? null}
          onSelectEntry={setSelectedEntry}
          onCreateEntry={handleCreateEntry}
          isOpen={isEntryDrawerOpen}
          onClose={() => setEntryDrawerOpen(false)}
        />

        <section className="min-w-0">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-bloom-border bg-bloom-bg/95 px-4 backdrop-blur md:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setEntryDrawerOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-bloom-sm border border-bloom-border bg-bloom-surface text-bloom-text-secondary md:hidden"
                aria-label="Open entries"
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold">
                  {selectedEntry?.title ?? "MindBloom"}
                </p>
                <p className="text-[12px] text-bloom-text-tertiary">
                  {selectedEntry
                    ? `${purposeLabels[selectedEntry.purpose]} · ${
                        modeLabels[selectedEntry.mode]
                      }`
                    : "Preparing your workspace"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBloomOpen((current) => !current)}
              className="flex h-9 items-center gap-2 rounded-bloom-sm border border-bloom-border bg-bloom-surface px-3 text-[12px] text-bloom-text-secondary md:hidden"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Bloom
            </button>
          </header>

          <div className="mx-auto w-full max-w-[900px] px-4 py-6 md:px-8 md:py-8">
            {isLoading ? (
              <div className="rounded-bloom border border-bloom-border bg-bloom-surface p-6 text-[14px] text-bloom-text-secondary">
                Preparing your journal...
              </div>
            ) : (
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="label-text">Classic writing</p>
                    <h1 className="mt-1 font-serif text-[30px] leading-tight md:text-[38px]">
                      Write freely, ask Bloom when needed.
                    </h1>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualSave}
                    disabled={isSaving || !selectedEntry}
                    className="flex h-10 items-center gap-2 rounded-bloom-sm border border-bloom-border bg-bloom-surface px-4 text-[13px] font-medium text-bloom-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PenLine className="h-4 w-4" aria-hidden="true" />
                    {isSaving ? "Saving" : "Save"}
                  </button>
                </div>

                <label className="sr-only" htmlFor="entry-editor">
                  Journal entry
                </label>
                <textarea
                  id="entry-editor"
                  value={documentDraft}
                  onChange={(event) => setDocumentDraft(event.target.value)}
                  placeholder="Start writing here. It can be a journal entry, an idea, or a messy thought you want to untangle."
                  className="min-h-[calc(100dvh-260px)] w-full resize-none rounded-bloom border border-bloom-border bg-bloom-surface px-5 py-5 font-serif text-[18px] leading-8 text-bloom-text-primary outline-none placeholder:font-sans placeholder:text-[15px] placeholder:leading-6 placeholder:text-bloom-text-tertiary focus:border-bloom-border-mid md:min-h-[calc(100dvh-230px)] md:px-7 md:py-7 md:text-[20px] md:leading-9"
                />
                {error ? (
                  <p className="mt-3 text-[13px] text-coral-text">{error}</p>
                ) : null}
              </>
            )}
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-[60px] z-40 max-h-[72dvh] overflow-hidden border-t border-bloom-border bg-bloom-surface md:static md:bottom-auto md:z-auto md:max-h-none md:overflow-visible md:border-t-0">
          <div className={isBloomOpen ? "block" : "hidden md:block"}>
            <BloomSidebar
              entry={selectedEntry}
              messages={messages}
              topicPills={topicPills}
              isOpen={isBloomOpen}
              isSending={isSending}
              error={error}
              onToggle={() => setBloomOpen((current) => !current)}
              onSend={handleBloomMessage}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setBloomOpen((current) => !current)}
        className="fixed bottom-[76px] right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-bloom-accent text-white shadow-lg md:hidden"
        aria-label={isBloomOpen ? "Hide Bloom" : "Open Bloom"}
      >
        {isBloomOpen ? (
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        ) : (
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </main>
  );
}
