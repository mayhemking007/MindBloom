import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntryDayGroup, JournalEntry } from "@mindbloom/shared";

import { JournalWorkspace } from "./JournalWorkspace";

const entry: JournalEntry = {
  id: "entry-1",
  ownerId: "demo-local",
  ownerKind: "demo",
  title: "Morning thoughts",
  purpose: "journal",
  mode: "classic",
  status: "draft",
  memoSessionId: "mindbloom-entry-entry-1",
  createdAt: "2026-06-04T08:00:00.000Z",
  updatedAt: "2026-06-04T08:00:00.000Z",
  completedAt: null,
  allowFutureContext: true,
};

const groups: EntryDayGroup[] = [
  {
    date: "2026-06-04",
    entries: [entry],
  },
];

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(handler(String(input), init)),
    ),
  );
}

describe("JournalWorkspace", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a first demo entry when the workspace is empty", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/entries") && fetchMock.mock.calls.length === 1) {
        return Promise.resolve(jsonResponse({ entries: [], groups: [] }));
      }
      if (url.endsWith("/api/entries") && fetchMock.mock.calls.length === 2) {
        return Promise.resolve(jsonResponse({ entry }, { status: 201 }));
      }
      if (url.endsWith("/api/entries") && fetchMock.mock.calls.length === 3) {
        return Promise.resolve(jsonResponse({ entries: [entry], groups }));
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return Promise.resolve(jsonResponse({ document: null }));
      }
      if (url.endsWith("/api/entries/entry-1/messages")) {
        return Promise.resolve(jsonResponse({ messages: [] }));
      }
      if (url.endsWith("/api/entries/entry-1/grafts")) {
        return Promise.resolve(jsonResponse({ grafts: [] }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<JournalWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText("Morning thoughts").length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getByLabelText("Journal entry")).toBeVisible();
  });

  it("loads the selected entry document into the classic editor", async () => {
    mockFetch((url) => {
      if (url.endsWith("/api/entries")) {
        return jsonResponse({ entries: [entry], groups });
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return jsonResponse({
          document: {
            id: "doc-1",
            entryId: entry.id,
            content: "A draft about making journaling easier.",
            version: 1,
            lastIngestedVersion: null,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          },
        });
      }
      if (url.endsWith("/api/entries/entry-1/messages")) {
        return jsonResponse({ messages: [] });
      }
      if (url.endsWith("/api/entries/entry-1/grafts")) {
        return jsonResponse({ grafts: [] });
      }
      return jsonResponse({});
    });

    render(<JournalWorkspace />);

    expect(
      await screen.findByDisplayValue("A draft about making journaling easier."),
    ).toBeVisible();
  });

  it("sends Bloom messages with Enter and stores the assistant reply", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/entries") && init?.method !== "POST") {
        return Promise.resolve(jsonResponse({ entries: [entry], groups }));
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return Promise.resolve(jsonResponse({ document: null }));
      }
      if (url.endsWith("/api/entries/entry-1/messages") && !init?.method) {
        return Promise.resolve(jsonResponse({ messages: [] }));
      }
      if (url.endsWith("/api/entries/entry-1/grafts")) {
        return Promise.resolve(jsonResponse({ grafts: [] }));
      }
      if (url.endsWith("/api/entries/entry-1/messages")) {
        const body = JSON.parse(String(init?.body));
        return Promise.resolve(
          jsonResponse(
            {
              message: {
                id: `${body.role}-message`,
                entryId: entry.id,
                role: body.role,
                content: body.content,
                createdAt: "2026-06-04T08:01:00.000Z",
              },
            },
            { status: 201 },
          ),
        );
      }
      if (url.endsWith("/api/chat")) {
        return Promise.resolve(
          jsonResponse({
            reply: "You are circling a useful starting point.",
            topicPills: [
              {
                id: "theme-1",
                label: "Writing momentum",
                topicOrder: 1,
              },
            ],
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<JournalWorkspace />);

    const bloomInput = await screen.findByLabelText("Ask Bloom");
    await user.type(bloomInput, "Help me continue{Enter}");

    await waitFor(() => {
      expect(screen.getByText("You are circling a useful starting point.")).toBeVisible();
    });
    expect(screen.getByText("Writing momentum")).toBeVisible();
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/api/chat")),
    ).toBe(true);
  });

  it("brings previous themes into the Bloom sidebar", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/entries") && init?.method !== "POST") {
        return Promise.resolve(jsonResponse({ entries: [entry], groups }));
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return Promise.resolve(jsonResponse({ document: null }));
      }
      if (url.endsWith("/api/entries/entry-1/messages")) {
        return Promise.resolve(jsonResponse({ messages: [] }));
      }
      if (url.endsWith("/api/entries/entry-1/grafts/relevance")) {
        return Promise.resolve(
          jsonResponse({
            grafts: [
              {
                id: "graft-1",
                entryId: "entry-1",
                query: "setting boundaries",
                sourceEntryId: "entry-old",
                sourceEntryTitle: "Earlier boundary note",
                sourceEntryCreatedAt: "2026-06-03T08:00:00.000Z",
                sourceSessionId: "mindbloom-entry-entry-old",
                sourceThemeId: "theme-old",
                themeLabel: "Setting better boundaries",
                similarity: null,
                graftedAt: "2026-06-04T08:01:00.000Z",
              },
            ],
            topicPills: [
              {
                id: "theme-1",
                label: "Boundaries",
                topicOrder: 1,
              },
            ],
            tokenCount: 42,
          }),
        );
      }
      if (url.endsWith("/api/entries/entry-1/grafts")) {
        return Promise.resolve(jsonResponse({ grafts: [] }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<JournalWorkspace />);

    const contextInput = await screen.findByLabelText("Bring in a previous theme");
    await user.type(contextInput, "setting boundaries{Enter}");

    await waitFor(() => {
      expect(screen.getByText("Setting better boundaries")).toBeVisible();
    });
    expect(screen.getByText("From Earlier boundary note")).toBeVisible();
    expect(screen.getByText("Boundaries")).toBeVisible();
    const graftCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/api/entries/entry-1/grafts/relevance"),
    );
    expect(JSON.parse(String(graftCall?.[1]?.body))).toMatchObject({
      query: "setting boundaries",
      maxThemes: 4,
      minSimilarity: 0.6,
    });
  });

  it("creates an entry from the purpose and mode chooser", async () => {
    const createdEntry = {
      ...entry,
      id: "entry-2",
      title: "Campaign idea",
      purpose: "idea",
      mode: "mixed",
      memoSessionId: "mindbloom-entry-entry-2",
    } satisfies JournalEntry;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/entries") && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ entry: createdEntry }, { status: 201 }));
      }
      if (url.endsWith("/api/entries") && !init?.method) {
        return Promise.resolve(
          jsonResponse({
            entries: [createdEntry, entry],
            groups: [{ date: "2026-06-04", entries: [createdEntry, entry] }],
          }),
        );
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return Promise.resolve(jsonResponse({ document: null }));
      }
      if (url.endsWith("/api/entries/entry-1/messages")) {
        return Promise.resolve(jsonResponse({ messages: [] }));
      }
      if (url.endsWith("/api/entries/entry-1/grafts")) {
        return Promise.resolve(jsonResponse({ grafts: [] }));
      }
      if (url.endsWith("/api/entries/entry-2/document")) {
        return Promise.resolve(jsonResponse({ document: null }));
      }
      if (url.endsWith("/api/entries/entry-2/messages")) {
        return Promise.resolve(jsonResponse({ messages: [] }));
      }
      if (url.endsWith("/api/entries/entry-2/grafts")) {
        return Promise.resolve(jsonResponse({ grafts: [] }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<JournalWorkspace />);

    await user.click(await screen.findByRole("button", { name: "New Entry" }));
    const createPanel = screen.getByLabelText("Create journal entry");
    await user.type(screen.getByLabelText("Title"), "Campaign idea");
    await user.click(within(createPanel).getByRole("button", { name: /Idea/ }));
    await user.click(within(createPanel).getByRole("button", { name: /Mixed/ }));
    await user.type(
      screen.getByLabelText("Starting thought"),
      "This should become the first draft.",
    );
    await user.click(within(createPanel).getByRole("button", { name: "Create entry" }));

    await waitFor(() => {
      expect(screen.getAllByText("Campaign idea").length).toBeGreaterThan(0);
    });
    const createCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/api/entries") && init?.method === "POST",
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      title: "Campaign idea",
      purpose: "idea",
      mode: "mixed",
    });
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith("/api/entries/entry-2/document") &&
          init?.method === "PUT",
      ),
    ).toBe(true);
  });

  it("renames the selected entry inline", async () => {
    const renamedEntry = { ...entry, title: "Renamed thoughts" };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/entries") && !init?.method) {
        return Promise.resolve(jsonResponse({ entries: [entry], groups }));
      }
      if (url.endsWith("/api/entries/entry-1") && init?.method === "PATCH") {
        return Promise.resolve(jsonResponse({ entry: renamedEntry }));
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return Promise.resolve(jsonResponse({ document: null }));
      }
      if (url.endsWith("/api/entries/entry-1/messages")) {
        return Promise.resolve(jsonResponse({ messages: [] }));
      }
      if (url.endsWith("/api/entries/entry-1/grafts")) {
        return Promise.resolve(jsonResponse({ grafts: [] }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<JournalWorkspace />);

    await user.click(await screen.findByRole("button", { name: "Morning thoughts" }));
    const titleInput = screen.getByLabelText("Entry title");
    await user.clear(titleInput);
    await user.type(titleInput, "Renamed thoughts");
    await user.click(screen.getByRole("button", { name: "Save title" }));

    await waitFor(() => {
      expect(screen.getAllByText("Renamed thoughts").length).toBeGreaterThan(0);
    });
    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/api/entries/entry-1") && init?.method === "PATCH",
    );
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      title: "Renamed thoughts",
    });
  });

  it("saves a note linked to the selected entry", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/entries") && !init?.method) {
        return Promise.resolve(jsonResponse({ entries: [entry], groups }));
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return Promise.resolve(jsonResponse({ document: null }));
      }
      if (url.endsWith("/api/entries/entry-1/messages")) {
        return Promise.resolve(jsonResponse({ messages: [] }));
      }
      if (url.endsWith("/api/entries/entry-1/grafts")) {
        return Promise.resolve(jsonResponse({ grafts: [] }));
      }
      if (url.endsWith("/api/notes") && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            {
              note: {
                id: "note-1",
                ownerId: entry.ownerId,
                ownerKind: entry.ownerKind,
                title: "Keep this",
                body: "This is worth remembering.",
                entryId: entry.id,
                sourceType: "entry-selection",
                sourceMessageId: null,
                sourceReflectionId: null,
                sourceReflectionCardId: null,
                color: "amber",
                pinned: true,
                createdAt: entry.createdAt,
                updatedAt: entry.updatedAt,
              },
            },
            { status: 201 },
          ),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<JournalWorkspace />);

    await user.click(await screen.findByRole("button", { name: "Save note" }));
    const notePanel = screen.getByLabelText("Save note");
    await user.type(within(notePanel).getByLabelText("Title"), "Keep this");
    await user.type(
      within(notePanel).getByLabelText("What do you want to remember?"),
      "This is worth remembering.",
    );
    await user.click(within(notePanel).getByLabelText("Pin this note"));
    await user.click(within(notePanel).getByRole("button", { name: "Save note" }));

    await waitFor(() => {
      const noteCall = fetchMock.mock.calls.find(
        ([url, init]) => String(url).endsWith("/api/notes") && init?.method === "POST",
      );
      expect(noteCall).toBeTruthy();
      expect(JSON.parse(String(noteCall?.[1]?.body))).toMatchObject({
        title: "Keep this",
        body: "This is worth remembering.",
        color: "amber",
        pinned: true,
        entryId: entry.id,
        sourceType: "entry-selection",
      });
    });
  });

  it("shows sidebar utility shortcuts", async () => {
    mockFetch((url) => {
      if (url.endsWith("/api/entries")) {
        return jsonResponse({ entries: [entry], groups });
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return jsonResponse({ document: null });
      }
      if (url.endsWith("/api/entries/entry-1/messages")) {
        return jsonResponse({ messages: [] });
      }
      if (url.endsWith("/api/entries/entry-1/grafts")) {
        return jsonResponse({ grafts: [] });
      }
      return jsonResponse({});
    });

    render(<JournalWorkspace />);

    expect(await screen.findByRole("button", { name: "Notes" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Calendar" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Settings" })).toBeVisible();
  });
});
