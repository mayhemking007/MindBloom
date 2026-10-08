import { ArrowRight, BrainCircuit, Flower2, MessageCircle, Network, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../../../web/src/auth/AuthContext";

const features = [
  { icon: BrainCircuit, title: "Remember the useful parts", text: "Turn long Notion pages into a small set of durable topics and memories." },
  { icon: Network, title: "See ideas connect", text: "Explore recurring themes through Thought River and Constellation views." },
  { icon: MessageCircle, title: "Think with your notes", text: "Ask Bloom where an idea appeared before and how it can help your current page." },
];

export function NotionBloomLandingPage() {
  const { isLoading, user } = useAuth();
  const accountDestination = !isLoading && user ? "/notion" : "/login";

  return <main className="min-h-dvh overflow-hidden bg-bloom-bg text-bloom-text-primary">
    <nav className="mx-auto flex h-20 w-full max-w-[1180px] items-center justify-between px-5 md:px-8">
      <Link to="/" className="flex items-center gap-2.5 font-serif text-[21px]"><span className="grid h-10 w-10 place-items-center rounded-full bg-bloom-accent text-bloom-on-accent"><Flower2 className="h-5 w-5" /></span>Notion Bloom</Link>
      <Link to={accountDestination} className="rounded-full border border-bloom-border bg-bloom-surface px-4 py-2 text-[12px] font-medium">{user ? "Open garden" : "Sign in"}</Link>
    </nav>

    <section className="relative mx-auto grid min-h-[calc(100dvh-80px)] w-full max-w-[1180px] items-center gap-12 px-5 pb-20 pt-12 md:grid-cols-[1.08fr_.92fr] md:px-8 md:py-20">
      <div className="relative z-10">
        <p className="inline-flex items-center gap-2 rounded-full border border-purple-border bg-purple-bg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-purple-text"><Sparkles className="h-3.5 w-3.5" />A thinking layer for Notion</p>
        <h1 className="mt-6 max-w-[720px] font-serif text-[48px] leading-[1.02] tracking-[-0.035em] md:text-[72px]">Let your ideas find each other.</h1>
        <p className="mt-6 max-w-[610px] text-[16px] leading-7 text-bloom-text-secondary md:text-[18px]">Notion Bloom turns the pages you already write into a connected garden of themes, earlier thoughts, and useful context—without making you reorganize your workspace.</p>
        <div className="mt-8 flex flex-wrap items-center gap-3"><Link to="/notion" className="inline-flex h-12 items-center gap-2 rounded-full bg-bloom-accent px-6 text-[14px] font-semibold text-bloom-on-accent transition-transform hover:-translate-y-0.5">Enter the Notion garden <ArrowRight className="h-4 w-4" /></Link><span className="text-[11px] text-bloom-text-tertiary">Your original Notion pages stay in your workspace.</span></div>
      </div>

      <div className="relative mx-auto w-full max-w-[480px]">
        <div className="absolute -inset-12 rounded-full bg-purple-bg/70 blur-3xl" />
        <div className="relative rounded-[28px] border border-bloom-border bg-bloom-surface p-5 shadow-[0_30px_90px_rgba(46,40,110,.14)]">
          <div className="flex items-center justify-between"><div><p className="label-text">Notion garden</p><p className="mt-1 font-serif text-[24px]">Ideas in bloom</p></div><Flower2 className="h-6 w-6 text-bloom-accent" /></div>
          <div className="mt-6 space-y-3">{["Contextual suggestions", "Reflective writing", "Knowledge resurfacing"].map((label, index) => <div key={label} className="flex items-center gap-3 rounded-bloom border border-bloom-border bg-bloom-bg p-4"><span className={`h-3 w-3 rounded-full ${index === 0 ? "bg-purple-border" : index === 1 ? "bg-teal-border" : "bg-amber-border"}`} /><div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{label}</p><div className="mt-2 h-1.5 rounded-full bg-bloom-border"><div className="h-full rounded-full bg-bloom-accent" style={{ width: `${82 - index * 14}%` }} /></div></div><span className="text-[10px] text-bloom-text-tertiary">{4 - index} thoughts</span></div>)}</div>
        </div>
      </div>
    </section>

    <section className="border-t border-bloom-border bg-bloom-surface"><div className="mx-auto grid w-full max-w-[1180px] gap-4 px-5 py-16 md:grid-cols-3 md:px-8">{features.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-bloom border border-bloom-border bg-bloom-bg p-5"><Icon className="h-5 w-5 text-bloom-accent" /><h2 className="mt-4 font-serif text-[20px]">{title}</h2><p className="mt-2 text-[13px] leading-6 text-bloom-text-secondary">{text}</p></article>)}</div></section>
  </main>;
}
