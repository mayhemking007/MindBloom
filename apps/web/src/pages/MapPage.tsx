import { RefreshCw } from "lucide-react";

import { MindMap } from "../components/graph/MindMap";
import { useSnapshot } from "../hooks/useSnapshot";

export function MapPage() {
  const { error, loading, refresh, snapshot } = useSnapshot();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1180px] px-4 pb-6 pt-5 md:px-8 md:pt-8">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="label-text">Graph</p>
          <h1 className="mt-1 font-serif text-[28px] font-normal md:text-[34px]">Mind Map</h1>
          <p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">
            Today's memory graph, shaped by the topics that surfaced.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Refresh mind map"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-bloom-border bg-bloom-surface text-bloom-text-secondary transition-opacity disabled:opacity-40"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </header>

      {loading ? (
        <section className="grid min-h-[560px] place-items-center rounded-bloom border border-bloom-border bg-bloom-surface">
          <p className="font-serif text-[16px] text-bloom-text-secondary">
            Loading your mind map...
          </p>
        </section>
      ) : null}

      {!loading && error ? (
        <section className="rounded-bloom border border-coral-border bg-coral-bg p-5 text-coral-text">
          <p className="font-serif text-[19px]">The map would not open.</p>
          <p className="mt-2 text-[13px] leading-5">{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-4 h-10 rounded-bloom-sm border border-coral-border bg-bloom-surface px-4 text-[13px] font-medium"
          >
            Try again
          </button>
        </section>
      ) : null}

      {!loading && !error && snapshot ? (
        <MindMap nodes={snapshot.nodes} edges={snapshot.edges} />
      ) : null}
    </main>
  );
}
