export function MapPage() {
  return (
    <main className="min-h-dvh px-4 py-5">
      <p className="label-text">Graph</p>
      <h1 className="mt-1 font-serif text-[28px] font-normal">Mind Map</h1>

      <section className="mt-6 min-h-[360px] rounded-bloom border border-bloom-border bg-bloom-surface p-5">
        <p className="text-[15px] leading-6 text-bloom-text-secondary">
          The full memo-grafter graph visualization will live here, with topics,
          memories, and edge types from the snapshot API.
        </p>
      </section>
    </main>
  );
}
