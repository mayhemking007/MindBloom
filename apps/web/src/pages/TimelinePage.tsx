import { RefreshCw } from "lucide-react";

import { CalendarHeatmap } from "../components/timeline/CalendarHeatmap";
import { SavedBloomDetail } from "../components/timeline/SavedBloomDetail";
import { SavedBloomList } from "../components/timeline/SavedBloomList";
import { useSavedBlooms } from "../hooks/useSavedBlooms";

export function TimelinePage() {
  const {
    blooms,
    refresh,
    selectedBloom,
    selectedDate,
    selectBloom,
  } = useSavedBlooms();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1180px] px-4 pb-6 pt-5 md:min-h-[calc(100dvh-64px)] md:px-8 md:pt-8">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="label-text">Archive</p>
          <h1 className="mt-1 font-serif text-[28px] font-normal md:text-[34px]">Timeline</h1>
          <p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">
            A record of the days you paused long enough to notice.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh saved Blooms"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-bloom-border bg-bloom-surface text-bloom-text-secondary"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </header>

      {blooms.length === 0 ? (
        <section className="grid min-h-[360px] place-items-center border-y border-bloom-border">
          <div className="px-8 text-center">
            <div className="mx-auto mb-4 h-10 w-10 rounded-full border border-purple-border bg-purple-bg" />
            <p className="font-serif text-[19px] text-bloom-text-primary">
              Your timeline is waiting
            </p>
            <p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">
              Generate a Bloom after a journaling session and it will appear
              here.
            </p>
          </div>
        </section>
      ) : (
        <div className="md:grid md:grid-cols-[340px_minmax(0,1fr)] md:gap-8">
          <div>
            <CalendarHeatmap
              blooms={blooms}
              selectedDate={selectedDate}
              onSelect={selectBloom}
            />
            <SavedBloomList
              blooms={blooms}
              selectedSessionId={selectedBloom?.sessionId ?? null}
              onSelect={selectBloom}
            />
          </div>
          {selectedBloom ? <SavedBloomDetail bloom={selectedBloom} /> : null}
        </div>
      )}
    </main>
  );
}
