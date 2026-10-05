import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { NotionDocumentPage } from "./NotionDocumentPage";

vi.mock("../components/map/MapViews", () => ({ MapViews: () => <div>Thought map</div> }));

const sourceUpdatedAt = "2026-10-05T08:00:00.000Z";
function document(content: string, updatedAt = sourceUpdatedAt) {
  return {
    id: "11111111-1111-4111-8111-111111111111", source: "notion", externalId: "notion-page-1",
    title: "Product ideas", content, sourceUrl: "https://notion.so/page-1",
    sourceCreatedAt: "2026-10-01T08:00:00.000Z", sourceUpdatedAt: updatedAt,
    memoSessionId: "notion-session-1", status: "ready", lastSyncedAt: updatedAt, syncState: "in_sync", localSavedAt: null, lastError: null,
    ingestion: { runId: "run-1", status: "completed", phase: "finished", counts: { selected: 4, topics: 2 }, warnings: [], durationMs: 8000 },
    createdAt: sourceUpdatedAt, updatedAt,
  };
}

function json(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
}

describe("Notion document editing", () => {
  it("renders imported Markdown and saves edits with the source concurrency timestamp", async () => {
    const initialContent = "# Thought graph\n\nUse **contextual suggestions** while writing.";
    const savedContent = `${initialContent}\n\n## Next experiment`;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/related")) return json({ thoughts: [] });
      if (url.endsWith("/graph")) return json({ sessionId: "notion-session-1", nodes: [], edges: [], memories: [], memoryEdges: [], episodes: [], clusters: [], capturedAt: sourceUpdatedAt });
      if (url.endsWith("/notion") && init?.method === "POST") return json({ document: document(savedContent, "2026-10-05T08:05:00.000Z") });
      return json({ document: document(initialContent) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<MemoryRouter initialEntries={["/notion/11111111-1111-4111-8111-111111111111"]}><Routes><Route path="/notion/:documentId" element={<NotionDocumentPage />} /></Routes></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Thought graph" })).toBeVisible();
    expect(screen.getByText("contextual suggestions")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Edit page" }));
    const editor = screen.getByRole("textbox", { name: "Notion page Markdown" });
    await user.type(editor, "\n\n## Next experiment");
    await user.click(screen.getByRole("button", { name: "Save to Notion" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => {
      if (!String(url).endsWith("/api/notion/documents/11111111-1111-4111-8111-111111111111/notion") || init?.method !== "POST") return false;
      return JSON.parse(String(init.body)).expectedSourceUpdatedAt === sourceUpdatedAt && JSON.parse(String(init.body)).content === savedContent;
    })).toBe(true));
    expect(await screen.findByRole("heading", { name: "Next experiment" })).toBeVisible();
  });

  it("saves a MindBloom-only working copy without writing to Notion", async () => {
    const initialContent = "# Draft";
    const saved = { ...document("# Draft\n\nA local idea"), syncState: "local_changes" as const, localSavedAt: sourceUpdatedAt };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/related")) return json({ thoughts: [] });
      if (url.endsWith("/graph")) return json({ sessionId: "notion-session-1", nodes: [], edges: [], memories: [], memoryEdges: [], episodes: [], clusters: [], capturedAt: sourceUpdatedAt });
      if (init?.method === "PATCH") return json({ document: saved });
      return json({ document: document(initialContent) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/notion/11111111-1111-4111-8111-111111111111"]}><Routes><Route path="/notion/:documentId" element={<NotionDocumentPage />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole("button", { name: "Edit page" }));
    await user.type(screen.getByRole("textbox", { name: "Notion page Markdown" }), "\n\nA local idea");
    await user.click(screen.getByRole("button", { name: /^Save$/ }));

    await screen.findByText(/not yet in Notion/i);
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/notion") && init?.method === "POST")).toBe(false);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true);
  });

  it("offers page and Bloom actions for an individual related thought", async () => {
    const thought = {
      id: "memory-related-1", memoryId: "memory-related-1", documentId: "22222222-2222-4222-8222-222222222222",
      documentTitle: "Earlier research", sourceUrl: "https://notion.so/earlier", text: "Suggestions should arrive while a person is writing.",
      theme: "Contextual suggestions", memoryType: "insight", sectionId: "section-1", sectionTitle: "Writing flow", relevance: 0.91,
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/related")) return json({ thoughts: [thought] });
      if (url.endsWith("/graph")) return json({ sessionId: "notion-session-1", nodes: [], edges: [], memories: [], memoryEdges: [], episodes: [], clusters: [], capturedAt: sourceUpdatedAt });
      if (url.endsWith("/bloom") && init?.method === "POST") return json({
        answer: "You used this in Earlier research while considering the writing flow.",
        messages: [
          { id: "message-user", role: "user", content: "Help me revisit this earlier thought", createdAt: sourceUpdatedAt },
          { id: "message-bloom", role: "assistant", content: "You used this in Earlier research while considering the writing flow.", createdAt: sourceUpdatedAt },
        ],
        sources: [thought],
      });
      return json({ document: document("# Current page\n\nA new writing idea.") });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/notion/11111111-1111-4111-8111-111111111111"]}><Routes><Route path="/notion/:documentId" element={<NotionDocumentPage />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole("button", { name: /Suggestions should arrive while a person is writing/i }));
    expect(screen.getByRole("link", { name: "Go to page" })).toHaveAttribute("href", `/notion/${thought.documentId}?memoryId=${thought.memoryId}#thought-map`);
    await user.click(screen.getByRole("button", { name: "Chat with Bloom" }));

    expect(await screen.findByText("You used this in Earlier research while considering the writing flow.")).toBeVisible();
    const bloomCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/bloom"));
    expect(JSON.parse(String(bloomCall?.[1]?.body))).toEqual({ thoughtId: thought.id });
  });
});
