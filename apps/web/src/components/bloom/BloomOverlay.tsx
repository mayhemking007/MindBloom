import { AnimatePresence, motion } from "framer-motion";
import { Check, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { BloomResponse } from "@mindbloom/shared";

import { BloomCard } from "./BloomCard";
import { BloomGraph } from "./BloomGraph";

interface BloomOverlayProps {
  bloomData: BloomResponse | null;
  error: string | null;
  loading: boolean;
  onClose: () => void;
  open: boolean;
}

const loadingCopy = [
  "Reading your session...",
  "Finding the patterns...",
  "Growing your bloom...",
];

function formatCapturedAt(capturedAt?: string): string {
  const date = capturedAt ? new Date(capturedAt) : new Date();
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function BloomOverlay({
  bloomData,
  error,
  loading,
  onClose,
  open,
}: BloomOverlayProps) {
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (!loading) {
      return;
    }

    const id = window.setInterval(() => {
      setLoadingIndex((current) => (current + 1) % loadingCopy.length);
    }, 1200);

    return () => window.clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (!open) {
      setShareCopied(false);
      setSavedNotice(false);
    }
  }, [open]);

  async function handleShare() {
    if (!bloomData) {
      return;
    }

    const text = `"${bloomData.insights.shareableTagline}" - my MindBloom for ${formatCapturedAt(
      bloomData.capturedAt,
    )}`;

    if (navigator.share) {
      await navigator.share({
        title: "My MindBloom",
        text,
      });
      return;
    }

    await navigator.clipboard.writeText(text);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 2000);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-30 overflow-y-auto bg-bloom-bg"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mx-auto min-h-dvh w-full max-w-[760px] px-4 pb-8 pt-4 md:px-6"
          >
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                aria-label="Close Bloom"
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full border border-bloom-border bg-bloom-surface text-bloom-text-secondary"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>

            {loading ? (
              <div className="grid min-h-[500px] place-items-center">
                <div className="text-center">
                  <div className="relative mx-auto h-24 w-24">
                    {[0, 1, 2, 3].map((index) => (
                      <span
                        key={index}
                        className="bloom-pulse-circle absolute inset-0 rounded-full border border-purple-border"
                        style={{ animationDelay: `${index * 300}ms` }}
                      />
                    ))}
                  </div>
                  <p className="mt-5 font-serif text-[16px] text-bloom-text-secondary">
                    {loadingCopy[loadingIndex]}
                  </p>
                </div>
              </div>
            ) : null}

            {!loading && error ? (
              <section className="mt-10 rounded-bloom border border-coral-border bg-coral-bg p-5 text-coral-text">
                <p className="font-serif text-[20px]">Your Bloom paused.</p>
                <p className="mt-2 text-[13px] leading-5">{error}</p>
              </section>
            ) : null}

            {!loading && bloomData ? (
              <div className="space-y-3">
                <header className="pb-2">
                  <h2 className="font-serif text-[26px] font-normal">
                    Your MindBloom
                  </h2>
                  <p className="mt-1 text-[12px] text-bloom-text-tertiary">
                    {formatCapturedAt(bloomData.capturedAt)}
                  </p>
                </header>

                <motion.div
                  initial="hidden"
                  animate="show"
                  variants={{
                    hidden: {},
                    show: {
                      transition: {
                        staggerChildren: 0.08,
                      },
                    },
                  }}
                  className="space-y-3"
                >
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 16 },
                      show: { opacity: 1, y: 0 },
                    }}
                  >
                    <BloomCard color="purple" label="Today's Mood">
                      <p className="font-serif text-[20px] leading-snug">
                        {bloomData.insights.mood}
                      </p>
                      <p className="mt-2 text-[13px] leading-5 opacity-75">
                        {bloomData.insights.moodArc}
                      </p>
                      <div className="mt-4 grid h-1 grid-cols-4 gap-1">
                        <span className="rounded-full bg-coral-border" />
                        <span className="rounded-full bg-amber-border" />
                        <span className="rounded-full bg-teal-border" />
                        <span className="rounded-full bg-purple-border" />
                      </div>
                    </BloomCard>
                  </motion.div>

                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 16 },
                      show: { opacity: 1, y: 0 },
                    }}
                  >
                    <BloomCard
                      color="amber"
                      label="The Type Of Person You Seem To Be"
                    >
                      <p className="font-serif text-[18px] leading-snug">
                        {bloomData.insights.archetype}
                      </p>
                      <p className="mt-2 text-[13px] leading-5">
                        {bloomData.insights.archetypeCaption}
                      </p>
                    </BloomCard>
                  </motion.div>

                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 16 },
                      show: { opacity: 1, y: 0 },
                    }}
                  >
                    <BloomCard color="pink" label="If This Session Were A Song">
                      <p className="text-[14px] leading-6">
                        {bloomData.insights.sessionSong}
                      </p>
                    </BloomCard>
                  </motion.div>

                  <div className="grid grid-cols-2 gap-3">
                    <motion.div
                      variants={{
                        hidden: { opacity: 0, y: 16 },
                        show: { opacity: 1, y: 0 },
                      }}
                    >
                      <BloomCard color="teal" label="Your Word Today" className="h-full">
                        <p className="font-serif text-[22px] leading-snug">
                          {bloomData.insights.wordOfDay}
                        </p>
                        <p className="mt-2 text-[12px] leading-5">
                          {bloomData.insights.wordOfDayCopy}
                        </p>
                      </BloomCard>
                    </motion.div>
                    <motion.div
                      variants={{
                        hidden: { opacity: 0, y: 16 },
                        show: { opacity: 1, y: 0 },
                      }}
                    >
                      <BloomCard
                        color="coral"
                        label="The Thread That Kept Pulling"
                        className="h-full"
                      >
                        <p className="text-[13px] leading-5">
                          {bloomData.insights.recurringThread}
                        </p>
                      </BloomCard>
                    </motion.div>
                  </div>
                </motion.div>

                <section className="pt-3">
                  <p className="label-text mb-3">Your mind map · today</p>
                  <BloomGraph
                    nodes={bloomData.snapshot.nodes}
                    edges={bloomData.snapshot.edges}
                  />
                </section>

                <p className="px-8 py-5 text-center font-serif text-[16px] italic leading-7 text-bloom-text-secondary">
                  {bloomData.insights.shareableTagline}
                </p>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-bloom border border-bloom-border bg-bloom-surface text-[14px] font-medium text-bloom-text-primary"
                  >
                    <Share2 className="h-4 w-4" strokeWidth={1.8} />
                    {shareCopied ? "Copied!" : "Share"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSavedNotice(true);
                      window.setTimeout(() => setSavedNotice(false), 2000);
                    }}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-bloom bg-bloom-accent text-[14px] font-medium text-bloom-surface"
                  >
                    <Check className="h-4 w-4" strokeWidth={1.8} />
                    {savedNotice ? "Saved" : "Save to journal"}
                  </button>
                </div>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
