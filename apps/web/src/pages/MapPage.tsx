import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { GraphSnapshotResponse, JournalEntry } from "@mindbloom/shared";

import { MindMap } from "../components/graph/MindMap";
import { getEntrySnapshot, listEntries } from "../lib/api";

export function MapPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<GraphSnapshotResponse | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  );

  async function refreshSnapshot(entryId = selectedEntryId) {
    if (!entryId) {
      setSnapshot(null);
      return;
    }

    setLoadingSnapshot(true);
    setError(null);
    try {
      const response = await getEntrySnapshot(entryId);
      setSnapshot(response);
    } catch (snapshotError) {
      setError(
        snapshotError instanceof Error
          ? snapshotError.message
          : "MindBloom could not load your map.",
      );
    } finally {
      setLoadingSnapshot(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadEntries() {
      setLoadingEntries(true);
      setError(null);
      try {
        const response = await listEntries();
        if (!isMounted) {
          return;
        }

        const queryEntryId = new URLSearchParams(window.location.search).get(
          "entryId",
        );
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
          setLoadingEntries(false);
        }
      }
    }

    void loadEntries();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void refreshSnapshot(selectedEntryId);
  }, [selectedEntryId]);

  const isLoading = loadingEntries || loadingSnapshot;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1180px] px-4 pb-6 pt-5 md:px-8 md:pt-8">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-text">Themes</p>
          <h1 className="mt-1 font-serif text-[28px] font-normal md:text-[34px]">
            Mind Map
          </h1>
          <p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">
            A visual map of the themes and connections taking shape in the
            selected entry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 ? (
            <label className="sr-only" htmlFor="map-entry">
              Entry
            </label>
          ) : null}
          {entries.length > 0 ? (
            <select
              id="map-entry"
              value={selectedEntryId ?? ""}
              onChange={(event) => setSelectedEntryId(event.target.value)}
              className="h-9 max-w-[220px] rounded-bloom-sm border border-bloom-border bg-bloom-surface px-3 text-[12px] text-bloom-text-secondary outline-none focus:border-bloom-border-mid"
            >
              {entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => void refreshSnapshot()}
            disabled={isLoading || !selectedEntryId}
            aria-label="Refresh mind map"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-bloom-border bg-bloom-surface text-bloom-text-secondary transition-opacity disabled:opacity-40"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {selectedEntry ? (
        <p className="mb-4 text-[13px] text-bloom-text-secondary">
          Showing map for{" "}
          <span className="font-medium text-bloom-text-primary">
            {selectedEntry.title}
          </span>
          .
        </p>
      ) : null}

      {isLoading ? (
        <section className="grid min-h-[560px] place-items-center rounded-bloom border border-bloom-border bg-bloom-surface">
          <p className="font-serif text-[16px] text-bloom-text-secondary">
            Loading your mind map...
          </p>
        </section>
      ) : null}

      {!isLoading && error ? (
        <section className="rounded-bloom border border-coral-border bg-coral-bg p-5 text-coral-text">
          <p className="font-serif text-[19px]">The map would not open.</p>
          <p className="mt-2 text-[13px] leading-5">{error}</p>
          <button
            type="button"
            onClick={() => void refreshSnapshot()}
            className="mt-4 h-10 rounded-bloom-sm border border-coral-border bg-bloom-surface px-4 text-[13px] font-medium"
          >
            Try again
          </button>
        </section>
      ) : null}

      {!isLoading && !error && entries.length === 0 ? (
        <section className="grid min-h-[420px] place-items-center border-y border-bloom-border">
          <div className="px-8 text-center">
            <p className="font-serif text-[19px] text-bloom-text-primary">
              A map needs an entry
            </p>
            <p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">
              Write and save an entry first, then return here to see its themes.
            </p>
          </div>
        </section>
      ) : null}

      {!isLoading && !error && snapshot ? (
        <MindMap nodes={snapshot.nodes} edges={snapshot.edges} />
      ) : null}
    </main>
  );
}
