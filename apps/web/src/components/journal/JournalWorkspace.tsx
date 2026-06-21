import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  Lightbulb,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Network,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Pin,
  Plus,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
  StickyNote,
  StopCircle,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  EntryDayGroup,
  EntryMessage,
  EntryReflection,
  GraphSnapshotResponse,
  JournalEntry,
  ReflectionCard,
  ReflectionShareLink,
} from "@mindbloom/shared";

import { MapViews } from "../map/MapViews";
import {
  createEntry,
  createEntryReflection,
  createNote,
  createReflectionShareLink,
  deleteEntry,
  getEntryDocument,
  getEntrySnapshot,
  ingestEntryDocument,
  listEntries,
  listEntryReflections,
  listEntryMessages,
  listReflectionShareLinks,
  revokeReflectionShareLink,
  saveEntryDocument,
  streamEntryMessage,
  updateEntry,
} from "../../lib/api";

const suggestedTags = ["journal", "idea", "brainstorm"] as const;

const reflectionCardStyles: Record<ReflectionCard["type"], string> = {
  stats: "border-blue-border bg-blue-bg text-blue-text",
  mood: "border-purple-border bg-purple-bg text-purple-text",
  takeaways: "border-teal-border bg-teal-bg text-teal-text",
  "mind-map": "border-bloom-border bg-bloom-surface text-bloom-text-primary",
  quote: "border-pink-border bg-pink-bg text-pink-text",
  song: "border-amber-border bg-amber-bg text-amber-text",
  weather: "border-blue-border bg-blue-bg text-blue-text",
  word: "border-coral-border bg-coral-bg text-coral-text",
  question: "border-gray-border bg-gray-bg text-gray-text",
};

type WorkspaceView = "editor" | "map" | "reflect";

const workspaceViews: Array<{
  value: WorkspaceView;
  label: string;
  icon: typeof PenLine;
}> = [
  { value: "editor", label: "Editor", icon: PenLine },
  { value: "map", label: "Map", icon: Network },
  { value: "reflect", label: "Reflect", icon: Sparkles },
];

const tagDescriptions: Record<(typeof suggestedTags)[number], string> = {
  journal: "Capture what happened and how it felt.",
  idea: "Shape a thought into something clearer.",
  brainstorm: "Let messy possibilities spread out.",
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

function entryIcon(tags: string[]) {
  if (tags.includes("idea")) {
    return Lightbulb;
  }
  if (tags.includes("brainstorm")) {
    return Sparkles;
  }
  return BookOpen;
}

function formatTags(tags: string[]): string {
  return tags.length > 0 ? tags.join(", ") : "Untagged";
}

function shareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

interface NoteSourceSelection {
  start: number | null;
  end: number | null;
  excerpt: string | null;
}

interface EntrySidebarProps {
  groups: EntryDayGroup[];
  selectedEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onCreateEntry: () => void;
  onDeleteEntry: (entry: JournalEntry) => void;
  onRenameEntry: (entry: JournalEntry, title: string) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

function EntrySidebar({
  groups,
  selectedEntryId,
  onSelectEntry,
  onCreateEntry,
  onDeleteEntry,
  onRenameEntry,
  isOpen,
  onClose,
}: EntrySidebarProps) {
  const [openActionEntryId, setOpenActionEntryId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryTitleDraft, setEntryTitleDraft] = useState("");
  const entryTitleInputRef = useRef<HTMLInputElement | null>(null);
  const skipNextEntryTitleSaveRef = useRef(false);

  useEffect(() => {
    if (!openActionEntryId) {
      return;
    }

    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Element &&
        (target.closest("[data-entry-action-trigger]") ||
          target.closest("[data-entry-action-popover]"))
      ) {
        return;
      }
      setOpenActionEntryId(null);
    }

    window.addEventListener("pointerdown", closeOnOutsideClick);
    return () => window.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [openActionEntryId]);

  useEffect(() => {
    if (editingEntryId) {
      entryTitleInputRef.current?.focus();
      entryTitleInputRef.current?.select();
    }
  }, [editingEntryId]);

  function beginEntryTitleEdit(entry: JournalEntry) {
    setOpenActionEntryId(null);
    setEditingEntryId(entry.id);
    setEntryTitleDraft(entry.title);
  }

  function cancelEntryTitleEdit(entry: JournalEntry) {
    skipNextEntryTitleSaveRef.current = true;
    setEntryTitleDraft(entry.title);
    setEditingEntryId(null);
  }

  function finishEntryTitleEdit(entry: JournalEntry) {
    if (skipNextEntryTitleSaveRef.current) {
      skipNextEntryTitleSaveRef.current = false;
      return;
    }

    const nextTitle = entryTitleDraft.trim() || "Untitled entry";
    setEditingEntryId(null);
    if (nextTitle !== entry.title) {
      void onRenameEntry(entry, nextTitle);
    }
  }

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-40 w-[292px] border-r border-bloom-border bg-bloom-surface transition-transform md:static md:z-auto md:h-[calc(100dvh-56px)] md:w-[260px] md:translate-x-0",
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
                      const Icon = entryIcon(entry.tags ?? []);
                      const isSelected = entry.id === selectedEntryId;
                      const actionsOpen = openActionEntryId === entry.id;
                      const isEditingEntryTitle = editingEntryId === entry.id;

                      return (
                        <div
                          key={entry.id}
                          className={[
                            "relative rounded-bloom-sm transition-colors",
                            isSelected
                              ? "bg-bloom-accent-bg text-bloom-accent-text"
                              : "text-bloom-text-primary hover:bg-gray-bg",
                          ].join(" ")}
                        >
                          <div className="flex w-full items-start gap-3 rounded-bloom-sm px-3 py-3 pr-11 text-left">
                            <Icon
                              className="mt-0.5 h-4 w-4 shrink-0"
                              aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                              {isEditingEntryTitle ? (
                                <input
                                  ref={entryTitleInputRef}
                                  value={entryTitleDraft}
                                  onChange={(event) =>
                                    setEntryTitleDraft(event.target.value)
                                  }
                                  onBlur={() => finishEntryTitleEdit(entry)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      event.currentTarget.blur();
                                    }
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      cancelEntryTitleEdit(entry);
                                    }
                                  }}
                                  className="h-7 w-full rounded-bloom-sm border border-bloom-border bg-bloom-surface px-2 text-[13px] font-medium outline-none focus:border-bloom-border-mid"
                                  aria-label={`Rename entry ${entry.title}`}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionEntryId(null);
                                    onSelectEntry(entry);
                                    onClose();
                                  }}
                                  className="block w-full truncate text-left text-[13px] font-medium"
                                >
                                  {entry.title}
                                </button>
                              )}
                              <span className="mt-1 block text-[11px] text-bloom-text-tertiary">
                                {formatTags(entry.tags ?? [])}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            data-entry-action-trigger
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenActionEntryId((current) =>
                                current === entry.id ? null : entry.id,
                              );
                            }}
                            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-bloom-sm text-bloom-text-tertiary hover:bg-bloom-surface hover:text-bloom-text-secondary"
                            aria-label={`Entry actions for ${entry.title}`}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {actionsOpen ? (
                            <div
                              data-entry-action-popover
                              className="absolute right-2 top-11 z-10 flex gap-1 rounded-bloom-sm border border-bloom-border bg-bloom-surface p-1 shadow-sm"
                            >
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  beginEntryTitleEdit(entry);
                                }}
                                className="grid h-8 w-8 place-items-center rounded-bloom-sm text-bloom-text-tertiary hover:bg-gray-bg hover:text-bloom-text-secondary"
                                aria-label={`Rename ${entry.title}`}
                                title="Rename"
                              >
                                <PenLine className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenActionEntryId(null);
                                }}
                                disabled
                                className="grid h-8 w-8 place-items-center rounded-bloom-sm text-bloom-text-tertiary opacity-45"
                                aria-label={`Pin ${entry.title}`}
                                title="Pin coming soon"
                              >
                                <Pin className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenActionEntryId(null);
                                  onDeleteEntry(entry);
                                }}
                                className="grid h-8 w-8 place-items-center rounded-bloom-sm text-coral-text hover:bg-coral-bg"
                                aria-label={`Delete ${entry.title}`}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          ) : null}
                        </div>
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

