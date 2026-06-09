import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ReflectPage } from "./ReflectPage";
import { NotesPage } from "./NotesPage";
import { PublicSharePage } from "./PublicSharePage";
import { MapPage } from "./MapPage";

describe("archive pages", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders Notes empty state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ notes: [], groups: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );

    render(<NotesPage />);

    expect(await screen.findByText("No notes yet")).toBeVisible();
  });

  it("loads a different map when the selected entry changes", async () => {
    const firstEntry = {
      id: "entry-1",
      ownerId: "demo-local",
      ownerKind: "demo",
      title: "First entry",
      tags: ["journal"],
      status: "draft",
      memoSessionId: "mindbloom-entry-entry-1",
      createdAt: "2026-06-04T08:00:00.000Z",
      updatedAt: "2026-06-04T08:00:00.000Z",
      completedAt: null,
      allowFutureContext: true,
    };
    const secondEntry = {
      ...firstEntry,
      id: "entry-2",
      title: "Second entry",
      memoSessionId: "mindbloom-entry-entry-2",
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/entries")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              entries: [firstEntry, secondEntry],
              groups: [{ date: "2026-06-04", entries: [firstEntry, secondEntry] }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.includes("/api/entries/entry-2/snapshot")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              sessionId: "mindbloom-entry-entry-2",
              nodes: [
                {
                  id: "second-theme",
                  sessionId: "mindbloom-entry-entry-2",
                  label: "Second theme",
                  summary: "A second-entry theme.",
                  topicOrder: 1,
                },
              ],
              edges: [],
              memories: [],
              memoryEdges: [],
              capturedAt: "2026-06-04T08:02:00.000Z",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.includes("/api/entries/entry-1/snapshot")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              sessionId: "mindbloom-entry-entry-1",
              nodes: [
                {
                  id: "first-theme",
                  sessionId: "mindbloom-entry-entry-1",
                  label: "First theme",
                  summary: "A first-entry theme.",
                  topicOrder: 1,
                },
              ],
              edges: [],
              memories: [],
              memoryEdges: [],
              capturedAt: "2026-06-04T08:01:00.000Z",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<MapPage />);

    expect(await screen.findByText("First theme")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Entry"), "entry-2");

    expect(await screen.findByText("Second theme")).toBeVisible();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("/api/entries/entry-2/snapshot?scope=overall"),
      ),
    ).toBe(true);
  });

  it("creates, edits, and deletes Notes", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/notes") && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              note: {
                id: "note-1",
                ownerId: "demo-local",
                ownerKind: "demo",
                title: "Good idea",
                body: "This should become a small shareable card.",
                entryId: null,
                sourceType: "blank",
                sourceMessageId: null,
                sourceReflectionId: null,
                sourceReflectionCardId: null,
                color: "blue",
                pinned: true,
                createdAt: "2026-06-04T08:00:00.000Z",
                updatedAt: "2026-06-04T08:00:00.000Z",
              },
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.endsWith("/api/notes/note-1") && init?.method === "PATCH") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              note: {
                id: "note-1",
                ownerId: "demo-local",
                ownerKind: "demo",
                title: "Better idea",
                body: "Edited note body.",
                entryId: null,
                sourceType: "blank",
                sourceMessageId: null,
                sourceReflectionId: null,
                sourceReflectionCardId: null,
                color: "teal",
                pinned: false,
                createdAt: "2026-06-04T08:00:00.000Z",
                updatedAt: "2026-06-04T08:02:00.000Z",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.endsWith("/api/notes/note-1") && init?.method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.endsWith("/api/entries")) {
        return Promise.resolve(
          new Response(JSON.stringify({ entries: [], groups: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            notes: [
              {
                id: "note-1",
                ownerId: "demo-local",
                ownerKind: "demo",
                title: "Good idea",
                body: "This should become a small shareable card.",
                entryId: null,
                sourceType: "blank",
                sourceMessageId: null,
                sourceReflectionId: null,
                sourceReflectionCardId: null,
                color: "blue",
                pinned: true,
                createdAt: "2026-06-04T08:00:00.000Z",
                updatedAt: "2026-06-04T08:00:00.000Z",
              },
            ],
            groups: [
              {
                date: "2026-06-04",
                notes: [
                  {
                    id: "note-1",
                    ownerId: "demo-local",
                    ownerKind: "demo",
                    title: "Good idea",
                    body: "This should become a small shareable card.",
                    entryId: null,
                    sourceType: "blank",
                    sourceMessageId: null,
                    sourceReflectionId: null,
                    sourceReflectionCardId: null,
                    color: "blue",
                    pinned: true,
                    createdAt: "2026-06-04T08:00:00.000Z",
                    updatedAt: "2026-06-04T08:00:00.000Z",
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<NotesPage />);

    expect(await screen.findByText("Good idea")).toBeVisible();
    const editor = screen.getByRole("heading", { name: "New note" }).closest("section");
    expect(editor).not.toBeNull();
    await user.type(within(editor as HTMLElement).getByLabelText("Title"), "Good idea");
    await user.type(
      within(editor as HTMLElement).getByLabelText("What do you want to remember?"),
      "This should become a small shareable card.",
    );
    await user.click(within(editor as HTMLElement).getByLabelText("Use blue note color"));
    await user.click(within(editor as HTMLElement).getByLabelText("Pin this note"));
    await user.click(within(editor as HTMLElement).getByRole("button", { name: "Save note" }));

    await user.click(screen.getByText("Good idea"));
    const noteDetail = screen.getByLabelText("Note detail");
    expect(
      within(noteDetail).getByText("This should become a small shareable card."),
    ).toBeVisible();
    await user.click(within(noteDetail).getByRole("button", { name: "Edit" }));
    const editEditor = screen.getByRole("heading", { name: "Edit note" }).closest("section");
    expect(editEditor).not.toBeNull();
    await user.clear(within(editEditor as HTMLElement).getByLabelText("Title"));
    await user.type(within(editEditor as HTMLElement).getByLabelText("Title"), "Better idea");
    await user.clear(
      within(editEditor as HTMLElement).getByLabelText("What do you want to remember?"),
    );
    await user.type(
      within(editEditor as HTMLElement).getByLabelText("What do you want to remember?"),
      "Edited note body.",
    );
    await user.click(within(editEditor as HTMLElement).getByRole("button", { name: "Save note" }));
    await user.click(screen.getByLabelText("Delete Good idea"));
    await user.click(screen.getByRole("button", { name: "Delete note" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith("/api/notes/note-1") && init?.method === "DELETE",
        ),
      ).toBe(true);
    });
  });

  it("renders Reflection empty state when no entries are available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ entries: [], groups: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );

    render(<ReflectPage />);

    expect(await screen.findByText("A reflection needs an entry")).toBeVisible();
  });

  it("generates and renders entry reflection cards", async () => {
    const entry = {
      id: "entry-1",
      ownerId: "demo-local",
      ownerKind: "demo",
      title: "Morning idea",
      purpose: "idea",
      mode: "mixed",
      status: "draft",
      memoSessionId: "mindbloom-entry-entry-1",
      createdAt: "2026-06-04T08:00:00.000Z",
      updatedAt: "2026-06-04T08:00:00.000Z",
      completedAt: null,
      allowFutureContext: true,
    };
    const reflection = {
      id: "reflection-1",
      entryId: "entry-1",
      createdAt: "2026-06-04T08:05:00.000Z",
      graphSnapshot: {
        sessionId: "mindbloom-entry-entry-1",
        nodes: [],
        edges: [],
        memories: [],
        memoryEdges: [],
        capturedAt: "2026-06-04T08:05:00.000Z",
      },
      cards: [
        {
          id: "stats",
          type: "stats",
          title: "Words You Put Down",
          body: "You wrote 42 words.",
        },
        {
          id: "question",
          type: "question",
          title: "Question For Next Time",
          body: "What do you want to try next?",
        },
      ],
    };
    let hasReflection = false;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/entries")) {
        return Promise.resolve(
          new Response(JSON.stringify({ entries: [entry], groups: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url.endsWith("/api/entries/entry-1/reflections") && init?.method === "POST") {
        hasReflection = true;
        return Promise.resolve(
          new Response(JSON.stringify({ reflection }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url.endsWith("/api/reflections/reflection-1/share-links") && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              shareLink: {
                id: "share-1",
                reflectionId: "reflection-1",
                token: "public-token-123456789",
                selectedCardIds: ["stats"],
                createdAt: "2026-06-04T08:06:00.000Z",
                expiresAt: null,
                revokedAt: null,
              },
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }
      if (url.endsWith("/api/reflections/reflection-1/share-links")) {
        return Promise.resolve(
          new Response(JSON.stringify({ shareLinks: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url.endsWith("/api/entries/entry-1/reflections")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ reflections: hasReflection ? [reflection] : [] }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ReflectPage />);

    expect(await screen.findByText("No reflection cards yet")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reflect on this entry" }));

    await waitFor(() => {
      expect(screen.getByText("Words You Put Down")).toBeVisible();
    });
    expect(screen.getByText("Question For Next Time")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Share reflection" }));
    const shareModal = screen.getByLabelText("Share reflection");
    await user.click(within(shareModal).getByLabelText("Question For Next Time"));
    await user.click(within(shareModal).getByRole("button", { name: "Create share link" }));
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith("/api/entries/entry-1/reflections") &&
          init?.method === "POST",
      ),
    ).toBe(true);
    const shareCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/api/reflections/reflection-1/share-links") &&
        init?.method === "POST",
    );
    expect(JSON.parse(String(shareCall?.[1]?.body))).toEqual({
      selectedCardIds: ["stats"],
    });
  });

  it("renders selected public reflection cards only", async () => {
    window.history.pushState(null, "", "/share/public-token-123456789");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              token: "public-token-123456789",
              createdAt: "2026-06-04T08:06:00.000Z",
              expiresAt: null,
              cards: [
                {
                  id: "mood",
                  type: "mood",
                  title: "Mood",
                  body: "You noticed a quiet shift.",
                },
                {
                  id: "map",
                  type: "mind-map",
                  title: "Mind Map Snapshot",
                  body: "This map should render as a graph, not plain text.",
                  metadata: {
                    graphSnapshot: {
                      sessionId: "mindbloom-entry-entry-1",
                      nodes: [
                        {
                          id: "shared-theme",
                          sessionId: "mindbloom-entry-entry-1",
                          label: "Shared theme",
                          summary: "A theme selected for public sharing.",
                          topicOrder: 1,
                        },
                      ],
                      edges: [],
                      memories: [],
                      memoryEdges: [],
                      capturedAt: "2026-06-04T08:06:00.000Z",
                    },
                  },
                },
              ],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        ),
      ),
    );

    render(
      <MemoryRouter initialEntries={["/share/public-token-123456789"]}>
        <Routes>
          <Route path="/share/:token" element={<PublicSharePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Shared Reflection")).toBeVisible();
    expect(screen.getByText("Mood")).toBeVisible();
    expect(screen.getByText("You noticed a quiet shift.")).toBeVisible();
    expect(screen.getByText("Mind Map Snapshot")).toBeVisible();
    expect(screen.getByText("All visible themes")).toBeVisible();
    expect(
      screen.queryByText("This map should render as a graph, not plain text."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Private entry")).not.toBeInTheDocument();
  });
});
