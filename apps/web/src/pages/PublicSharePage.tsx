import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  GraphSnapshotResponse,
  PublicReflectionShareResponse,
  ReflectionCard,
} from "@mindbloom/shared";

import { MindMap } from "../components/graph/MindMap";
import { getPublicReflectionShare } from "../lib/api";

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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getCardGraphSnapshot(card: ReflectionCard): GraphSnapshotResponse | null {
  const snapshot = card.metadata?.graphSnapshot;
  if (
    snapshot &&
    typeof snapshot === "object" &&
    "nodes" in snapshot &&
    "edges" in snapshot &&
    Array.isArray((snapshot as GraphSnapshotResponse).nodes) &&
    Array.isArray((snapshot as GraphSnapshotResponse).edges)
  ) {
    return snapshot as GraphSnapshotResponse;
  }

  return null;
}

function SharedCard({ card }: { card: ReflectionCard }) {
  const takeaways = Array.isArray(card.metadata?.takeaways)
    ? card.metadata.takeaways.filter((item): item is string => typeof item === "string")
    : [];
  const graphSnapshot = getCardGraphSnapshot(card);
  const isMapCard = card.type === "mind-map" && graphSnapshot !== null;

  return (
    <article
      className={[
        "rounded-bloom border p-5 shadow-sm",
        card.type === "quote" ? "md:col-span-2" : "",
        isMapCard ? "md:col-span-2" : "",
        cardStyles[card.type],
      ].join(" ")}
    >
      <p className="text-[11px] font-medium uppercase opacity-70">{card.type}</p>
      <h2 className="mt-1 font-serif text-[24px] leading-tight">{card.title}</h2>
      {isMapCard && graphSnapshot ? (
        <div className="mt-4 overflow-hidden rounded-bloom-sm">
          <MindMap nodes={graphSnapshot.nodes} edges={graphSnapshot.edges} />
        </div>
      ) : takeaways.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {takeaways.map((takeaway) => (
            <li key={takeaway} className="text-[14px] leading-6">
              {takeaway}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 whitespace-pre-line text-[15px] leading-7">{card.body}</p>
      )}
    </article>
  );
}

export function PublicSharePage() {
  const { token } = useParams();
  const [share, setShare] = useState<PublicReflectionShareResponse | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadShare() {
      if (!token) {
        setError("This shared reflection link is incomplete.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await getPublicReflectionShare(token);
        if (isMounted) {
          setShare(response);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "MindBloom could not open this shared reflection.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadShare();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <main className="min-h-dvh bg-bloom-bg px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[980px]">
        <header className="mb-8">
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-full border border-purple-border bg-purple-bg text-purple-text">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="label-text">Shared Reflection</p>
          <h1 className="mt-2 font-serif text-[36px] leading-tight md:text-[48px]">
            A few reflection cards
          </h1>
          <p className="mt-3 max-w-[620px] text-[14px] leading-6 text-bloom-text-secondary">
            This public page includes only the cards selected for sharing.
          </p>
          {share ? (
            <p className="mt-2 text-[12px] text-bloom-text-tertiary">
              Shared {formatDate(share.createdAt)}
            </p>
          ) : null}
        </header>

        {isLoading ? (
          <section className="rounded-bloom border border-bloom-border bg-bloom-surface p-6 text-[14px] text-bloom-text-secondary">
            Opening shared reflection...
          </section>
        ) : null}

        {!isLoading && error ? (
          <section className="rounded-bloom border border-coral-border bg-coral-bg p-5 text-coral-text">
            <p className="font-serif text-[20px]">This link is not available.</p>
            <p className="mt-2 text-[13px] leading-5">{error}</p>
          </section>
        ) : null}

        {!isLoading && share ? (
          <section className="grid gap-4 md:grid-cols-2">
            {share.cards.map((card) => (
              <SharedCard key={card.id} card={card} />
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
