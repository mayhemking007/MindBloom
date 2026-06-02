export function TodayPage() {
  return (
    <main className="min-h-dvh px-4 py-5">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="label-text">Today</p>
          <h1 className="mt-1 font-serif text-[28px] font-normal">
            Today's Journal
          </h1>
        </div>
      </header>

      <section className="rounded-bloom border border-bloom-border bg-bloom-surface p-5">
        <p className="font-serif text-[20px] leading-snug text-bloom-text-primary">
          What's on your mind today?
        </p>
        <p className="mt-3 text-[15px] leading-6 text-bloom-text-secondary">
          The chat surface lands here in Phase 5. For now, this screen is ready
          for the daily session flow.
        </p>
      </section>
    </main>
  );
}
