import { BookOpen, Download, RefreshCw, RotateCcw, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { MindBloomDocument, NotionPageSummary } from "@mindbloom/shared";
import { cancelNotionIngestion, getNotionIngestion, importNotionPages, listNotionDocuments, listNotionPages, retryNotionIngestion } from "../lib/api";

function count(document: MindBloomDocument, key: string): number | null {
  const value = document.ingestion.counts[key];
  return typeof value === "number" ? value : null;
}

function ingestionLabel(document: MindBloomDocument): string {
  if (document.status === "ready") {
    const duration = document.ingestion.durationMs ? ` · ${(document.ingestion.durationMs / 1000).toFixed(1)}s` : "";
    return `${count(document, "selected") ?? 0} memories · ${count(document, "topics") ?? 0} topics${duration}`;
  }
  if (document.status === "failed") return document.lastError ?? "Import failed";
  return document.ingestion.phase ? `Processing: ${document.ingestion.phase}` : "Waiting to process";
}

export function NotionPage() {
  const [pages, setPages] = useState<NotionPageSummary[]>([]);
  const [documents, setDocuments] = useState<MindBloomDocument[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importSeconds, setImportSeconds] = useState(0);
  const [importProgress, setImportProgress] = useState({ completed: 0, total: 0, currentTitle: "" });
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [pageResult, documentResult] = await Promise.all([listNotionPages(), listNotionDocuments()]);
      setPages(pageResult.pages);
      setDocuments(documentResult.documents);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Notion");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const pending = documents.filter((document) => document.status === "pending" && document.ingestion.runId);
    if (!pending.length) return;
    const timer = window.setInterval(() => {
      void Promise.all(pending.map((document) => getNotionIngestion(document.id)))
        .then((responses) => setDocuments((current) => current.map((document) => responses.find((response) => response.document.id === document.id)?.document ?? document)))
        .catch(() => undefined);
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [documents]);
  useEffect(() => {
    if (!importing) { setImportSeconds(0); return; }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setImportSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1_000);
    return () => window.clearInterval(timer);
  }, [importing]);

  async function runImport() {
    const pageIds = [...selected];
    setImporting(true);
    setImportProgress({ completed: 0, total: pageIds.length, currentTitle: "" });
    setError(null);
    try {
      const failed: Array<{ error?: string }> = [];
      for (let index = 0; index < pageIds.length; index += 1) {
        const pageId = pageIds[index]!;
        setImportProgress({ completed: index, total: pageIds.length, currentTitle: pages.find((page) => page.id === pageId)?.title ?? "Notion page" });
        const result = await importNotionPages([pageId]);
        failed.push(...result.results.filter((item) => item.status === "failed"));
        setImportProgress((current) => ({ ...current, completed: index + 1 }));
      }
      setSelected([]);
      await load();
      if (failed.length) setError(`${failed.length} page${failed.length === 1 ? "" : "s"} could not be imported: ${failed[0]?.error}`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function runAction(document: MindBloomDocument, action: "retry" | "cancel") {
    setActingOn(document.id);
    setError(null);
    try {
      const response = action === "retry" ? await retryNotionIngestion(document.id) : await cancelNotionIngestion(document.id);
      setDocuments((current) => current.map((item) => item.id === document.id ? response.document : item));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Could not ${action} import`);
    } finally {
      setActingOn(null);
    }
  }

  return <main className="mx-auto min-h-dvh w-full max-w-[1120px] px-4 pb-24 pt-6 md:px-8 md:pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="label-text">Integration</p><h1 className="mt-1 font-serif text-[32px]">Notion garden</h1><p className="mt-2 max-w-2xl text-[13px] leading-5 text-bloom-text-secondary">Choose pages MindBloom may remember. Each page keeps its Notion sections and produces at most 6 topics and 12 useful memories.</p></div>
      <button onClick={() => void load()} disabled={loading || importing} aria-label="Refresh Notion" className="grid h-10 w-10 place-items-center rounded-full border border-bloom-border bg-bloom-surface"><RefreshCw className="h-4 w-4" /></button>
    </header>
    {error ? <div className="mt-5 rounded-bloom border border-coral-border bg-coral-bg p-4 text-[13px] text-coral-text">{error}</div> : null}
    {importing ? <div className="mt-5 rounded-bloom border border-bloom-border bg-bloom-surface p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-[13px] font-medium">Importing {importProgress.currentTitle || "selected pages"}</p><p className="mt-0.5 text-[11px] text-bloom-text-tertiary">Page {Math.min(importProgress.completed + 1, importProgress.total)} of {importProgress.total}</p></div><span className="text-[12px] tabular-nums text-bloom-text-tertiary">{importSeconds}s</span></div><div role="progressbar" aria-valuemin={0} aria-valuemax={importProgress.total} aria-valuenow={importProgress.completed} className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-bloom-border"><div className="h-full rounded-full bg-bloom-accent transition-[width] duration-300" style={{ width: `${importProgress.total ? (importProgress.completed / importProgress.total) * 100 : 0}%` }} /><div className="notion-import-sweep absolute inset-y-0 w-1/5 rounded-full bg-bloom-accent/60" /></div><p className="mt-2 text-[11px] text-bloom-text-tertiary">The filled portion shows completed pages; the moving highlight shows the page currently being processed.</p></div> : null}

    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-serif text-[21px]">Imported pages</h2><span className="text-[12px] text-bloom-text-tertiary">{documents.length} pages</span></div>
      <div className="grid gap-3 md:grid-cols-2">{documents.map((document) => <div key={document.id} className="rounded-bloom border border-bloom-border bg-bloom-surface p-4">
        <Link to={`/notion/${document.id}`} className="block transition-opacity hover:opacity-75"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-bloom-accent" /><h3 className="font-medium">{document.title}</h3></div><p className="mt-2 line-clamp-2 text-[12px] leading-5 text-bloom-text-secondary">{document.content || "This page has no text blocks."}</p></Link>
        <div className="mt-3 flex items-center justify-between gap-3"><p className={`text-[11px] ${document.status === "failed" ? "text-coral-text" : "text-bloom-text-tertiary"}`}>{ingestionLabel(document)}</p><div className="flex gap-2">{document.status === "failed" ? <button onClick={() => void runAction(document, "retry")} disabled={actingOn === document.id} className="flex items-center gap-1 text-[11px] text-bloom-accent"><RotateCcw className="h-3 w-3" />Retry</button> : null}{document.status === "pending" && document.ingestion.runId ? <button onClick={() => void runAction(document, "cancel")} disabled={actingOn === document.id} className="flex items-center gap-1 text-[11px] text-coral-text"><Square className="h-3 w-3" />Cancel</button> : null}</div></div>
        {document.ingestion.warnings.length ? <p className="mt-2 text-[11px] text-bloom-text-tertiary">Completed with {document.ingestion.warnings.length} quality warning{document.ingestion.warnings.length === 1 ? "" : "s"}.</p> : null}
      </div>)}</div>
      {!loading && !documents.length ? <p className="rounded-bloom border border-dashed border-bloom-border p-8 text-center text-[13px] text-bloom-text-secondary">No pages imported yet.</p> : null}
    </section>

    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-[21px]">Pages shared with MindBloom</h2><p className="text-[12px] text-bloom-text-tertiary">Only pages shared with your internal Notion integration appear here.</p></div><button onClick={() => void runImport()} disabled={!selected.length || importing} className="flex h-10 items-center gap-2 rounded-bloom-sm bg-bloom-accent px-4 text-[13px] font-medium text-bloom-on-accent disabled:opacity-40"><Download className="h-4 w-4" />{importing ? `Processing ${selected.length} page${selected.length === 1 ? "" : "s"}…` : `Import ${selected.length || "selected"}`}</button></div>
      <div className="divide-y divide-bloom-border rounded-bloom border border-bloom-border bg-bloom-surface">{pages.map((page) => <label key={page.id} className="flex cursor-pointer items-center gap-3 p-4"><input type="checkbox" disabled={Boolean(page.importedDocumentId) || importing} checked={selected.includes(page.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, page.id] : current.filter((id) => id !== page.id))} /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{page.title}</span><span className="text-[11px] text-bloom-text-tertiary">Edited {new Date(page.updatedAt).toLocaleDateString()}</span></span>{page.importedDocumentId ? <span className="text-[11px] text-bloom-accent">Imported</span> : null}</label>)}</div>
      {loading ? <p className="py-8 text-center text-[13px] text-bloom-text-secondary">Reading your Notion workspace…</p> : null}
    </section>
  </main>;
}
