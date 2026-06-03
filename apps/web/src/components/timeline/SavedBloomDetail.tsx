import type { SavedBloom } from "../../lib/bloomStore";
import { formatDate, getDateFromSessionId } from "../../lib/dateUtils";
import { BloomGraph } from "../bloom/BloomGraph";

interface SavedBloomDetailProps {
  bloom: SavedBloom;
}

export function SavedBloomDetail({ bloom }: SavedBloomDetailProps) {
  const date = getDateFromSessionId(bloom.sessionId);

  return (
    <section className="border-t border-bloom-border pb-4 pt-5">
      <header className="mb-5">
        <p className="label-text">Selected Bloom</p>
        <h2 className="mt-1 font-serif text-[24px] font-normal text-bloom-text-primary">
          {date ? formatDate(date) : "Saved reflection"}
        </h2>
      </header>

      <div className="space-y-5">
        <div>
          <p className="label-text">Mood</p>
          <p className="mt-2 font-serif text-[20px] leading-snug text-purple-text">
            {bloom.insights.mood}
          </p>
          <p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">
            {bloom.insights.moodArc}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-y border-bloom-border py-4">
          <div>
            <p className="label-text">Archetype</p>
            <p className="mt-2 font-serif text-[17px] leading-snug text-amber-text">
              {bloom.insights.archetype}
            </p>
          </div>
          <div>
            <p className="label-text">Word Of Day</p>
            <p className="mt-2 font-serif text-[20px] leading-snug text-teal-text">
              {bloom.insights.wordOfDay}
            </p>
          </div>
        </div>

        <div>
          <p className="label-text">If This Session Were A Song</p>
          <p className="mt-2 text-[14px] leading-6 text-bloom-text-secondary">
            {bloom.insights.sessionSong}
          </p>
        </div>

        <div>
          <p className="label-text">Recurring Thread</p>
          <p className="mt-2 text-[14px] leading-6 text-bloom-text-secondary">
            {bloom.insights.recurringThread}
          </p>
        </div>

        <div>
          <p className="label-text mb-3">Captured Mind Map</p>
          <BloomGraph
            nodes={bloom.snapshot.nodes}
            edges={bloom.snapshot.edges}
          />
        </div>

        <p className="px-6 py-4 text-center font-serif text-[16px] italic leading-7 text-bloom-text-secondary">
          {bloom.insights.shareableTagline}
        </p>
      </div>
    </section>
  );
}