interface CreateEntryPanelProps {
  isOpen: boolean;
  isCreating: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    tags: string[];
    startingPrompt: string;
  }) => void;
  onNavigateAuth: (mode: "login" | "register") => void;
}

function CreateEntryPanel({
  isOpen,
  isCreating,
  error,
  onClose,
  onCreate,
  onNavigateAuth,
}: CreateEntryPanelProps) {
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [startingPrompt, setStartingPrompt] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setTags([]);
      setCustomTag("");
      setStartingPrompt("");
    }
  }, [isOpen]);

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  }

  function addCustomTag() {
    const tag = customTag.trim().toLowerCase();
    if (!tag || tags.includes(tag)) {
      setCustomTag("");
      return;
    }
    setTags((current) => [...current, tag].slice(0, 8));
    setCustomTag("");
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/20 p-3 md:items-center md:justify-center">
      <section
        className="max-h-[92dvh] w-full overflow-y-auto rounded-bloom border border-bloom-border bg-bloom-surface shadow-xl md:max-w-[560px]"
        aria-label="Create journal entry"
      >
        <div className="flex items-start justify-between gap-4 border-b border-bloom-border px-5 py-4">
          <div>
            <h2 className="font-serif text-[26px] leading-tight">New entry</h2>
            <p className="mt-1 text-[13px] text-bloom-text-secondary">
              Start writing-first. Add tags only if they help you find it later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-bloom-sm text-bloom-text-tertiary hover:bg-gray-bg"
            aria-label="Close new entry"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div>
            <label
              className="text-[12px] font-medium text-bloom-text-secondary"
              htmlFor="new-entry-title"
            >
              Title
            </label>
            <input
              id="new-entry-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled entry"
              className="mt-2 h-11 w-full rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 text-[14px] outline-none focus:border-bloom-border-mid"
            />
          </div>

          <fieldset>
            <legend className="text-[12px] font-medium text-bloom-text-secondary">
              Tags
            </legend>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {suggestedTags.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleTag(item)}
                  className={[
                    "rounded-bloom-sm border px-3 py-3 text-left transition-colors",
                    tags.includes(item)
                      ? "border-bloom-accent bg-bloom-accent-bg text-bloom-accent-text"
                      : "border-bloom-border bg-bloom-bg text-bloom-text-secondary hover:border-bloom-border-mid",
                  ].join(" ")}
                >
                  <span className="block text-[13px] font-semibold">
                    {item}
                  </span>
                  <span className="mt-1 block text-[11px] leading-4">
                    {tagDescriptions[item]}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <label className="sr-only" htmlFor="custom-entry-tag">
                Custom tag
              </label>
              <input
                id="custom-entry-tag"
                value={customTag}
                onChange={(event) => setCustomTag(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomTag();
                  }
                }}
                placeholder="Add custom tag"
                className="h-10 min-w-0 flex-1 rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 text-[14px] outline-none focus:border-bloom-border-mid"
              />
              <button
                type="button"
                onClick={addCustomTag}
                disabled={!customTag.trim() || tags.length >= 8}
                className="h-10 rounded-bloom-sm border border-bloom-border px-3 text-[12px] font-medium text-bloom-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="rounded-full border border-teal-border bg-teal-bg px-3 py-1 text-[12px] text-teal-text"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : null}
          </fieldset>

          {error ? (
            <div className="rounded-bloom-sm border border-coral-border bg-coral-bg px-4 py-3 text-coral-text">
              <p className="text-[13px] leading-5">{error}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateAuth("register")}
                  className="h-9 rounded-bloom-sm bg-bloom-accent px-3 text-[12px] font-medium text-white"
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateAuth("login")}
                  className="h-9 rounded-bloom-sm border border-coral-border bg-bloom-surface px-3 text-[12px] font-medium"
                >
                  Login
                </button>
              </div>
            </div>
          ) : null}

          <div>
            <label
              className="text-[12px] font-medium text-bloom-text-secondary"
              htmlFor="new-entry-prompt"
            >
              Starting thought
            </label>
            <textarea
              id="new-entry-prompt"
              value={startingPrompt}
              onChange={(event) => setStartingPrompt(event.target.value)}
              placeholder="Optional. Drop in a thought, prompt, or question to begin with."
              rows={3}
              className="mt-2 w-full resize-none rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 py-3 text-[14px] leading-6 outline-none focus:border-bloom-border-mid"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-bloom-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-bloom-sm border border-bloom-border px-4 text-[13px] font-medium text-bloom-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isCreating}
            onClick={() =>
              onCreate({
                title: title.trim() || "Untitled entry",
                tags,
                startingPrompt,
              })
            }
            className="h-10 rounded-bloom-sm bg-bloom-accent px-4 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating ? "Creating" : "Create entry"}
          </button>
        </div>
      </section>
    </div>
  );
}

interface SaveNotePanelProps {
  entry: JournalEntry | null;
  isOpen: boolean;
  isSaving: boolean;
  initialBody: string;
  sourceExcerpt: string | null;
  onClose: () => void;
  onSave: (input: { title: string; body: string; color: string; pinned: boolean }) => void;
}

