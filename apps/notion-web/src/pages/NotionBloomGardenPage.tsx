import { BookOpen, Download, FileDown, RefreshCw, RotateCcw, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { MindBloomDocument, NotionConnection, NotionImportJob, NotionPageSummary } from "@mindbloom/shared";
import {
  cancelNotionImport,
  cancelNotionIngestion,
  deleteNotionDocument,
  exportNotionData,
  getNotionImport,
  getNotionIngestion,
  importNotionPages,
  listActiveNotionImports,
  listNotionConnections,
  listNotionDocuments,
  listNotionPages,
  retryNotionIngestion,
  startNotionOAuth,
  disconnectNotionConnection,
} from "../../../web/src/lib/api";

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

const terminalStatuses = new Set<NotionImportJob["status"]>(["completed", "completed_with_errors", "failed", "cancelled"]);

export function NotionBloomGardenPage() {
  const [pages, setPages] = useState<NotionPageSummary[]>([]);
  const [documents, setDocuments] = useState<MindBloomDocument[]>([]);
  const [connections, setConnections] = useState<NotionConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | undefined>();
  const [legacyAvailable, setLegacyAvailable] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [importJob, setImportJob] = useState<NotionImportJob | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importing = Boolean(importJob && !terminalStatuses.has(importJob.status));
  const activeConnection = connections.find((item) => item.id === activeConnectionId);
  const workspaceUsable = activeConnectionId ? activeConnection?.status === "connected" : legacyAvailable;
  const currentTitle = useMemo(() => pages.find((page) => page.id === importJob?.currentPageId)?.title ?? importJob?.currentPageTitle ?? "selected pages", [pages, importJob]);

  async function load() {
    setLoading(true);
    try {
      const connectionResult = await listNotionConnections();
      const queryConnection = new URLSearchParams(window.location.search).get("connectionId") ?? undefined;
      const remembered = window.localStorage.getItem("notion-bloom-connection") ?? undefined;
      const selectedConnection = [queryConnection, activeConnectionId, remembered, connectionResult.connections.find((item) => item.status === "connected")?.id, connectionResult.connections[0]?.id]
        .find((candidate) => candidate && connectionResult.connections.some((item) => item.id === candidate));
      setConnections(connectionResult.connections);
      setLegacyAvailable(connectionResult.legacyInternalAvailable);
      setActiveConnectionId(selectedConnection);
      if (selectedConnection) window.localStorage.setItem("notion-bloom-connection", selectedConnection);
      if (!selectedConnection && !connectionResult.legacyInternalAvailable) {
        setPages([]); setDocuments([]); setImportJob(null); return;
      }
      const selectedStatus = connectionResult.connections.find((item) => item.id === selectedConnection)?.status;
      const [pageResult, documentResult, activeImports] = await Promise.all([
        selectedConnection && selectedStatus !== "connected" ? Promise.resolve({ pages: [] }) : listNotionPages(selectedConnection),
        listNotionDocuments(selectedConnection),
        listActiveNotionImports(),
      ]);
      setPages(pageResult.pages);
      setDocuments(documentResult.documents);
      setImportJob((current) => current && !terminalStatuses.has(current.status) ? current : activeImports.jobs.find((job) => (job.connectionId ?? undefined) === selectedConnection) ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Notion");
    } finally { setLoading(false); }
  }

  async function switchWorkspace(connectionId: string) {
    setActiveConnectionId(connectionId || undefined);
    if (connectionId) window.localStorage.setItem("notion-bloom-connection", connectionId);
    else window.localStorage.removeItem("notion-bloom-connection");
    setLoading(true); setSelected([]); setError(null);
    try {
      const connection = connections.find((item) => item.id === connectionId);
      const [pageResult, documentResult] = await Promise.all([
        connection && connection.status !== "connected" ? Promise.resolve({ pages: [] }) : listNotionPages(connectionId || undefined),
        listNotionDocuments(connectionId || undefined),
      ]);
      setPages(pageResult.pages); setDocuments(documentResult.documents);
    } catch (workspaceError) { setError(workspaceError instanceof Error ? workspaceError.message : "Could not open workspace"); }
    finally { setLoading(false); }
  }

  async function connectWorkspace() {
    try {
      const { authorizationUrl } = await startNotionOAuth("/notion");
      window.location.assign(authorizationUrl);
    } catch (connectionError) { setError(connectionError instanceof Error ? connectionError.message : "Could not start Notion connection"); }
  }

  async function disconnectWorkspace() {
    if (!activeConnectionId || !window.confirm("Disconnect this workspace? Imported data will remain read-only until you reconnect.")) return;
    try {
      await disconnectNotionConnection(activeConnectionId);
      window.localStorage.removeItem("notion-bloom-connection");
      setActiveConnectionId(undefined);
      await load();
    } catch (connectionError) { setError(connectionError instanceof Error ? connectionError.message : "Could not disconnect workspace"); }
  }

  useEffect(() => {
    const callback = new URLSearchParams(window.location.search);
    if (callback.get("notion") === "error") setError("Notion did not authorize this workspace. Try connecting it again.");
    void load();
  }, []);
  useEffect(() => {
    if (!importJob || terminalStatuses.has(importJob.status)) return;
    const timer = window.setInterval(() => {
      void getNotionImport(importJob.id).then(({ job }) => {
        setImportJob(job);
        if (terminalStatuses.has(job.status)) {
          const failures = job.results.filter((result) => result.status === "failed");
          if (failures.length) setError(`${failures.length} page${failures.length === 1 ? "" : "s"} could not be imported: ${failures[0]?.error ?? "Import failed"}`);
          void load();
        }
      }).catch((pollError) => setError(pollError instanceof Error ? pollError.message : "Could not read import progress"));
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [importJob?.id, importJob?.status]);

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

  async function runImport() {
    setError(null);
    try {
      const { job } = await importNotionPages(selected, activeConnectionId);
      setImportJob(job);
      setSelected([]);
    } catch (importError) { setError(importError instanceof Error ? importError.message : "Import failed"); }
  }

  async function downloadExport() {
    try {
      const blob = await exportNotionData();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `notion-bloom-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) { setError(exportError instanceof Error ? exportError.message : "Could not export data"); }
  }

  async function stopImport() {
    if (!importJob) return;
    try { setImportJob((await cancelNotionImport(importJob.id)).job); }
    catch (cancelError) { setError(cancelError instanceof Error ? cancelError.message : "Could not cancel import"); }
  }

  async function runAction(document: MindBloomDocument, action: "retry" | "cancel" | "delete") {
    if (action === "delete" && !window.confirm(`Remove “${document.title}” and its derived memories from Notion Bloom? The original Notion page will not be changed.`)) return;
    setActingOn(document.id); setError(null);
    try {
      if (action === "delete") {
        await deleteNotionDocument(document.id);
        setDocuments((current) => current.filter((item) => item.id !== document.id));
        setPages((current) => current.map((page) => page.importedDocumentId === document.id ? { ...page, importedDocumentId: null } : page));
      } else {
        const response = action === "retry" ? await retryNotionIngestion(document.id) : await cancelNotionIngestion(document.id);
        setDocuments((current) => current.map((item) => item.id === document.id ? response.document : item));
      }
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : `Could not ${action} import`); }
    finally { setActingOn(null); }
  }

  const progress = importJob?.totalPages ? Math.round((importJob.completedPages / importJob.totalPages) * 100) : 0;
  return <main className="mx-auto min-h-dvh w-full max-w-[1120px] px-4 pb-24 pt-6 md:px-8 md:pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="label-text">Integration</p><h1 className="mt-1 font-serif text-[32px]">Notion garden</h1><p className="mt-2 max-w-2xl text-[13px] leading-5 text-bloom-text-secondary">Choose pages Notion Bloom may remember. Imported text is stored and processed to create topics, memories, and connections.</p></div><div className="flex gap-2"><button onClick={() => void downloadExport()} aria-label="Export Notion Bloom data" className="grid h-10 w-10 place-items-center rounded-full border border-bloom-border bg-bloom-surface"><FileDown className="h-4 w-4" /></button><button onClick={() => void load()} disabled={loading} aria-label="Refresh Notion" className="grid h-10 w-10 place-items-center rounded-full border border-bloom-border bg-bloom-surface"><RefreshCw className="h-4 w-4" /></button></div></header>
    <section className="mt-5 flex flex-wrap items-center gap-3 rounded-bloom border border-bloom-border bg-bloom-surface p-4"><label className="text-[11px] font-medium text-bloom-text-secondary">Workspace <select aria-label="Notion workspace" value={activeConnectionId ?? ""} onChange={(event) => void switchWorkspace(event.target.value)} className="ml-2 h-9 rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 text-[12px]">{legacyAvailable ? <option value="">Legacy internal workspace</option> : null}{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.workspaceName}{connection.status !== "connected" ? ` · ${connection.status.replaceAll("_", " ")}` : ""}</option>)}</select></label><button onClick={() => void connectWorkspace()} className="h-9 rounded-bloom-sm bg-bloom-accent px-4 text-[12px] font-medium text-bloom-on-accent">{activeConnection && activeConnection.status !== "connected" ? "Reconnect workspace" : "Connect workspace"}</button>{activeConnection?.status === "connected" ? <button onClick={() => void disconnectWorkspace()} className="h-9 rounded-bloom-sm border border-coral-border bg-coral-bg px-4 text-[12px] text-coral-text">Disconnect</button> : null}<span className="ml-auto text-[11px] text-bloom-text-tertiary">{activeConnection?.status ?? (legacyAvailable ? "internal connection" : "not connected")}</span></section>
    {!activeConnectionId && !legacyAvailable ? <section className="mt-6 rounded-bloom border border-dashed border-bloom-border bg-bloom-surface p-10 text-center"><h2 className="font-serif text-[24px]">Connect your first workspace</h2><p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-bloom-text-secondary">Notion will ask which pages you want to share. Notion Bloom cannot read pages you do not select.</p><button onClick={() => void connectWorkspace()} className="mt-5 h-10 rounded-bloom-sm bg-bloom-accent px-5 text-[13px] font-medium text-bloom-on-accent">Connect Notion</button></section> : null}
    {error ? <div className="mt-5 rounded-bloom border border-coral-border bg-coral-bg p-4 text-[13px] text-coral-text">{error}</div> : null}
    {importing && importJob ? <div className="mt-5 rounded-bloom border border-bloom-border bg-bloom-surface p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-[13px] font-medium">{importJob.status === "queued" ? "Import queued" : `Importing ${currentTitle}`}</p><p className="mt-0.5 text-[11px] text-bloom-text-tertiary">{importJob.completedPages} of {importJob.totalPages} pages complete · {importJob.stage.replaceAll("_", " ")}</p></div><button onClick={() => void stopImport()} className="flex items-center gap-1 text-[11px] text-coral-text"><Square className="h-3 w-3" />Cancel</button></div><div role="progressbar" aria-valuemin={0} aria-valuemax={importJob.totalPages} aria-valuenow={importJob.completedPages} className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-bloom-border"><div className="h-full rounded-full bg-bloom-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />{importJob.status === "running" ? <div className="notion-import-sweep absolute inset-y-0 w-1/5 rounded-full bg-bloom-accent/60" /> : null}</div><p className="mt-2 text-[11px] text-bloom-text-tertiary">You can close this page. Processing continues in the background.</p></div> : null}

    <section className="mt-7"><div className="mb-3 flex items-center justify-between"><h2 className="font-serif text-[21px]">Imported pages</h2><span className="text-[12px] text-bloom-text-tertiary">{documents.length} pages</span></div><div className="grid gap-3 md:grid-cols-2">{documents.map((document) => <div key={document.id} className="rounded-bloom border border-bloom-border bg-bloom-surface p-4"><Link to={`/notion/${document.id}`} className="block transition-opacity hover:opacity-75"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-bloom-accent" /><h3 className="font-medium">{document.title}</h3></div><p className="mt-2 line-clamp-2 text-[12px] leading-5 text-bloom-text-secondary">{document.content || "This page has no text blocks."}</p></Link><div className="mt-3 flex items-center justify-between gap-3"><p className={`text-[11px] ${document.status === "failed" ? "text-coral-text" : "text-bloom-text-tertiary"}`}>{ingestionLabel(document)}</p><div className="flex gap-2">{document.status === "failed" ? <button onClick={() => void runAction(document, "retry")} disabled={actingOn === document.id} className="flex items-center gap-1 text-[11px] text-bloom-accent"><RotateCcw className="h-3 w-3" />Retry</button> : null}{document.status === "pending" && document.ingestion.runId ? <button onClick={() => void runAction(document, "cancel")} disabled={actingOn === document.id} className="flex items-center gap-1 text-[11px] text-coral-text"><Square className="h-3 w-3" />Cancel</button> : null}<button onClick={() => void runAction(document, "delete")} disabled={actingOn === document.id || document.status === "pending"} className="flex items-center gap-1 text-[11px] text-coral-text disabled:opacity-40"><Trash2 className="h-3 w-3" />Remove</button></div></div>{document.ingestion.warnings.length ? <p className="mt-2 text-[11px] text-bloom-text-tertiary">Completed with {document.ingestion.warnings.length} quality warning{document.ingestion.warnings.length === 1 ? "" : "s"}.</p> : null}</div>)}</div>{!loading && !documents.length ? <p className="rounded-bloom border border-dashed border-bloom-border p-8 text-center text-[13px] text-bloom-text-secondary">No pages imported yet.</p> : null}</section>

    <section className="mt-8"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-[21px]">Pages shared with Notion Bloom</h2><p className="text-[12px] text-bloom-text-tertiary">{workspaceUsable ? "Only pages shared with the selected workspace connection appear here." : "Reconnect this workspace to discover or import more pages. Existing imports remain available below."}</p></div><button onClick={() => void runImport()} disabled={!workspaceUsable || !selected.length || importing} className="flex h-10 items-center gap-2 rounded-bloom-sm bg-bloom-accent px-4 text-[13px] font-medium text-bloom-on-accent disabled:opacity-40"><Download className="h-4 w-4" />{importing ? "Import in progress" : `Import ${selected.length || "selected"}`}</button></div><div className="divide-y divide-bloom-border rounded-bloom border border-bloom-border bg-bloom-surface">{pages.map((page) => <label key={page.id} className="flex cursor-pointer items-center gap-3 p-4"><input type="checkbox" disabled={Boolean(page.importedDocumentId) || importing} checked={selected.includes(page.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, page.id] : current.filter((id) => id !== page.id))} /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{page.title}</span><span className="text-[11px] text-bloom-text-tertiary">Edited {new Date(page.updatedAt).toLocaleDateString()}</span></span>{page.importedDocumentId ? <span className="text-[11px] text-bloom-accent">Imported</span> : null}</label>)}</div>{loading ? <p className="py-8 text-center text-[13px] text-bloom-text-secondary">Reading your Notion workspace…</p> : null}</section>
  </main>;
}
