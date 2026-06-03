import { Sparkles } from "lucide-react";

import { BloomGraph } from "../components/bloom/BloomGraph";
import { useReflection } from "../hooks/useReflection";
import { formatDate, getDateFromSessionId } from "../lib/dateUtils";

export function ReflectPage() {
  const {
    availableBlooms,
    error,
    generateReflection,
    loading,
    reflectionData,
    selectedSessionIds,
    toggleSession,
  } = useReflection();

  return (
    <main className="min-h-dvh px-4 pb-6 pt-5">
      <header className="mb-5">
        <p className="label-text">Weekly</p>
        <h1 className="mt-1 font-serif text-[28px] font-normal">
          Weekly Reflection
        </h1>
        <p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">
          Bring a few daily sessions together and notice what kept returning.
        </p>
      </header>

      {availableBlooms.length === 0 ? (
        <section className="grid min-h-[360px] place-items-center border-y border-bloom-border">
          <div className="px-8 text-center">
            <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full border border-purple-border bg-purple-bg text-purple-text">
              <Sparkles className="h-4 w-4" strokeWidth={1.8} />
            </div>
            <p className="font-serif text-[19px] text-bloom-text-primary">
              A reflection needs a few days
            </p>
            <p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">
              Save Blooms from your daily sessions, then return here to bring
              them together.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="border-y border-bloom-border py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="label-text">Days To Include</p>
              <p className="text-[11px] text-bloom-text-tertiary">
                {selectedSessionIds.length} selected
              </p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {availableBlooms.map((bloom) => {
                const selected = selectedSessionIds.includes(bloom.sessionId);
                const date = getDateFromSessionId(bloom.sessionId);

                return (
                  <button
                    key={bloom.sessionId}
                    type="button"
                    onClick={() => toggleSession(bloom.sessionId)}
                    className={[
                      "w-[132px] shrink-0 rounded-bloom border p-3 text-left transition-colors",
                      selected
                        ? "border-purple-border bg-purple-bg text-purple-text"
                        : "border-bloom-border bg-bloom-surface text-bloom-text-secondary",
                    ].join(" ")}
                  >
                    <span className="block text-[10px] uppercase tracking-[0.08em] opacity-70">
                      {date ? formatDate(date, { month: "short", day: "numeric" }) : "Saved day"}
                    </span>
                    <span className="mt-1 block truncate font-serif text-[15px]">
                      {bloom.insights.wordOfDay}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={selectedSessionIds.length === 0 || loading}
              onClick={() => void generateReflection()}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-bloom bg-bloom-accent text-[14px] font-medium text-bloom-surface transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.8} />
              {loading ? "Bringing the week together..." : "Reflect on this week"}
            </button>
          </section>

          {error ? (
            <section className="mt-5 rounded-bloom border border-coral-border bg-coral-bg p-4 text-coral-text">
              <p className="font-serif text-[18px]">The reflection paused.</p>
              <p className="mt-2 text-[13px] leading-5">{error}</p>
            </section>
          ) : null}

          {reflectionData ? (
            <section className="space-y-6 py-5">
              <div>
                <p className="label-text">The Week In One Line</p>
                <p className="mt-2 font-serif text-[21px] leading-snug text-bloom-text-primary">
                  {reflectionData.insights.weeklyTagline}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-y border-bloom-border py-4">
                <div>
                  <p className="label-text">Recurring Themes</p>
                  <ul className="mt-2 space-y-2">
                    {reflectionData.insights.recurringThemes.map((theme) => (
                      <li
                        key={theme}
                        className="text-[13px] leading-5 text-purple-text"
                      >
                        {theme}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="label-text">Resurfacing Topics</p>
                  <ul className="mt-2 space-y-2">
                    {reflectionData.insights.resurfacingTopics.map((topic) => (
                      <li
                        key={topic}
                        className="text-[13px] leading-5 text-teal-text"
                      >
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <p className="label-text">Emotional Shift</p>
                <p className="mt-2 text-[14px] leading-6 text-bloom-text-secondary">
                  {reflectionData.insights.emotionalShifts}
                </p>
              </div>

              <div>
                <p className="label-text">Questions For Next Week</p>
                <div className="mt-3 space-y-2">
                  {reflectionData.insights.questionsForNextWeek.map(
                    (question) => (
                      <p
                        key={question}
                        className="rounded-bloom border border-bloom-border bg-bloom-surface p-3 font-serif text-[15px] leading-6 text-bloom-text-primary"
                      >
                        {question}
                      </p>
                    ),
                  )}
                </div>
              </div>

              <div>
                <p className="label-text mb-3">Grafted Reflection Map</p>
                <BloomGraph
                  nodes={reflectionData.snapshot.nodes}
                  edges={reflectionData.snapshot.edges}
                />
              </div>

              <div>
                <p className="label-text mb-3">Brought Forward From</p>
                <div className="space-y-2">
                  {reflectionData.graftedSources.length > 0 ? (
                    reflectionData.graftedSources.map((source) => {
                      const date = getDateFromSessionId(source.sourceSessionId);
                      return (
                        <div
                          key={`${source.sourceSessionId}-${source.sourceNodeId}`}
                          className="flex items-center justify-between gap-3 border-b border-bloom-border py-2 text-[12px]"
                        >
                          <span className="text-bloom-text-secondary">
                            {date ? formatDate(date) : source.sourceSessionId}
                          </span>
                          <span className="text-bloom-text-tertiary">
                            {source.sourceNodeId.slice(0, 8)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-[13px] leading-5 text-bloom-text-secondary">
                      No grafted topic nodes were available from the selected
                      sessions yet.
                    </p>
                  )}
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