function SaveNotePanel({
  entry,
  isOpen,
  isSaving,
  initialBody,
  sourceExcerpt,
  onClose,
  onSave,
}: SaveNotePanelProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [color, setColor] = useState("amber");
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setBody(initialBody);
      setColor("amber");
      setPinned(false);
    }
  }, [initialBody, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/20 p-3 md:items-center md:justify-center">
      <section
        className="w-full rounded-bloom border border-bloom-border bg-bloom-surface shadow-xl md:max-w-[480px]"
        aria-label="Save note"
      >
        <div className="flex items-start justify-between gap-4 border-b border-bloom-border px-5 py-4">
          <div>
            <h2 className="font-serif text-[24px] leading-tight">Save note</h2>
            <p className="mt-1 text-[13px] text-bloom-text-secondary">
              {entry ? `Linked to ${entry.title}` : "Write it in your words."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-bloom-sm text-bloom-text-tertiary hover:bg-gray-bg"
            aria-label="Close save note"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <label className="block text-[12px] font-medium text-bloom-text-secondary">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled note"
              className="mt-2 h-10 w-full rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 text-[14px] outline-none focus:border-bloom-border-mid"
            />
          </label>
          <label className="block text-[12px] font-medium text-bloom-text-secondary">
            What do you want to remember?
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              placeholder="Write the takeaway in your own words."
              className="mt-2 w-full resize-none rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 py-3 text-[14px] leading-6 outline-none focus:border-bloom-border-mid"
            />
          </label>
          {sourceExcerpt ? (
            <div className="rounded-bloom-sm border border-amber-border bg-amber-bg px-3 py-2 text-[12px] leading-5 text-amber-text">
              <p className="font-medium">Selected journal text</p>
              <p className="mt-1 line-clamp-3">{sourceExcerpt}</p>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-[13px] text-bloom-text-secondary">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(event) => setPinned(event.target.checked)}
            />
            Pin this note
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-bloom-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-bloom-sm border border-bloom-border px-4 text-[13px] font-medium text-bloom-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving || !body.trim()}
            onClick={() =>
              onSave({
                title: title.trim() || "Untitled note",
                body,
                color,
                pinned,
              })
            }
            className="h-10 rounded-bloom-sm bg-bloom-accent px-4 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving" : "Save note"}
          </button>
        </div>
      </section>
    </div>
  );
}

