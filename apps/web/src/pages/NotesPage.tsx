import { Pin, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Note, NoteDayGroup } from "@mindbloom/shared";

import { createNote, deleteNote, listNotes, updateNote } from "../lib/api";

const noteColors = ["amber", "blue", "teal", "purple", "pink", "gray"] as const;

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

function colorClasses(color: string | null) {
  switch (color) {
    case "blue":
      return "border-blue-border bg-blue-bg text-blue-text";
    case "teal":
      return "border-teal-border bg-teal-bg text-teal-text";
    case "purple":
      return "border-purple-border bg-purple-bg text-purple-text";
    case "pink":
      return "border-pink-border bg-pink-bg text-pink-text";
    case "gray":
      return "border-gray-border bg-gray-bg text-gray-text";
    case "amber":
    default:
      return "border-amber-border bg-amber-bg text-amber-text";
  }
}

interface NoteEditorProps {
  selectedNote: Note | null;
  onSaved: () => void;
  onCancel: () => void;
}

function NoteEditor({ selectedNote, onSaved, onCancel }: NoteEditorProps) {
  const [title, setTitle] = useState(selectedNote?.title ?? "");
  const [body, setBody] = useState(selectedNote?.body ?? "");
  const [color, setColor] = useState(selectedNote?.color ?? "amber");
  const [pinned, setPinned] = useState(selectedNote?.pinned ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(selectedNote?.title ?? "");
    setBody(selectedNote?.body ?? "");
    setColor(selectedNote?.color ?? "amber");
    setPinned(selectedNote?.pinned ?? false);
    setError(null);
  }, [selectedNote?.id]);

  async function saveNote() {
    if (!body.trim()) {
      setError("Write the note before saving it.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (selectedNote) {
        await updateNote(selectedNote.id, {
          title: title.trim() || "Untitled note",
          body,
          color,
          pinned,
        });
      } else {
        await createNote({
          title: title.trim() || "Untitled note",
          body,
          color,
          pinned,
          sourceType: "blank",
        });
      }
      onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "MindBloom could not save this note.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-bloom border border-bloom-border bg-bloom-surface p-4 md:sticky md:top-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-text">Note</p>
          <h2 className="mt-1 font-serif text-[24px]">
            {selectedNote ? "Edit note" : "New note"}
          </h2>
        </div>
        {selectedNote ? (
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-bloom-sm border border-bloom-border px-3 text-[12px] text-bloom-text-secondary"
          >
            New
          </button>
        ) : null}
      </div>

      <label className="mt-4 block text-[12px] font-medium text-bloom-text-secondary">
        Title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Untitled note"
          className="mt-2 h-10 w-full rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 text-[14px] outline-none focus:border-bloom-border-mid"
        />
      </label>

      <label className="mt-4 block text-[12px] font-medium text-bloom-text-secondary">
        What do you want to remember?
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={7}
          placeholder="Write the thought in your own words."
          className="mt-2 w-full resize-none rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 py-3 text-[14px] leading-6 outline-none focus:border-bloom-border-mid"
        />
      </label>

      <div className="mt-4">
        <p className="text-[12px] font-medium text-bloom-text-secondary">Color</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {noteColors.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setColor(item)}
              aria-label={`Use ${item} note color`}
              className={[
                "h-8 w-8 rounded-full border-2",
                colorClasses(item),
                color === item ? "ring-2 ring-bloom-accent" : "",
              ].join(" ")}
            />
          ))}
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-[13px] text-bloom-text-secondary">
        <input
          type="checkbox"
          checked={pinned}
          onChange={(event) => setPinned(event.target.checked)}
        />
        Pin this note
      </label>

      {error ? <p className="mt-3 text-[13px] text-coral-text">{error}</p> : null}

      <button
        type="button"
        onClick={saveNote}
        disabled={isSaving}
        className="mt-4 h-10 w-full rounded-bloom-sm bg-bloom-accent px-4 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving" : "Save note"}
      </button>
    </section>
  );
}

export function NotesPage() {
  const [groups, setGroups] = useState<NoteDayGroup[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshNotes() {
    setError(null);
    try {
      const response = await listNotes();
      setGroups(response.groups);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "MindBloom could not load your notes.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshNotes();
  }, []);

  async function removeNote(note: Note) {
    setError(null);
    try {
      await deleteNote(note.id);
      if (selectedNote?.id === note.id) {
        setSelectedNote(null);
      }
      await refreshNotes();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "MindBloom could not delete this note.",
      );
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1180px] px-4 pb-6 pt-5 md:px-8 md:pt-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="label-text">Notes</p>
          <h1 className="mt-1 font-serif text-[30px] font-normal md:text-[36px]">
            Things worth keeping
          </h1>
          <p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">
            A day-wise collection of small thoughts in your own words.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshNotes}
          aria-label="Refresh notes"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-bloom-border bg-bloom-surface text-bloom-text-secondary"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          {isLoading ? (
            <div className="rounded-bloom border border-bloom-border bg-bloom-surface p-6 text-[14px] text-bloom-text-secondary">
              Loading notes...
            </div>
          ) : groups.length === 0 ? (
            <div className="grid min-h-[360px] place-items-center border-y border-bloom-border">
              <div className="px-8 text-center">
                <Plus className="mx-auto mb-4 h-9 w-9 text-bloom-text-tertiary" />
                <p className="font-serif text-[20px] text-bloom-text-primary">
                  No notes yet
                </p>
                <p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">
                  Save a thought from your journal, or create a blank note here.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {groups.map((group) => (
                <section key={group.date}>
                  <h2 className="mb-3 text-[12px] font-medium uppercase text-bloom-text-tertiary">
                    {formatDay(group.date)}
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {group.notes.map((note) => (
                      <article
                        key={note.id}
                        className={[
                          "rounded-bloom-sm border p-4",
                          colorClasses(note.color),
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedNote(note)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <h3 className="truncate text-[15px] font-semibold">
                              {note.title}
                            </h3>
                            <p className="mt-2 line-clamp-4 text-[13px] leading-5">
                              {note.body}
                            </p>
                          </button>
                          <div className="flex shrink-0 gap-1">
                            {note.pinned ? (
                              <Pin className="h-4 w-4" aria-label="Pinned" />
                            ) : null}
                            <button
                              type="button"
                              onClick={() => removeNote(note)}
                              aria-label={`Delete ${note.title}`}
                              className="grid h-7 w-7 place-items-center rounded-bloom-sm hover:bg-white/40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {note.entryId ? (
                          <p className="mt-3 text-[11px] opacity-70">
                            Saved from a journal entry
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {error ? <p className="mt-4 text-[13px] text-coral-text">{error}</p> : null}
        </section>

        <NoteEditor
          selectedNote={selectedNote}
          onCancel={() => setSelectedNote(null)}
          onSaved={async () => {
            setSelectedNote(null);
            await refreshNotes();
          }}
        />
      </div>
    </main>
  );
}
