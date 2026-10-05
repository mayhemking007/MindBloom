import { ArrowLeft, ArrowRight, ExternalLink, Eye, MessageCircle, Pencil, RefreshCw, Save, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { GraphSnapshotResponse, MindBloomDocument, NotionBloomMessage, RelatedThought } from "@mindbloom/shared";
import { MarkdownContent } from "../components/MarkdownContent";
import { MapViews } from "../components/map/MapViews";
import { askNotionBloom, getNotionDocument, getNotionGraph, getNotionRelated, saveNotionDocument, syncNotionDocument, updateNotionDocument } from "../lib/api";

export function NotionDocumentPage() {
  const { documentId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const focusMemoryId = searchParams.get("memoryId");
  const mapRef = useRef<HTMLDivElement>(null);
  const bloomRef = useRef<HTMLElement>(null);
  const [doc, setDoc] = useState<MindBloomDocument | null>(null);
  const [related, setRelated] = useState<RelatedThought[]>([]);
  const [graph, setGraph] = useState<GraphSnapshotResponse | null>(null);
  const [messages, setMessages] = useState<NotionBloomMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [expandedThoughtId, setExpandedThoughtId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [documentResult, relatedResult, graphResult] = await Promise.all([
        getNotionDocument(documentId), getNotionRelated(documentId), getNotionGraph(documentId),
      ]);
      setDoc(documentResult.document);
      setDraft(documentResult.document.content);
      setRelated(relatedResult.thoughts);
      setGraph(graphResult);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not open page");
    }
  }

  useEffect(() => { void load(); }, [documentId]);
  useEffect(() => {
    if (focusMemoryId && graph) mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusMemoryId, graph]);

  async function sync() {
    const discardLocalChanges = doc?.syncState === "local_changes";
    if (discardLocalChanges && !window.confirm("This will discard the version saved in MindBloom and replace it with the current Notion page. Continue?")) return;
    setBusy(true);
    setError(null);
    try {
      const result = await syncNotionDocument(documentId, discardLocalChanges);
      setDoc(result.document);
      setDraft(result.document.content);
      const [relatedResult, graphResult] = await Promise.all([getNotionRelated(documentId), getNotionGraph(documentId)]);
      setRelated(relatedResult.thoughts);
      setGraph(graphResult);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function save(destination: "mindbloom" | "notion") {
    if (!doc) return;
    if (destination === "mindbloom" && draft === doc.content) { setEditing(false); setPreviewing(false); return; }
    setBusy(true);
    setError(null);
    try {
      const result = destination === "notion"
        ? await saveNotionDocument(documentId, draft, doc.sourceUpdatedAt)
        : await updateNotionDocument(documentId, draft);
      setDoc(result.document);
      setDraft(result.document.content);
      setEditing(false);
      setPreviewing(false);
      const [relatedResult, graphResult] = await Promise.all([getNotionRelated(documentId), getNotionGraph(documentId)]);
      setRelated(relatedResult.thoughts);
      setGraph(graphResult);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this page");
    } finally {
      setBusy(false);
    }
  }

  function cancelEdit() {
    setDraft(doc?.content ?? "");
    setEditing(false);
    setPreviewing(false);
    setError(null);
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    try {
      const response = await askNotionBloom(documentId, question.trim());
      setMessages(response.messages);
      setRelated(response.sources);
      setQuestion("");
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : "Bloom could not answer");
    } finally {
      setBusy(false);
    }
  }

  async function chatWithThought(thought: RelatedThought) {
    setBusy(true);
    setError(null);
    try {
      const response = await askNotionBloom(documentId, undefined, thought.id);
      setMessages(response.messages);
      setRelated(response.sources);
      window.setTimeout(() => bloomRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Bloom could not revisit this thought");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto min-h-dvh w-full max-w-[1180px] px-4 pb-24 pt-6 md:px-8">
    <Link to="/notion" className="inline-flex items-center gap-2 text-[12px] text-bloom-text-secondary"><ArrowLeft className="h-4 w-4" />Notion garden</Link>
    {error ? <div role="alert" className="mt-4 rounded-bloom border border-coral-border bg-coral-bg p-4 text-[13px] text-coral-text">{error}</div> : null}
    {doc ? <>
      <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div><p className="label-text">Notion page</p><h1 className="mt-1 font-serif text-[30px]">{doc.title}</h1><div className="mt-2 flex flex-wrap items-center gap-2"><a href={doc.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-bloom-accent">Open original <ExternalLink className="h-3 w-3" /></a>{doc.syncState === "local_changes" ? <span className="rounded-full bg-bloom-accent-bg px-2 py-1 text-[10px] font-medium text-bloom-accent">Saved in MindBloom · not yet in Notion</span> : null}</div></div>
        <div className="flex flex-wrap gap-2">{editing ? <><button onClick={cancelEdit} disabled={busy} className="flex h-10 items-center gap-2 rounded-bloom-sm border border-bloom-border bg-bloom-surface px-4 text-[12px]"><X className="h-4 w-4" />Cancel</button><button onClick={() => void save("mindbloom")} disabled={busy || draft === doc.content} className="flex h-10 items-center gap-2 rounded-bloom-sm border border-bloom-accent bg-bloom-surface px-4 text-[12px] font-medium text-bloom-accent disabled:opacity-40"><Save className="h-4 w-4" />{busy ? "Saving…" : "Save"}</button><button onClick={() => void save("notion")} disabled={busy || (draft === doc.content && doc.syncState === "in_sync")} className="flex h-10 items-center gap-2 rounded-bloom-sm bg-bloom-accent px-4 text-[12px] font-medium text-bloom-on-accent disabled:opacity-40"><ExternalLink className="h-4 w-4" />{busy ? "Saving and rebuilding…" : "Save to Notion"}</button></> : <><button onClick={() => { setEditing(true); setDraft(doc.content); }} disabled={busy || doc.status === "pending"} className="flex h-10 items-center gap-2 rounded-bloom-sm bg-bloom-accent px-4 text-[12px] font-medium text-bloom-on-accent disabled:opacity-40"><Pencil className="h-4 w-4" />Edit page</button><button onClick={() => void sync()} disabled={busy} className="flex h-10 items-center gap-2 rounded-bloom-sm border border-bloom-border bg-bloom-surface px-4 text-[12px]"><RefreshCw className="h-4 w-4" />Sync now</button></>}</div>
      </header>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1.4fr_.8fr]">
        <section>
          {editing ? <div className="rounded-bloom border border-bloom-border bg-bloom-surface">
            <div className="flex items-center justify-between border-b border-bloom-border px-4 py-3"><div><p className="text-[13px] font-medium">Edit in Markdown</p><p className="text-[11px] text-bloom-text-tertiary">Save keeps a MindBloom-only working copy. Save to Notion also replaces the page’s readable blocks in Notion. Both refresh the thought graph.</p></div><button onClick={() => setPreviewing((value) => !value)} className="flex items-center gap-1.5 rounded-bloom-sm border border-bloom-border px-3 py-1.5 text-[11px]"><Eye className="h-3.5 w-3.5" />{previewing ? "Write" : "Preview"}</button></div>
            {previewing ? <MarkdownContent content={draft || "_This page will be empty._"} className="min-h-[420px] max-h-[620px] overflow-auto p-5" /> : <textarea aria-label="Notion page Markdown" value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck className="min-h-[520px] w-full resize-y bg-transparent p-5 font-mono text-[13px] leading-6 text-bloom-text outline-none" />}
            <p className="border-t border-bloom-border px-4 py-3 text-[11px] leading-5 text-bloom-text-tertiary">Supported on write-back: headings, paragraphs, lists, checklists, quotes, dividers, code blocks, links, bold, italic, strikethrough, and inline code. Textual toggles are flattened. Pages containing child pages, databases, media, tables, synced blocks, or columns are protected from Markdown replacement and must be edited in Notion.</p>
          </div> : <div className="max-h-[620px] overflow-auto rounded-bloom border border-bloom-border bg-bloom-surface p-5">{doc.content ? <MarkdownContent content={doc.content} /> : <p className="text-[13px] text-bloom-text-secondary">This page has no readable text blocks.</p>}</div>}
          <div ref={mapRef} id="thought-map" className="mt-6 scroll-mt-6">{graph ? <MapViews snapshot={graph} focusMemoryId={focusMemoryId} /> : null}</div>
        </section>
        <aside className="space-y-6">
          <section className="rounded-bloom border border-bloom-border bg-bloom-surface p-5"><h2 className="font-serif text-[20px]">Related thoughts</h2><p className="mt-1 text-[12px] text-bloom-text-tertiary">The strongest individual thoughts from your earlier writing.</p><div className="mt-4 space-y-3">{related.map((thought) => <div key={thought.id} className="rounded-bloom-sm bg-bloom-bg p-3"><button type="button" aria-expanded={expandedThoughtId === thought.id} onClick={() => setExpandedThoughtId((current) => current === thought.id ? null : thought.id)} className="w-full text-left"><p className="text-[10px] font-semibold uppercase tracking-wide text-bloom-accent">{thought.theme} · {thought.memoryType}</p><p className="mt-1 text-[13px] font-medium leading-5 text-bloom-text">{thought.text}</p><p className="mt-2 text-[11px] text-bloom-text-tertiary">From {thought.documentTitle}{thought.sectionTitle ? ` · ${thought.sectionTitle}` : ""}</p></button>{expandedThoughtId === thought.id ? <div className="mt-3 grid grid-cols-2 gap-2 border-t border-bloom-border pt-3"><Link to={`/notion/${thought.documentId}?memoryId=${encodeURIComponent(thought.memoryId)}#thought-map`} className="flex items-center justify-center gap-1.5 rounded-bloom-sm border border-bloom-border bg-bloom-surface px-2 py-2 text-[11px] font-medium"><ArrowRight className="h-3.5 w-3.5" />Go to page</Link><button type="button" onClick={() => void chatWithThought(thought)} disabled={busy} className="flex items-center justify-center gap-1.5 rounded-bloom-sm bg-bloom-accent px-2 py-2 text-[11px] font-medium text-bloom-on-accent disabled:opacity-40"><MessageCircle className="h-3.5 w-3.5" />Chat with Bloom</button></div> : null}</div>)}{!related.length ? <p className="text-[12px] leading-5 text-bloom-text-secondary">Import a few pages to let recurring ideas find one another.</p> : null}</div></section>
          <section ref={bloomRef} className="scroll-mt-6 rounded-bloom border border-bloom-border bg-bloom-surface p-5"><h2 className="font-serif text-[20px]">Bloom with this page</h2><div className="mt-4 max-h-[320px] space-y-3 overflow-auto">{messages.map((message) => <div key={message.id} className={`rounded-bloom-sm p-3 text-[12px] leading-5 ${message.role === "user" ? "ml-8 bg-bloom-accent-bg" : "mr-4 bg-bloom-bg"}`}>{message.content}</div>)}</div><form onSubmit={ask} className="mt-4 flex items-end gap-2"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What connects this to my earlier thinking?" rows={2} className="min-w-0 flex-1 resize-none rounded-bloom-sm border border-bloom-border bg-bloom-bg p-3 text-[12px] outline-none" /><button disabled={busy || !question.trim()} aria-label="Ask Bloom" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bloom-accent text-bloom-on-accent disabled:opacity-40"><Send className="h-3.5 w-3.5" /></button></form></section>
        </aside>
      </div>
    </> : <p className="py-16 text-center text-[13px] text-bloom-text-secondary">Opening your page…</p>}
  </main>;
}
