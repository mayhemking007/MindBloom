import { BookOpen, Copy, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  EntryReflection,
  JournalEntry,
  ReflectionCard,
  ReflectionShareLink,
} from "@mindbloom/shared";

import { MindMap } from "../components/graph/MindMap";
import {
  createEntryReflection,
  createReflectionShareLink,
  listEntries,
  listEntryReflections,
  listReflectionShareLinks,
  revokeReflectionShareLink,
} from "../lib/api";

const cardStyles: Record<ReflectionCard["type"], string> = {
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

function formatReflectionDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function cardBody(card: ReflectionCard) {
  if (card.type === "takeaways") {
    const takeaways = Array.isArray(card.metadata?.takeaways)
      ? card.metadata.takeaways.filter((item): item is string => typeof item === "string")
      : [];
    if (takeaways.length > 0) {
      return (
        <ul className="mt-3 space-y-2">
          {takeaways.map((takeaway) => (
            <li key={takeaway} className="text-[13px] leading-5">
              {takeaway}
            </li>
          ))}
        </ul>
      );
    }
  }

  return <p className="mt-3 whitespace-pre-line text-[14px] leading-6">{card.body}</p>;
}

function ReflectionCardView({
  card,
  reflection,
}: {
  card: ReflectionCard;
  reflection: EntryReflection;
}) {
  const isMapCard = card.type === "mind-map" && reflection.graphSnapshot;

  return (
    <article
      className={[
        "rounded-bloom border p-4 shadow-sm",
        card.type === "quote" ? "md:col-span-2" : "",
        isMapCard ? "md:col-span-2" : "",
        cardStyles[card.type],
      ].join(" ")}
    >
      <p className="text-[11px] font-medium uppercase opacity-70">{card.type}</p>
      <h2 className="mt-1 font-serif text-[22px] leading-tight">{card.title}</h2>
      {isMapCard && reflection.graphSnapshot ? (
        <div className="mt-4 overflow-hidden rounded-bloom-sm">
          <MindMap
            nodes={reflection.graphSnapshot.nodes}
            edges={reflection.graphSnapshot.edges}
          />
        </div>
      ) : (
        cardBody(card)
      )}
    </article>
  );
}

function shareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

export function ReflectPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [reflections, setReflections] = useState<EntryReflection[]>([]);
  const [shareLinks, setShareLinks] = useState<ReflectionShareLink[]>([]);
  const [selectedReflectionId, setSelectedReflectionId] = useState<string | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isGenerating, setGenerating] = useState(false);
  const [isCreatingShareLink, setCreatingShareLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  );
  const selectedReflection = useMemo(
    () =>
      reflections.find((reflection) => reflection.id === selectedReflectionId) ??
      reflections[0] ??
      null,
    [reflections, selectedReflectionId],
  );

  async function refreshReflections(entryId: string) {
    const response = await listEntryReflections(entryId);
    setReflections(response.reflections);
    setSelectedReflectionId((current) =>
      current && response.reflections.some((reflection) => reflection.id === current)
        ? current
        : response.reflections[0]?.id ?? null,
    );
  }

  async function refreshShareLinks(reflectionId: string) {
    const response = await listReflectionShareLinks(reflectionId);
    setShareLinks(response.shareLinks);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadEntries() {
      setLoading(true);
      setError(null);
      try {
        const response = await listEntries();
        if (!isMounted) {
          return;
        }
        const queryEntryId = new URLSearchParams(window.location.search).get("entryId");
        const nextSelected =
          response.entries.find((entry) => entry.id === queryEntryId)?.id ??
          response.entries[0]?.id ??
          null;
        setEntries(response.entries);
        setSelectedEntryId(nextSelected);
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

    loadEntries();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedEntryId) {
      setReflections([]);
      setSelectedReflectionId(null);
      return;
    }

    const entryId = selectedEntryId;
    let isMounted = true;

    async function loadReflections() {
      setError(null);
      try {
        const response = await listEntryReflections(entryId);
        if (!isMounted) {
          return;
        }
        setReflections(response.reflections);
        setSelectedReflectionId(response.reflections[0]?.id ?? null);
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "MindBloom could not load reflections for this entry.",
          );
        }
      }
    }

    loadReflections();

    return () => {
      isMounted = false;
    };
  }, [selectedEntryId]);

  useEffect(() => {
    if (!selectedReflection) {
      setShareLinks([]);
      setSelectedCardIds([]);
      return;
    }

    const defaultCardIds = selectedReflection.cards.map((card) => card.id);
    setSelectedCardIds(defaultCardIds);
    refreshShareLinks(selectedReflection.id).catch(() => {
      setError("MindBloom could not load share links for this reflection.");
    });
  }, [selectedReflection?.id]);

  async function generateReflection() {
    if (!selectedEntry) {
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const response = await createEntryReflection(selectedEntry.id);
      await refreshReflections(selectedEntry.id);
      setSelectedReflectionId(response.reflection.id);
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "MindBloom could not create this reflection.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function createShareLink() {
    if (!selectedReflection || selectedCardIds.length === 0) {
      return;
    }

    setCreatingShareLink(true);
    setError(null);
    try {
      const response = await createReflectionShareLink(selectedReflection.id, {
        selectedCardIds,
      });
      await refreshShareLinks(selectedReflection.id);
      await navigator.clipboard?.writeText(shareUrl(response.shareLink.token));
      setCopiedToken(response.shareLink.token);
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

  async function revokeShareLink(link: ReflectionShareLink) {
    if (!selectedReflection) {
      return;
    }

    setError(null);
    try {
      await revokeReflectionShareLink(link.id);
      await refreshShareLinks(selectedReflection.id);
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "MindBloom could not revoke this share link.",
      );
    }
  }

  function toggleCard(cardId: string) {
    setSelectedCardIds((current) =>
      current.includes(cardId)
        ? current.filter((id) => id !== cardId)
        : [...current, cardId],
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1180px] px-4 pb-6 pt-5 md:px-8 md:pt-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-text">Entry Reflection</p>
          <h1 className="mt-1 font-serif text-[30px] font-normal md:text-[38px]">
            Reflect on this entry
          </h1>
          <p className="mt-2 max-w-[620px] text-[13px] leading-5 text-bloom-text-secondary">
            Turn one journal entry into a set of cards you can keep, revisit,
            and later share.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void generateReflection()}
          disabled={!selectedEntry || isGenerating}
          className="flex h-11 items-center gap-2 rounded-bloom-sm bg-bloom-accent px-4 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {isGenerating ? "Creating cards" : "Reflect on this entry"}
        </button>
      </header>

      {isLoading ? (
        <section className="rounded-bloom border border-bloom-border bg-bloom-surface p-6 text-[14px] text-bloom-text-secondary">
          Loading reflections...
        </section>
      ) : null}

      {!isLoading && entries.length === 0 ? (
        <section className="grid min-h-[360px] place-items-center border-y border-bloom-border">
          <div className="px-8 text-center">
            <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full border border-purple-border bg-purple-bg text-purple-text">
              <BookOpen className="h-4 w-4" strokeWidth={1.8} />
            </div>
            <p className="font-serif text-[19px] text-bloom-text-primary">
              A reflection needs an entry
            </p>
            <p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">
              Write a journal entry first, then return here to turn it into cards.
            </p>
          </div>
        </section>
      ) : null}

      {!isLoading && entries.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-bloom border border-bloom-border bg-bloom-surface p-3">
              <p className="label-text px-1">Entries</p>
              <div className="mt-3 space-y-1">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedEntryId(entry.id)}
                    className={[
                      "w-full rounded-bloom-sm px-3 py-3 text-left text-[13px]",
                      selectedEntryId === entry.id
                        ? "bg-bloom-accent-bg text-bloom-accent-text"
                        : "text-bloom-text-secondary hover:bg-gray-bg",
                    ].join(" ")}
                  >
                    <span className="block truncate font-medium">{entry.title}</span>
                    <span className="mt-1 block text-[11px] opacity-70">
                      {(entry.tags ?? []).length > 0
                        ? (entry.tags ?? []).join(", ")
                        : "untagged"}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-bloom border border-bloom-border bg-bloom-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="label-text px-1">Saved Cards</p>
                <button
                  type="button"
                  onClick={() => selectedEntryId && void refreshReflections(selectedEntryId)}
                  aria-label="Refresh reflections"
                  className="grid h-8 w-8 place-items-center rounded-bloom-sm text-bloom-text-tertiary hover:bg-gray-bg"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 space-y-1">
                {reflections.length === 0 ? (
                  <p className="px-1 text-[13px] leading-5 text-bloom-text-secondary">
                    No reflection cards yet.
                  </p>
                ) : (
                  reflections.map((reflection) => (
                    <button
                      key={reflection.id}
                      type="button"
                      onClick={() => setSelectedReflectionId(reflection.id)}
                      className={[
                        "w-full rounded-bloom-sm px-3 py-2 text-left text-[12px]",
                        selectedReflection?.id === reflection.id
                          ? "bg-purple-bg text-purple-text"
                          : "text-bloom-text-secondary hover:bg-gray-bg",
                      ].join(" ")}
                    >
                      {formatReflectionDate(reflection.createdAt)}
                    </button>
                  ))
                )}
              </div>
            </section>
          </aside>

          <section>
            {error ? (
              <div className="mb-4 rounded-bloom border border-coral-border bg-coral-bg p-4 text-coral-text">
                <p className="font-serif text-[18px]">The reflection paused.</p>
                <p className="mt-2 text-[13px] leading-5">{error}</p>
              </div>
            ) : null}

            {selectedReflection ? (
              <div>
                <div className="mb-4">
                  <p className="label-text">
                    {selectedEntry?.title ?? "Selected entry"}
                  </p>
                  <p className="mt-1 text-[13px] text-bloom-text-secondary">
                    Created {formatReflectionDate(selectedReflection.createdAt)}
                  </p>
                </div>
                <section className="mb-5 rounded-bloom border border-bloom-border bg-bloom-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="label-text">Share</p>
                      <h2 className="mt-1 font-serif text-[22px]">
                        Choose cards to share
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => void createShareLink()}
                      disabled={isCreatingShareLink || selectedCardIds.length === 0}
                      className="flex h-10 items-center gap-2 rounded-bloom-sm bg-bloom-accent px-4 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      {isCreatingShareLink ? "Creating link" : "Create share link"}
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedReflection.cards.map((card) => (
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
                          onChange={() => toggleCard(card.id)}
                        />
                        {card.title}
                      </label>
                    ))}
                  </div>
                  {shareLinks.length > 0 ? (
                    <div className="mt-4 border-t border-bloom-border pt-4">
                      <p className="text-[12px] font-medium text-bloom-text-secondary">
                        Active share links
                      </p>
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
                                onClick={async () => {
                                  await navigator.clipboard?.writeText(
                                    shareUrl(link.token),
                                  );
                                  setCopiedToken(link.token);
                                }}
                                className="h-8 rounded-bloom-sm border border-bloom-border px-3 text-[12px] text-bloom-text-secondary"
                              >
                                {copiedToken === link.token ? "Copied" : "Copy"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void revokeShareLink(link)}
                                aria-label="Revoke share link"
                                className="grid h-8 w-8 place-items-center rounded-bloom-sm border border-bloom-border text-bloom-text-secondary"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
                <div className="grid gap-4 md:grid-cols-2">
                  {selectedReflection.cards.map((card) => (
                    <ReflectionCardView
                      key={card.id}
                      card={card}
                      reflection={selectedReflection}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid min-h-[420px] place-items-center rounded-bloom border border-bloom-border bg-bloom-surface">
                <div className="px-8 text-center">
                  <Sparkles className="mx-auto mb-4 h-9 w-9 text-bloom-text-tertiary" />
                  <p className="font-serif text-[20px] text-bloom-text-primary">
                    No reflection cards yet
                  </p>
                  <p className="mt-2 max-w-[360px] text-[13px] leading-5 text-bloom-text-secondary">
                    Generate a reflection whenever an entry feels ready. You do not
                    have to wait for a week.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