interface DeleteEntryPanelProps {
  entry: JournalEntry | null;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteEntryPanel({
  entry,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: DeleteEntryPanelProps) {
  if (!entry) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/20 p-3 md:items-center md:justify-center">
      <section
        className="w-full rounded-bloom border border-coral-border bg-bloom-surface shadow-xl md:max-w-[460px]"
        aria-label="Delete entry"
      >
        <div className="flex items-start justify-between gap-4 border-b border-bloom-border px-5 py-4">
          <div>
            <h2 className="font-serif text-[24px] leading-tight">Delete entry</h2>
            <p className="mt-1 text-[13px] leading-5 text-bloom-text-secondary">
              This will remove "{entry.title}" and its saved writing, Bloom
              messages, brought-in context, reflections, and share links.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="grid h-9 w-9 place-items-center rounded-bloom-sm text-bloom-text-tertiary hover:bg-gray-bg"
            aria-label="Close delete entry"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <p className="mx-5 mt-4 rounded-bloom-sm border border-coral-border bg-coral-bg px-3 py-2 text-[13px] text-coral-text">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="h-10 rounded-bloom-sm border border-bloom-border px-4 text-[13px] font-medium text-bloom-text-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex h-10 items-center gap-2 rounded-bloom-sm bg-coral-border px-4 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {isDeleting ? "Deleting" : "Delete entry"}
          </button>
        </div>
      </section>
    </div>
  );
}

interface BloomSidebarProps {
  entry: JournalEntry | null;
  messages: EntryMessage[];
  isOpen: boolean;
  isSending: boolean;
  streamingContent: string;
  failedMessage: string | null;
  error: string | null;
  onToggle: () => void;
  onSend: (message: string) => void;
  onCancel: () => void;
  onRetry: () => void;
}

function BloomSidebar({
  entry,
  messages,
  isOpen,
  isSending,
  streamingContent,
  failedMessage,
  error,
  onToggle,
  onSend,
  onCancel,
  onRetry,
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
        "border-l border-bloom-border bg-bloom-surface transition-all duration-200 md:h-[calc(100dvh-56px)]",
        isOpen ? "w-full md:w-[380px]" : "w-full md:w-[56px]",
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
            className="flex h-9 w-9 items-center justify-center rounded-bloom-sm text-bloom-text-tertiary hover:bg-gray-bg md:hidden"
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
              {streamingContent ? (
                <div className="mr-8 rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 py-2 text-[13px] leading-5 text-bloom-text-primary">
                  {streamingContent}
                  <span className="bloom-pulse-circle ml-1 inline-block h-1.5 w-1.5 rounded-full bg-bloom-accent align-middle" />
                </div>
              ) : null}
              {error ? (
                <p className="text-[12px] text-coral-text">{error}</p>
              ) : null}
              {failedMessage ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex items-center gap-2 rounded-bloom-sm border border-coral-border bg-coral-bg px-3 py-2 text-[12px] font-medium text-coral-text"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Retry Bloom response
                </button>
              ) : null}
            </div>

            <div className="border-t border-bloom-border p-3">
              <p className="mb-2 text-[11px] leading-4 text-bloom-text-tertiary">
                Bloom is a writing companion, not therapy or emergency support.
              </p>
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
                  onClick={isSending ? onCancel : submitMessage}
                  disabled={(!draft.trim() && !isSending) || !entry}
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-bloom-sm text-white disabled:cursor-not-allowed disabled:opacity-40",
                    isSending ? "bg-coral-border" : "bg-bloom-accent",
                  ].join(" ")}
                  aria-label={isSending ? "Stop Bloom response" : "Send message to Bloom"}
                >
                  {isSending ? (
                    <StopCircle className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}

interface ShareReflectionModalProps {
  reflection: EntryReflection | null;
  shareLinks: ReflectionShareLink[];
  selectedCardIds: string[];
  copiedToken: string | null;
  isCreating: boolean;
  onClose: () => void;
  onToggleCard: (cardId: string) => void;
  onCreate: () => void;
  onCopy: (link: ReflectionShareLink) => void;
  onRevoke: (link: ReflectionShareLink) => void;
}

function ShareReflectionModal({
  reflection,
  shareLinks,
  selectedCardIds,
  copiedToken,
  isCreating,
  onClose,
  onToggleCard,
  onCreate,
  onCopy,
  onRevoke,
}: ShareReflectionModalProps) {
  if (!reflection) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/20 p-3 md:items-center md:justify-center">
      <section
        className="w-full rounded-bloom border border-bloom-border bg-bloom-surface shadow-xl md:max-w-[640px]"
        aria-label="Share reflection"
      >
        <div className="flex items-start justify-between gap-4 border-b border-bloom-border px-5 py-4">
          <div>
            <p className="label-text">Share</p>
            <h2 className="mt-1 font-serif text-[24px]">Create reflect link</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-bloom-sm text-bloom-text-tertiary hover:bg-gray-bg"
            aria-label="Close share reflection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div>
            <p className="text-[12px] font-medium text-bloom-text-secondary">
              Cards to include
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {reflection.cards.map((card) => (
                <label
                  key={card.id}
                  className={[
                    "flex h-9 items-center gap-2 rounded-bloom-sm border px-3 text-[12px]",
                    selectedCardIds.includes(card.id)
                      ? "border-purple-border bg-purple-bg text-purple-text"
                      : "border-bloom-border bg-bloom-bg text-bloom-text-secondary",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={selectedCardIds.includes(card.id)}
                    onChange={() => onToggleCard(card.id)}
                  />
                  {card.title}
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onCreate}
            disabled={isCreating || selectedCardIds.length === 0}
            className="flex h-10 items-center gap-2 rounded-bloom-sm bg-bloom-accent px-4 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            {isCreating ? "Creating link" : "Create share link"}
          </button>

          <div className="border-t border-bloom-border pt-4">
            <p className="text-[12px] font-medium text-bloom-text-secondary">
              Active share links
            </p>
            {shareLinks.length === 0 ? (
              <p className="mt-2 text-[13px] text-bloom-text-tertiary">
                No share links yet.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {shareLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 py-2"
                  >
                    <a
                      href={`/share/${link.token}`}
                      className="min-w-0 truncate text-[12px] text-blue-text"
                    >
                      {shareUrl(link.token)}
                    </a>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onCopy(link)}
                        className="h-8 rounded-bloom-sm border border-bloom-border px-3 text-[12px] text-bloom-text-secondary"
                      >
                        {copiedToken === link.token ? "Copied" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRevoke(link)}
                        aria-label="Revoke share link"
                        className="grid h-8 w-8 place-items-center rounded-bloom-sm border border-bloom-border text-bloom-text-secondary"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function JournalWorkspace() {
  const [groups, setGroups] = useState<EntryDayGroup[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>("editor");
  const [documentDraft, setDocumentDraft] = useState("");
  const [messages, setMessages] = useState<EntryMessage[]>([]);
  const [mapSnapshot, setMapSnapshot] = useState<GraphSnapshotResponse | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapLoading, setMapLoading] = useState(false);
  const [reflections, setReflections] = useState<EntryReflection[]>([]);
  const [shareLinks, setShareLinks] = useState<ReflectionShareLink[]>([]);
  const [selectedShareCardIds, setSelectedShareCardIds] = useState<string[]>([]);
  const [copiedShareToken, setCopiedShareToken] = useState<string | null>(null);
  const [isShareModalOpen, setShareModalOpen] = useState(false);
  const [isCreatingShareLink, setCreatingShareLink] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [isLoadingReflections, setLoadingReflections] = useState(false);
  const [isEntryDrawerOpen, setEntryDrawerOpen] = useState(false);
  const [isCreatePanelOpen, setCreatePanelOpen] = useState(false);
  const [isNotePanelOpen, setNotePanelOpen] = useState(false);
  const [noteSourceSelection, setNoteSourceSelection] =
    useState<NoteSourceSelection>({
      start: null,
      end: null,
      excerpt: null,
    });
  const [lastSavedNoteId, setLastSavedNoteId] = useState<string | null>(null);
  const [entryPendingDelete, setEntryPendingDelete] =
    useState<JournalEntry | null>(null);
  const [isBloomOpen, setBloomOpen] = useState(true);
  const [isLoading, setLoading] = useState(true);
  const [isCreating, setCreating] = useState(false);
  const [isDeletingEntry, setDeletingEntry] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [isAutosaving, setAutosaving] = useState(false);
  const [isSavingNote, setSavingNote] = useState(false);
  const [isReflecting, setReflecting] = useState(false);
  const [isSending, setSending] = useState(false);
  const [isEditingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [failedBloomMessage, setFailedBloomMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createEntryError, setCreateEntryError] = useState<string | null>(null);
  const [deleteEntryError, setDeleteEntryError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const autosaveTimer = useRef<number | null>(null);
  const bloomAbortController = useRef<AbortController | null>(null);
  const mapRequestId = useRef(0);
  const reflectionRequestId = useRef(0);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const editorSelectionRef = useRef<NoteSourceSelection>({
    start: null,
    end: null,
    excerpt: null,
  });
  const skipNextTitleSaveRef = useRef(false);
  const draftDirtyRef = useRef(false);
  const latestDraftRef = useRef("");
  const draftEntryIdRef = useRef<string | null>(null);

  const entries = useMemo(
    () => groups.flatMap((group) => group.entries),
    [groups],
  );

  function getJournalLinkParams() {
    const params = new URLSearchParams(window.location.search);
    const entryId = params.get("entryId");
    const sourceSelectionStart = params.get("sourceSelectionStart");
    const sourceSelectionEnd = params.get("sourceSelectionEnd");

    return {
      entryId,
      sourceSelectionStart:
        sourceSelectionStart == null ? null : Number(sourceSelectionStart),
      sourceSelectionEnd:
        sourceSelectionEnd == null ? null : Number(sourceSelectionEnd),
    };
  }

  async function loadEntryMap(entryId: string) {
    const requestId = mapRequestId.current + 1;
    mapRequestId.current = requestId;
    setMapSnapshot(null);
    setMapError(null);
    setMapLoading(true);

    try {
      const response = await getEntrySnapshot(entryId, "overall");
      if (mapRequestId.current !== requestId) {
        return;
      }
      setMapSnapshot(response);
    } catch (snapshotError) {
      if (mapRequestId.current !== requestId) {
        return;
      }
      setMapError(
        snapshotError instanceof Error
          ? snapshotError.message
          : "MindBloom could not load this entry map.",
      );
    } finally {
      if (mapRequestId.current === requestId) {
        setMapLoading(false);
      }
    }
  }

  async function loadEntryReflections(entryId: string) {
    const requestId = reflectionRequestId.current + 1;
    reflectionRequestId.current = requestId;
    setReflectionError(null);
    setLoadingReflections(true);

    try {
      const response = await listEntryReflections(entryId);
      if (reflectionRequestId.current !== requestId) {
        return;
      }
      setReflections(response.reflections);
    } catch (loadError) {
      if (reflectionRequestId.current !== requestId) {
        return;
      }
      setReflectionError(
        loadError instanceof Error
          ? loadError.message
          : "MindBloom could not load reflections for this entry.",
      );
    } finally {
      if (reflectionRequestId.current === requestId) {
        setLoadingReflections(false);
      }
    }
  }

  async function refreshEntries(preferredEntryId?: string) {
    const response = await listEntries();
    let nextGroups = response.groups;
    let nextEntries = response.entries;

    if (nextEntries.length === 0) {
      const created = await createEntry({
        title: "Untitled entry",
        tags: ["journal"],
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
        await refreshEntries(getJournalLinkParams().entryId ?? undefined);
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
    const { sourceSelectionStart, sourceSelectionEnd } = getJournalLinkParams();
    if (
      !selectedEntry ||
      sourceSelectionStart == null ||
      sourceSelectionEnd == null ||
      Number.isNaN(sourceSelectionStart) ||
      Number.isNaN(sourceSelectionEnd)
    ) {
      return;
    }

    window.setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      const start = Math.max(0, Math.min(sourceSelectionStart, editor.value.length));
      const end = Math.max(start, Math.min(sourceSelectionEnd, editor.value.length));
      editor.focus();
      editor.setSelectionRange(start, end);
      editor.scrollIntoView({ block: "center" });
    }, 0);
  }, [documentDraft, selectedEntry?.id]);

  useEffect(() => {
    return () => {
      bloomAbortController.current?.abort();
      bloomAbortController.current = null;
    };
  }, []);

  useEffect(() => {
    if (!selectedEntry) {
      return;
    }

    let isMounted = true;

    async function loadEntryDetails(entry: JournalEntry) {
      draftDirtyRef.current = false;
      draftEntryIdRef.current = null;
      setError(null);
      try {
        const [documentResponse, messageResponse] = await Promise.all([
          getEntryDocument(entry.id),
          listEntryMessages(entry.id),
        ]);
        if (!isMounted) {
          return;
        }
        draftDirtyRef.current = false;
        const nextDocument = documentResponse.document?.content ?? "";
        if (nextDocument.trim().length >= 12) {
          try {
            await ingestEntryDocument(entry.id, {
              content: nextDocument,
              force: true,
            });
            if (!isMounted) {
              return;
            }
          } catch {
            // Bloom can still chat if theme refresh fails.
          }
        }

        latestDraftRef.current = nextDocument;
        draftEntryIdRef.current = entry.id;
        setDocumentDraft(nextDocument);
        setMessages(messageResponse.messages);
        setTitleDraft(entry.title);
        setSaveStatus(null);
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
    setMapSnapshot(null);
    setMapError(null);
    setMapLoading(false);
    setReflections([]);
    setShareLinks([]);
    setSelectedShareCardIds([]);
    setCopiedShareToken(null);
    setShareModalOpen(false);
    setReflectionError(null);
    setLoadingReflections(false);
    mapRequestId.current += 1;
    reflectionRequestId.current += 1;
  }, [selectedEntry?.id]);

  useEffect(() => {
    if (activeView !== "map" || !selectedEntry) {
      return;
    }

    void loadEntryMap(selectedEntry.id);
  }, [activeView, selectedEntry?.id]);

  useEffect(() => {
    if (activeView !== "reflect" || !selectedEntry) {
      return;
    }

    void loadEntryReflections(selectedEntry.id);
  }, [activeView, selectedEntry?.id]);

  useEffect(() => {
    const reflection = reflections[0] ?? null;
    if (!reflection) {
      setShareLinks([]);
      setSelectedShareCardIds([]);
      setCopiedShareToken(null);
      return;
    }

    setSelectedShareCardIds(reflection.cards.map((card) => card.id));
    setCopiedShareToken(null);
    listReflectionShareLinks(reflection.id)
      .then((response) => setShareLinks(response.shareLinks))
      .catch(() => setError("MindBloom could not load share links for this reflection."));
  }, [reflections]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle, selectedEntry?.id]);

  useEffect(() => {
    if (
      !selectedEntry ||
      !draftDirtyRef.current ||
      draftEntryIdRef.current !== selectedEntry.id
    ) {
      return;
    }

    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
    }

    const entryId = selectedEntry.id;
    const contentToSave = documentDraft;

    autosaveTimer.current = window.setTimeout(() => {
      setAutosaving(true);
      saveEntryDocument(entryId, { content: contentToSave })
        .then(() => ingestEntryDocument(entryId, { content: contentToSave }))
        .then(() => {
          if (draftEntryIdRef.current !== entryId) {
            return;
          }
          if (latestDraftRef.current === contentToSave) {
            draftDirtyRef.current = false;
          }
          if (activeView === "map") {
            void loadEntryMap(entryId);
          }
        })
        .catch(() => {
          setError("MindBloom could not autosave this entry.");
        })
        .finally(() => {
          setAutosaving(false);
        });
    }, 1200);

    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
      }
    };
  }, [activeView, documentDraft, selectedEntry?.id]);

  async function handleCreateEntry(input: {
    title: string;
    tags: string[];
    startingPrompt: string;
  }) {
    setCreating(true);
    setCreateEntryError(null);
    try {
      const created = await createEntry({
        title: input.title,
        tags: input.tags,
      });
      if (input.startingPrompt.trim()) {
        await saveEntryDocument(created.entry.id, {
          content: input.startingPrompt.trim(),
        });
      }
      await refreshEntries(created.entry.id);
      setSelectedEntry(created.entry);
      setEntryDrawerOpen(false);
      setCreatePanelOpen(false);
    } catch (createError) {
      setCreateEntryError(
        createError instanceof Error
          ? createError.message
          : "MindBloom could not create a new entry.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteEntry() {
    if (!entryPendingDelete) {
      return;
    }

    setDeletingEntry(true);
    setDeleteEntryError(null);
    try {
      const deletedEntryId = entryPendingDelete.id;
      await deleteEntry(deletedEntryId);
      const response = await listEntries();
      setGroups(response.groups);
      const nextEntry =
        response.entries.find((entry) => entry.id !== deletedEntryId) ??
        response.entries[0] ??
        null;
      setSelectedEntry(nextEntry);
      if (!nextEntry) {
        setDocumentDraft("");
        latestDraftRef.current = "";
        draftEntryIdRef.current = null;
        setMessages([]);
      }
      setSaveStatus("Entry deleted.");
      setEntryPendingDelete(null);
    } catch (deleteError) {
      setDeleteEntryError(
        deleteError instanceof Error
          ? deleteError.message
          : "MindBloom could not delete this entry.",
      );
    } finally {
      setDeletingEntry(false);
    }
  }

  function navigateToAuth(mode: "login" | "register") {
    window.history.pushState(null, "", `/${mode}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function beginTitleEdit(entry = selectedEntry) {
    if (!entry) {
      return;
    }

    setSelectedEntry(entry);
    setTitleDraft(entry.title);
    setEditingTitle(true);
  }

  async function handleTitleSave() {
    if (!selectedEntry) {
      return;
    }

    const nextTitle = titleDraft.trim() || "Untitled entry";
    if (nextTitle === selectedEntry.title) {
      setTitleDraft(selectedEntry.title);
      setEditingTitle(false);
      return;
    }

    setError(null);
    try {
      const response = await updateEntry(selectedEntry.id, {
        title: nextTitle,
      });
      setSelectedEntry(response.entry);
      setGroups((currentGroups) =>
        currentGroups.map((group) => ({
          ...group,
          entries: group.entries.map((entry) =>
            entry.id === response.entry.id ? response.entry : entry,
          ),
        })),
      );
      setEditingTitle(false);
    } catch (titleError) {
      setError(
        titleError instanceof Error
          ? titleError.message
          : "MindBloom could not rename this entry.",
      );
    }
  }

  async function handleEntryRename(entry: JournalEntry, title: string) {
    const nextTitle = title.trim() || "Untitled entry";
    if (nextTitle === entry.title) {
      return;
    }

    setError(null);
    try {
      const response = await updateEntry(entry.id, {
        title: nextTitle,
      });
      setSelectedEntry((current) =>
        current?.id === response.entry.id ? response.entry : current,
      );
      setGroups((currentGroups) =>
        currentGroups.map((group) => ({
          ...group,
          entries: group.entries.map((groupEntry) =>
            groupEntry.id === response.entry.id ? response.entry : groupEntry,
          ),
        })),
      );
    } catch (titleError) {
      setError(
        titleError instanceof Error
          ? titleError.message
          : "MindBloom could not rename this entry.",
      );
    }
  }

  function finishTitleEdit() {
    if (skipNextTitleSaveRef.current) {
      skipNextTitleSaveRef.current = false;
      return;
    }
    void handleTitleSave();
  }

  async function handleManualSave() {
    if (!selectedEntry) {
      return;
    }

    setSaving(true);
    setError(null);
    setSaveStatus(null);
    try {
      const contentToSave = latestDraftRef.current;
      await saveEntryDocument(selectedEntry.id, { content: contentToSave });
      const response = await ingestEntryDocument(selectedEntry.id, {
        content: contentToSave,
      });
      draftDirtyRef.current = false;
      if (activeView === "map") {
        await loadEntryMap(selectedEntry.id);
      }
      setSaveStatus(
        response.ingested
          ? "Saved and mapped."
          : response.skippedReason === "unchanged-document"
            ? "Saved. Your map is already up to date."
            : "Saved. Add a little more writing for the map to form.",
      );
    } catch (saveError) {
      setSaveStatus(null);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "MindBloom could not save this entry.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleReflectEntry() {
    if (!selectedEntry) {
      return;
    }

    setReflecting(true);
    setError(null);
    setSaveStatus(null);
    try {
      const contentToSave = latestDraftRef.current;
      await saveEntryDocument(selectedEntry.id, { content: contentToSave });
      const ingestResponse = await ingestEntryDocument(selectedEntry.id, {
        content: contentToSave,
        force: true,
      });
      draftDirtyRef.current = false;
      const reflectionResponse = await createEntryReflection(selectedEntry.id);
      setReflections((current) =>
        [
          reflectionResponse.reflection,
          ...current.filter(
            (reflection) => reflection.id !== reflectionResponse.reflection.id,
          ),
        ],
      );
      if (reflectionResponse.reflection.graphSnapshot) {
        setMapSnapshot(reflectionResponse.reflection.graphSnapshot);
      }
      setActiveView("reflect");
      setSaveStatus("Reflection created.");
    } catch (reflectError) {
      setError(
        reflectError instanceof Error
          ? reflectError.message
          : "MindBloom could not create this reflection.",
      );
    } finally {
      setReflecting(false);
    }
  }

  async function handleBloomMessage(content: string) {
    if (!selectedEntry) {
      return;
    }

    setSending(true);
    setError(null);
    setStreamingContent("");
    setFailedBloomMessage(null);
    const abortController = new AbortController();
    bloomAbortController.current = abortController;

    try {
      const contentToSave = latestDraftRef.current;
      await saveEntryDocument(selectedEntry.id, { content: contentToSave });
      await ingestEntryDocument(selectedEntry.id, {
        content: contentToSave,
      });
      draftDirtyRef.current = false;

      await streamEntryMessage(
        selectedEntry.id,
        content,
        {
          onUserMessage: (message) => {
            setMessages((current) =>
              current.some((item) => item.id === message.id)
                ? current
                : [...current, message],
            );
          },
          onToken: (chunk) => {
            setStreamingContent((current) => `${current}${chunk}`);
          },
          onDone: ({ message }) => {
            setMessages((current) => [...current, message]);
            setStreamingContent("");
          },
          onError: (message) => {
            setError(message);
            setFailedBloomMessage(content);
            setStreamingContent("");
          },
        },
        abortController.signal,
        {
          documentDraft: contentToSave,
          entryTags: selectedEntry.tags ?? [],
        },
      );
    } catch (sendError) {
      if (sendError instanceof DOMException && sendError.name === "AbortError") {
        setStreamingContent("");
        return;
      }

      setFailedBloomMessage(content);
      setStreamingContent("");
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Bloom could not respond right now.",
      );
    } finally {
      if (bloomAbortController.current === abortController) {
        bloomAbortController.current = null;
      }
      setSending(false);
    }
  }

  function handleCancelBloomMessage() {
    bloomAbortController.current?.abort();
    bloomAbortController.current = null;
    setSending(false);
    setStreamingContent("");
  }

  function handleRetryBloomMessage() {
    const message = failedBloomMessage;
    if (!message || isSending) {
      return;
    }
    void handleBloomMessage(message);
  }

  function openSaveNotePanel() {
    const editor = editorRef.current;
    const liveStart = editor?.selectionStart ?? null;
    const liveEnd = editor?.selectionEnd ?? null;
    const hasLiveSelection =
      liveStart != null && liveEnd != null && liveEnd > liveStart;
    const rememberedSelection = editorSelectionRef.current;
    const start = hasLiveSelection ? liveStart : rememberedSelection.start;
    const end = hasLiveSelection ? liveEnd : rememberedSelection.end;
    const hasSelection = start != null && end != null && end > start;
    const excerpt = hasSelection ? latestDraftRef.current.slice(start, end).trim() : "";

    setNoteSourceSelection({
      start: hasSelection ? start : null,
      end: hasSelection ? end : null,
      excerpt: excerpt || null,
    });
    setLastSavedNoteId(null);
    setNotePanelOpen(true);
  }

  function rememberEditorSelection(editor: HTMLTextAreaElement) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const excerpt = end > start ? editor.value.slice(start, end).trim() : "";
    editorSelectionRef.current = {
      start: end > start ? start : null,
      end: end > start ? end : null,
      excerpt: excerpt || null,
    };
  }

  function navigateToNotes(noteId?: string) {
    const suffix = noteId ? `?noteId=${encodeURIComponent(noteId)}` : "";
    window.history.pushState(null, "", `/notes${suffix}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  async function handleSaveNote(input: {
    title: string;
    body: string;
    color: string;
    pinned: boolean;
  }) {
    if (!selectedEntry) {
      return;
    }

    setSavingNote(true);
    setError(null);
    try {
      const response = await createNote({
        title: input.title,
        body: input.body,
        color: input.color,
        pinned: input.pinned,
        entryId: selectedEntry.id,
        sourceType: "entry-selection",
        sourceSelectionStart: noteSourceSelection.start,
        sourceSelectionEnd: noteSourceSelection.end,
        sourceExcerpt: noteSourceSelection.excerpt,
        sourcePath: "document",
      });
      setLastSavedNoteId(response.note.id);
      setSaveStatus("Note saved.");
      setNotePanelOpen(false);
    } catch (noteError) {
      setError(
        noteError instanceof Error
          ? noteError.message
          : "MindBloom could not save this note.",
      );
    } finally {
      setSavingNote(false);
    }
  }

  function toggleShareCard(cardId: string) {
    setSelectedShareCardIds((current) =>
      current.includes(cardId)
        ? current.filter((item) => item !== cardId)
        : [...current, cardId],
    );
  }

  async function handleCreateShareLink() {
    const reflection = reflections[0] ?? null;
    if (!reflection || selectedShareCardIds.length === 0) {
      return;
    }

    setCreatingShareLink(true);
    setError(null);
    try {
      const response = await createReflectionShareLink(reflection.id, {
        selectedCardIds: selectedShareCardIds,
      });
      await navigator.clipboard?.writeText(shareUrl(response.shareLink.token));
      setCopiedShareToken(response.shareLink.token);
      setShareLinks((current) => [response.shareLink, ...current]);
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : "MindBloom could not create this share link.",
      );
    } finally {
      setCreatingShareLink(false);
    }
  }

  async function handleCopyShareLink(link: ReflectionShareLink) {
    await navigator.clipboard?.writeText(shareUrl(link.token));
    setCopiedShareToken(link.token);
  }

  async function handleRevokeShareLink(link: ReflectionShareLink) {
    try {
      await revokeReflectionShareLink(link.id);
      setShareLinks((current) =>
        current.map((item) =>
          item.id === link.id
            ? { ...item, revokedAt: item.revokedAt ?? new Date().toISOString() }
            : item,
        ),
      );
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "MindBloom could not revoke this share link.",
      );
    }
  }

  const latestReflection = reflections[0] ?? null;
  const isEditorView = activeView === "editor";

  return (
    <main className="min-h-dvh bg-bloom-bg md:min-h-[calc(100dvh-56px)]">
      <div
        className={[
          "grid min-h-dvh grid-cols-1 md:min-h-[calc(100dvh-56px)]",
          isEditorView
            ? "md:grid-cols-[260px_minmax(0,1fr)_380px]"
            : "md:grid-cols-[260px_minmax(0,1fr)]",
        ].join(" ")}
      >
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
          onCreateEntry={() => {
            setCreateEntryError(null);
            setCreatePanelOpen(true);
          }}
          onDeleteEntry={(entry) => {
            setDeleteEntryError(null);
            setEntryPendingDelete(entry);
          }}
          onRenameEntry={handleEntryRename}
          isOpen={isEntryDrawerOpen}
          onClose={() => setEntryDrawerOpen(false)}
        />

        <section className="flex min-w-0 flex-col md:h-[calc(100dvh-56px)] md:overflow-hidden">
          <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-bloom-border bg-bloom-bg/95 px-4 py-2 backdrop-blur md:hidden md:px-7">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => setEntryDrawerOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-bloom-sm border border-bloom-border bg-bloom-surface text-bloom-text-secondary md:hidden"
                aria-label="Open entries"
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="block max-w-full truncate text-left text-[14px] font-semibold">
                  {selectedEntry?.title ?? "MindBloom"}
                </p>
                <p className="text-[12px] text-bloom-text-tertiary">
                  {isAutosaving
                    ? "saving..."
                    : selectedEntry
                      ? formatTags(selectedEntry.tags ?? [])
                      : "Preparing your workspace"}
                </p>
              </div>
            </div>
            {isEditorView ? (
              <button
                type="button"
                onClick={() => setBloomOpen((current) => !current)}
                className="flex h-9 items-center gap-2 rounded-bloom-sm border border-bloom-border bg-bloom-surface px-3 text-[12px] text-bloom-text-secondary md:hidden"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Bloom
              </button>
            ) : null}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-7">
            {isLoading ? (
              <div className="rounded-bloom border border-bloom-border bg-bloom-surface p-6 text-[14px] text-bloom-text-secondary">
                Preparing your journal...
              </div>
            ) : activeView === "editor" ? (
              <>
                <div className="mx-auto flex w-full max-w-[920px] items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {isEditingTitle && selectedEntry ? (
                      <input
                        ref={titleInputRef}
                        value={titleDraft}
                        onChange={(event) => setTitleDraft(event.target.value)}
                        onBlur={finishTitleEdit}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            skipNextTitleSaveRef.current = true;
                            setTitleDraft(selectedEntry.title);
                            setEditingTitle(false);
                          }
                        }}
                        className="entry-title-input h-[75px] w-full"
                        aria-label="Journal title"
                      />
                    ) : (
                      <h1 className="relative max-w-full truncate font-serif text-5xl font-bold leading-tight text-bloom-text-primary md:text-6xl">
                        {selectedEntry?.title ?? "Untitled entry"}
                        <button
                          type="button"
                          onClick={() => beginTitleEdit()}
                          disabled={!selectedEntry}
                          className="absolute inset-0 cursor-text text-left disabled:cursor-default"
                          aria-label="Rename entry title"
                        />
                      </h1>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {isAutosaving ? (
                        <span className="text-[12px] text-bloom-text-tertiary">
                          saving...
                        </span>
                      ) : selectedEntry ? (
                        (selectedEntry.tags?.length ? selectedEntry.tags : ["untagged"]).map(
                          (tag) => (
                            <span
                              key={tag}
                              className="entry-tag-pill"
                            >
                              {tag}
                            </span>
                          ),
                        )
                      ) : (
                        <span className="text-[12px] text-bloom-text-tertiary">
                          Preparing your workspace
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleManualSave}
                      disabled={isSaving || !selectedEntry}
                      className="flex h-9 shrink-0 items-center gap-1.5 rounded-bloom-sm border border-bloom-border bg-bloom-surface px-3 text-[12px] font-medium text-bloom-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                      {isSaving ? "Saving" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={openSaveNotePanel}
                      disabled={!selectedEntry}
                      className="flex h-9 shrink-0 items-center gap-1.5 rounded-bloom-sm border border-amber-border bg-amber-bg px-3 text-[12px] font-medium text-amber-text disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
                      Save note
                    </button>
                  </div>
                </div>

                <label className="sr-only" htmlFor="entry-editor">
                  Journal entry
                </label>
                <textarea
                  id="entry-editor"
                  ref={editorRef}
                  value={documentDraft}
                  onChange={(event) => {
                    latestDraftRef.current = event.target.value;
                    draftEntryIdRef.current = selectedEntry?.id ?? null;
                    draftDirtyRef.current = true;
                    setSaveStatus(null);
                    setDocumentDraft(event.target.value);
                  }}
                  onSelect={(event) => rememberEditorSelection(event.currentTarget)}
                  placeholder="Start writing here. It can be a journal entry, an idea, or a messy thought you want to untangle."
                  className="mx-auto mt-8 block min-h-[calc(100dvh-390px)] w-full max-w-[920px] resize-none border-0 bg-transparent px-0 py-0 font-serif text-[18px] leading-8 text-bloom-text-primary outline-none placeholder:font-sans placeholder:text-[15px] placeholder:leading-6 placeholder:text-bloom-text-tertiary md:min-h-[calc(100dvh-270px)] md:text-[20px] md:leading-9"
                />
                {saveStatus ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-teal-text">
                    <span>{saveStatus}</span>
                    {lastSavedNoteId ? (
                      <>
                        <button
                          type="button"
                          onClick={() => navigateToNotes(lastSavedNoteId)}
                          className="font-medium underline decoration-teal-border underline-offset-4"
                        >
                          Open note
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateToNotes()}
                          className="font-medium underline decoration-teal-border underline-offset-4"
                        >
                          View all notes
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {error ? (
                  <p className="mt-3 text-[13px] text-coral-text">{error}</p>
                ) : null}
              </>
            ) : activeView === "map" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="label-text">Overall Map</p>
                    <h2 className="mt-1 font-serif text-[28px] leading-tight">
                      {selectedEntry?.title ?? "Entry map"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectedEntry && void loadEntryMap(selectedEntry.id)}
                    disabled={!selectedEntry || isMapLoading}
                    className="h-9 rounded-bloom-sm border border-bloom-border bg-bloom-surface px-3 text-[12px] font-medium text-bloom-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isMapLoading ? "Refreshing" : "Refresh map"}
                  </button>
                </div>
                {isMapLoading ? (
                  <section className="grid min-h-[560px] place-items-center rounded-bloom border border-bloom-border bg-bloom-surface">
                    <p className="font-serif text-[16px] text-bloom-text-secondary">
                      Loading this entry map...
                    </p>
                  </section>
                ) : null}
                {!isMapLoading && mapError ? (
                  <section className="rounded-bloom border border-coral-border bg-coral-bg p-5 text-coral-text">
                    <p className="font-serif text-[19px]">The map would not open.</p>
                    <p className="mt-2 text-[13px] leading-5">{mapError}</p>
                  </section>
                ) : null}
                {!isMapLoading && !mapError && mapSnapshot ? (
                  <MapViews
                    key={`${selectedEntry?.id ?? "none"}-${mapSnapshot.capturedAt}`}
                    snapshot={mapSnapshot}
                  />
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="label-text">Reflection</p>
                    <h2 className="mt-1 font-serif text-[28px] leading-tight">
                      {selectedEntry?.title ?? "Entry reflection"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {latestReflection ? (
                      <button
                        type="button"
                        onClick={() => setShareModalOpen(true)}
                        className="flex h-9 items-center gap-2 rounded-bloom-sm border border-bloom-border bg-bloom-surface px-3 text-[12px] font-medium text-bloom-text-secondary"
                      >
                        <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Share
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleReflectEntry()}
                      disabled={!selectedEntry || isReflecting}
                      className="flex h-9 items-center gap-2 rounded-bloom-sm bg-bloom-accent px-3 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      {isReflecting ? "Reflecting" : "Create reflection"}
                    </button>
                  </div>
                </div>
                {isLoadingReflections ? (
                  <section className="rounded-bloom border border-bloom-border bg-bloom-surface p-6 text-[14px] text-bloom-text-secondary">
                    Loading reflections for this entry...
                  </section>
                ) : null}
                {!isLoadingReflections && reflectionError ? (
                  <section className="rounded-bloom border border-coral-border bg-coral-bg p-5 text-coral-text">
                    <p className="font-serif text-[19px]">Reflection would not open.</p>
                    <p className="mt-2 text-[13px] leading-5">{reflectionError}</p>
                  </section>
                ) : null}
                {!isLoadingReflections && !reflectionError && !latestReflection ? (
                  <section className="rounded-bloom border border-bloom-border bg-bloom-surface p-6">
                    <p className="font-serif text-[20px] text-bloom-text-primary">
                      No reflection for this entry yet
                    </p>
                    <p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">
                      Create one after writing so it is tied to this entry's map and Bloom conversation.
                    </p>
                  </section>
                ) : null}
                {!isLoadingReflections && !reflectionError && latestReflection ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {latestReflection.cards.map((card) => {
                      const isMapCard = card.type === "mind-map" && latestReflection.graphSnapshot;
                      const takeaways = Array.isArray(card.metadata?.takeaways)
                        ? card.metadata.takeaways.filter(
                            (item): item is string => typeof item === "string",
                          )
                        : [];

                      return (
                        <article
                          key={card.id}
                          className={[
                            "rounded-bloom border p-4 shadow-sm",
                            isMapCard ? "md:col-span-2" : "",
                            reflectionCardStyles[card.type],
                          ].join(" ")}
                        >
                          <p className="text-[11px] font-medium uppercase opacity-70">
                            {card.type}
                          </p>
                          <h3 className="mt-1 font-serif text-[22px] leading-tight">
                            {card.title}
                          </h3>
                          {isMapCard && latestReflection.graphSnapshot ? (
                            <div className="mt-3 overflow-hidden rounded-bloom-sm">
                              <MapViews snapshot={latestReflection.graphSnapshot} compact />
                            </div>
                          ) : takeaways.length > 0 ? (
                            <ul className="mt-3 space-y-2 text-[13px] leading-5">
                              {takeaways.map((takeaway) => (
                                <li key={takeaway}>{takeaway}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-3 whitespace-pre-line text-[13px] leading-6">
                              {card.body}
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : null}
                {saveStatus ? (
                  <p className="text-[13px] text-teal-text">{saveStatus}</p>
                ) : null}
                {error ? (
                  <p className="text-[13px] text-coral-text">{error}</p>
                ) : null}
              </div>
            )}
          </div>

          <div className="sticky bottom-[60px] z-20 border-t border-bloom-border bg-bloom-bg/95 px-4 py-2 backdrop-blur md:bottom-0 md:px-8">
            <div className="grid grid-cols-3 gap-2 rounded-bloom-sm border border-bloom-border bg-bloom-surface p-1">
              {workspaceViews.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setActiveView(item.value)}
                    disabled={!selectedEntry}
                    className={[
                      "flex h-10 items-center justify-center gap-2 rounded-bloom-sm text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      activeView === item.value
                        ? "bg-bloom-accent text-white"
                        : "text-bloom-text-secondary hover:bg-gray-bg",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {isEditorView ? (
          <div className="fixed inset-x-0 bottom-[60px] z-40 max-h-[72dvh] overflow-hidden border-t border-bloom-border bg-bloom-surface md:static md:bottom-auto md:z-auto md:h-[calc(100dvh-56px)] md:max-h-none md:overflow-visible md:border-t-0">
            <div className={isBloomOpen ? "block" : "hidden md:block"}>
              <BloomSidebar
                entry={selectedEntry}
                messages={messages}
                isOpen={isBloomOpen}
                isSending={isSending}
                streamingContent={streamingContent}
                failedMessage={failedBloomMessage}
                error={error}
                onToggle={() => setBloomOpen((current) => !current)}
                onSend={handleBloomMessage}
                onCancel={handleCancelBloomMessage}
                onRetry={handleRetryBloomMessage}
              />
            </div>
          </div>
        ) : null}
      </div>

      {isEditorView ? (
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
      ) : null}

      <CreateEntryPanel
        isOpen={isCreatePanelOpen}
        isCreating={isCreating}
        error={createEntryError}
        onClose={() => {
          setCreateEntryError(null);
          setCreatePanelOpen(false);
        }}
        onCreate={handleCreateEntry}
        onNavigateAuth={navigateToAuth}
      />
      <DeleteEntryPanel
        entry={entryPendingDelete}
        isDeleting={isDeletingEntry}
        error={deleteEntryError}
        onCancel={() => {
          setDeleteEntryError(null);
          setEntryPendingDelete(null);
        }}
        onConfirm={handleDeleteEntry}
      />
      <SaveNotePanel
        entry={selectedEntry}
        isOpen={isNotePanelOpen}
        isSaving={isSavingNote}
        initialBody={noteSourceSelection.excerpt ?? ""}
        sourceExcerpt={noteSourceSelection.excerpt}
        onClose={() => setNotePanelOpen(false)}
        onSave={handleSaveNote}
      />
      {isShareModalOpen ? (
        <ShareReflectionModal
          reflection={latestReflection}
          shareLinks={shareLinks.filter((link) => !link.revokedAt)}
          selectedCardIds={selectedShareCardIds}
          copiedToken={copiedShareToken}
          isCreating={isCreatingShareLink}
          onClose={() => setShareModalOpen(false)}
          onToggleCard={toggleShareCard}
          onCreate={handleCreateShareLink}
          onCopy={handleCopyShareLink}
          onRevoke={handleRevokeShareLink}
        />
      ) : null}
    </main>
  );
}
