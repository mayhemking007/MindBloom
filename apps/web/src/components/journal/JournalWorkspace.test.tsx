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
  tags: ["journal"],
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

function streamResponse(events: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(event));
        }
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    },
  );
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function openBloom(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Open Bloom assistant" }));
  return screen.findByLabelText("Ask Bloom");
}

function snapshotWithTheme(label: string, capturedAt: string) {
  return jsonResponse({
    sessionId: "mindbloom-entry-entry-1",
    nodes: [
      {
        id: `theme-${label.toLowerCase().replace(/\s+/g, "-")}`,
        sessionId: "mindbloom-entry-entry-1",
        segmentId: "segment-1",
        label,
        summary: `A summary of ${label}.`,
        messageRange: [0, 1],
        topicOrder: 1,
        driftScore: 0.2,
        agentColor: null,
        fleetId: null,
        agentId: null,
        createdAt: capturedAt,
      },
    ],
    edges: [],
    memories: [],
    memoryEdges: [],
    capturedAt,
  });
}

function snapshotResponse() {
  return jsonResponse({
    sessionId: "mindbloom-entry-entry-1",
    nodes: [],
    edges: [],
    memories: [],
    memoryEdges: [],
    capturedAt: "2026-06-04T08:00:00.000Z",
  });
}

function mockFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
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
    window.history.pushState(null, "", "/");
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
        return Promise.resolve(
          jsonResponse({
            document: {
              entryId: entry.id,
              content: "This is worth remembering. Keep going.",
              version: 1,
              savedAt: entry.createdAt,
              lastIngestedVersion: null,
            },
          }),
        );
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

  it("switches entries into read-only mode without blocking reading tools", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/entries") && !init?.method) {
        return Promise.resolve(jsonResponse({ entries: [entry], groups }));
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return Promise.resolve(
          jsonResponse({
            document: {
              id: "doc-1",
              entryId: entry.id,
              content: "This is worth remembering. Keep going.",
              version: 1,
              lastIngestedVersion: 1,
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt,
            },
          }),
        );
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
                title: "Read later",
                body: "This is worth remembering.",
                entryId: entry.id,
                sourceType: "entry-selection",
                sourceMessageId: null,
                sourceReflectionId: null,
                sourceReflectionCardId: null,
                sourceSelectionStart: 0,
                sourceSelectionEnd: 26,
                sourceExcerpt: "This is worth remembering.",
                sourcePath: "document",
                color: "amber",
                pinned: false,
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

    const editor = await screen.findByLabelText("Journal entry");
    await waitFor(() => {
      expect(editor).toHaveValue("This is worth remembering. Keep going.");
    });
    await user.click(screen.getByRole("button", { name: "Switch to read-only mode" }));

    expect(screen.getByText("Reading")).toBeVisible();
    expect(screen.getByRole("button", { name: "Switch to edit mode" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rename entry title" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save note" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Open Bloom assistant" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Map" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reflect" })).toBeEnabled();
    expect(editor).toHaveAttribute("readonly");

    await user.type(editor, " A new accidental sentence.");
    expect(editor).toHaveValue("This is worth remembering. Keep going.");

    (editor as HTMLTextAreaElement).setSelectionRange(0, 26);
    editor.dispatchEvent(new Event("select", { bubbles: true }));
    await user.click(screen.getByRole("button", { name: "Save note" }));
    const notePanel = screen.getByLabelText("Save note");
    expect(
      within(notePanel).getAllByText("This is worth remembering.").length,
    ).toBeGreaterThanOrEqual(2);
    await user.type(within(notePanel).getByLabelText("Title"), "Read later");
    await user.click(within(notePanel).getByRole("button", { name: "Save note" }));

    await waitFor(() => {
      const noteCall = fetchMock.mock.calls.find(
        ([url, init]) => String(url).endsWith("/api/notes") && init?.method === "POST",
      );
      expect(noteCall).toBeTruthy();
      expect(JSON.parse(String(noteCall?.[1]?.body))).toMatchObject({
        title: "Read later",
        body: "This is worth remembering.",
        entryId: entry.id,
        sourceType: "entry-selection",
        sourceSelectionStart: 0,
        sourceSelectionEnd: 26,
        sourceExcerpt: "This is worth remembering.",
      });
    });
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith("/api/entries/entry-1/document") &&
          init?.method === "PUT",
      ),
    ).toBe(false);
  });

  it("renders the document before Bloom history and ingestion finish", async () => {
    const messageResponse = deferred<Response>();
    const ingestResponse = deferred<Response>();
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);
        if (url.endsWith("/api/entries")) {
          return Promise.resolve(jsonResponse({ entries: [entry], groups }));
        }
        if (url.endsWith("/api/entries/entry-1/document")) {
          return Promise.resolve(
            jsonResponse({
              document: {
                id: "doc-1",
                entryId: entry.id,
                content: "Writing should appear before memory work finishes.",
                version: 2,
                lastIngestedVersion: 1,
                createdAt: entry.createdAt,
                updatedAt: entry.updatedAt,
              },
            }),
          );
        }
        if (url.endsWith("/api/entries/entry-1/messages")) {
          return messageResponse.promise;
        }
        if (url.endsWith("/api/entries/entry-1/ingest")) {
          expect(JSON.parse(String(init?.body))).toEqual({});
          return ingestResponse.promise;
        }
        return Promise.resolve(jsonResponse({}));
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<JournalWorkspace />);

    expect(
      await screen.findByDisplayValue(
        "Writing should appear before memory work finishes.",
      ),
    ).toBeVisible();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith("/api/entries/entry-1/ingest"),
      ),
    ).toBe(true);

    messageResponse.resolve(jsonResponse({ messages: [] }));
    ingestResponse.resolve(
      jsonResponse({
        document: {
          id: "doc-1",
          entryId: entry.id,
          content: "Writing should appear before memory work finishes.",
          version: 2,
          lastIngestedVersion: 2,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        },
        ingested: true,
        topicPills: [],
      }),
    );
  });

  it("ignores a slow document response after switching entries", async () => {
    const secondEntry = {
      ...entry,
      id: "entry-2",
      title: "Evening thoughts",
      memoSessionId: "mindbloom-entry-entry-2",
    } satisfies JournalEntry;
    const firstDocumentResponse = deferred<Response>();

    mockFetch((url) => {
      if (url.endsWith("/api/entries")) {
        return jsonResponse({
          entries: [entry, secondEntry],
          groups: [{ date: "2026-06-04", entries: [entry, secondEntry] }],
        });
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return firstDocumentResponse.promise;
      }
      if (url.endsWith("/api/entries/entry-2/document")) {
        return jsonResponse({
          document: {
            id: "doc-2",
            entryId: secondEntry.id,
            content: "The current evening entry.",
            version: 1,
            lastIngestedVersion: 1,
            createdAt: secondEntry.createdAt,
            updatedAt: secondEntry.updatedAt,
          },
        });
      }
      if (url.includes("/messages")) {
        return jsonResponse({ messages: [] });
      }
      return jsonResponse({});
    });
    const user = userEvent.setup();

    render(<JournalWorkspace />);
    await user.click(
      await screen.findByRole("button", { name: "Open entry Evening thoughts" }),
    );

    expect(
      await screen.findByDisplayValue("The current evening entry."),
    ).toBeVisible();

    firstDocumentResponse.resolve(
      jsonResponse({
        document: {
          id: "doc-1",
          entryId: entry.id,
          content: "A late morning response that must be ignored.",
          version: 1,
          lastIngestedVersion: 1,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        },
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByDisplayValue("A late morning response that must be ignored."),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("The current evening entry.")).toBeVisible();
    expect(window.location.search).toBe("?entryId=entry-2");
  });

  it("restores the entry from the URL after loading the workspace", async () => {
    const secondEntry = {
      ...entry,
      id: "entry-2",
      title: "Evening thoughts",
      memoSessionId: "mindbloom-entry-entry-2",
    } satisfies JournalEntry;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/entries")) {
        return Promise.resolve(
          jsonResponse({
            entries: [entry, secondEntry],
            groups: [{ date: "2026-06-04", entries: [entry, secondEntry] }],
          }),
        );
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return Promise.resolve(
          jsonResponse({
            document: {
              id: "doc-1",
              entryId: entry.id,
              content: "The latest entry should not replace the deep link.",
              version: 1,
              lastIngestedVersion: 1,
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt,
            },
          }),
        );
      }
      if (url.endsWith("/api/entries/entry-2/document")) {
        return Promise.resolve(
          jsonResponse({
            document: {
              id: "doc-2",
              entryId: secondEntry.id,
              content: "The restored older entry.",
              version: 1,
              lastIngestedVersion: 1,
              createdAt: secondEntry.createdAt,
              updatedAt: secondEntry.updatedAt,
            },
          }),
        );
      }
      if (url.endsWith("/api/entries/entry-2/messages")) {
        return Promise.resolve(
          jsonResponse({
            messages: [
              {
                id: "message-2",
                entryId: secondEntry.id,
                role: "assistant",
                content: "History for the restored entry.",
                createdAt: secondEntry.createdAt,
              },
            ],
          }),
        );
      }
      if (url.includes("/messages")) {
        return Promise.resolve(jsonResponse({ messages: [] }));
      }
      if (url.includes("/grafts")) {
        return Promise.resolve(jsonResponse({ grafts: [] }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState(
      null,
      "",
      "/?entryId=entry-2&sourceSelectionStart=4&sourceSelectionEnd=10",
    );

    const user = userEvent.setup();
    render(<JournalWorkspace />);

    expect(await screen.findByDisplayValue("The restored older entry.")).toBeVisible();
    await openBloom(user);
    expect(await screen.findByText("History for the restored entry.")).toBeVisible();
    expect(
      screen.queryByDisplayValue("The latest entry should not replace the deep link."),
    ).not.toBeInTheDocument();
    expect(window.location.search).toBe(
      "?entryId=entry-2&sourceSelectionStart=4&sourceSelectionEnd=10",
    );
  });

  it("falls back gracefully when the URL entry no longer exists", async () => {
    mockFetch((url) => {
      if (url.endsWith("/api/entries")) {
        return jsonResponse({ entries: [entry], groups });
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return jsonResponse({
          document: {
            id: "doc-1",
            entryId: entry.id,
            content: "The available entry after a stale deep link.",
            version: 1,
            lastIngestedVersion: 1,
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
    window.history.pushState(null, "", "/?entryId=missing-entry");

    render(<JournalWorkspace />);

    expect(
      await screen.findByDisplayValue("The available entry after a stale deep link."),
    ).toBeVisible();
    expect(window.location.search).toBe("?entryId=entry-1");
  });

  it("restores the map view from the URL after loading the workspace", async () => {
    const secondEntry = {
      ...entry,
      id: "entry-2",
      title: "Evening thoughts",
      memoSessionId: "mindbloom-entry-entry-2",
    } satisfies JournalEntry;
    mockFetch((url) => {
      if (url.endsWith("/api/entries")) {
        return jsonResponse({
          entries: [entry, secondEntry],
          groups: [{ date: "2026-06-04", entries: [entry, secondEntry] }],
        });
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return jsonResponse({ document: null });
      }
      if (url.endsWith("/api/entries/entry-2/document")) {
        return jsonResponse({
          document: {
            id: "doc-2",
            entryId: secondEntry.id,
            content: "The document behind the map.",
            version: 1,
            lastIngestedVersion: 1,
            createdAt: secondEntry.createdAt,
            updatedAt: secondEntry.updatedAt,
          },
        });
      }
      if (url.includes("/api/entries/entry-2/snapshot")) {
        return snapshotWithTheme("Restored map theme", "2026-06-04T08:05:00.000Z");
      }
      if (url.includes("/api/entries/entry-1/snapshot")) {
        return snapshotResponse();
      }
      if (url.includes("/messages")) {
        return jsonResponse({ messages: [] });
      }
      if (url.includes("/grafts")) {
        return jsonResponse({ grafts: [] });
      }
      return jsonResponse({});
    });
    window.history.pushState(null, "", "/?entryId=entry-2&view=map");

    render(<JournalWorkspace />);

    expect(await screen.findByText("Restored map theme")).toBeVisible();
    expect(screen.queryByLabelText("Bloom assistant")).not.toBeInTheDocument();
    expect(window.location.search).toBe("?entryId=entry-2&view=map");
  });

  it("streams Bloom messages with Enter and stores the assistant reply", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/entries") && init?.method !== "POST") {
        return Promise.resolve(jsonResponse({ entries: [entry], groups }));
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return Promise.resolve(
          jsonResponse({
            document: {
              entryId: entry.id,
              content: "This is worth remembering. Keep going.",
              version: 1,
              savedAt: entry.createdAt,
              lastIngestedVersion: null,
            },
          }),
        );
      }
      if (url.endsWith("/api/entries/entry-1/messages") && !init?.method) {
        return Promise.resolve(jsonResponse({ messages: [] }));
      }
      if (url.endsWith("/api/entries/entry-1/grafts")) {
        return Promise.resolve(jsonResponse({ grafts: [] }));
      }
      if (url.endsWith("/api/entries/entry-1/messages/stream")) {
        return Promise.resolve(
          streamResponse([
            `event: user-message\ndata: ${JSON.stringify({
              message: {
                id: "user-message",
                entryId: entry.id,
                role: "user",
                content: "Help me continue",
                createdAt: "2026-06-04T08:01:00.000Z",
              },
            })}\n\n`,
            `event: token\ndata: ${JSON.stringify({ chunk: "You are circling " })}\n\n`,
            `event: token\ndata: ${JSON.stringify({ chunk: "a useful starting point." })}\n\n`,
            `event: done\ndata: ${JSON.stringify({
              message: {
                id: "assistant-message",
                entryId: entry.id,
                role: "assistant",
                content: "You are circling a useful starting point.",
                createdAt: "2026-06-04T08:01:01.000Z",
              },
              topicPills: [
                {
                  id: "theme-1",
                  label: "Writing momentum",
                  topicOrder: 1,
                },
              ],
            })}\n\n`,
          ]),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<JournalWorkspace />);

    const bloomInput = await openBloom(user);
    await user.type(bloomInput, "Help me continue{Enter}");

    await waitFor(() => {
      expect(screen.getByText("You are circling a useful starting point.")).toBeVisible();
    });
    expect(screen.queryByText("Writing momentum")).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith("/api/entries/entry-1/messages/stream"),
      ),
    ).toBe(true);
  });

  it("shows retry UI after a failed Bloom stream", async () => {
    let streamAttempts = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/entries") && init?.method !== "POST") {
        return Promise.resolve(jsonResponse({ entries: [entry], groups }));
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return Promise.resolve(
          jsonResponse({
            document: {
              entryId: entry.id,
              content: "This is worth remembering. Keep going.",
              version: 1,
              savedAt: entry.createdAt,
              lastIngestedVersion: null,
            },
          }),
        );
      }
      if (url.endsWith("/api/entries/entry-1/messages") && !init?.method) {
        return Promise.resolve(jsonResponse({ messages: [] }));
      }
      if (url.endsWith("/api/entries/entry-1/grafts")) {
        return Promise.resolve(jsonResponse({ grafts: [] }));
      }
      if (url.endsWith("/api/entries/entry-1/messages/stream")) {
        streamAttempts += 1;
        if (streamAttempts === 1) {
          return Promise.resolve(
            streamResponse([
              `event: user-message\ndata: ${JSON.stringify({
                message: {
                  id: "user-message",
                  entryId: entry.id,
                  role: "user",
                  content: "Help me continue",
                  createdAt: "2026-06-04T08:01:00.000Z",
                },
              })}\n\n`,
              `event: token\ndata: ${JSON.stringify({ chunk: "A partial thought" })}\n\n`,
              `event: error\ndata: ${JSON.stringify({ message: "Bloom could not respond right now." })}\n\n`,
            ]),
          );
        }

        return Promise.resolve(
          streamResponse([
            `event: user-message\ndata: ${JSON.stringify({
              message: {
                id: "retry-user-message",
                entryId: entry.id,
                role: "user",
                content: "Help me continue",
                createdAt: "2026-06-04T08:02:00.000Z",
              },
            })}\n\n`,
            `event: done\ndata: ${JSON.stringify({
              message: {
                id: "retry-assistant-message",
                entryId: entry.id,
                role: "assistant",
                content: "Try beginning with the smallest true sentence.",
                createdAt: "2026-06-04T08:02:01.000Z",
              },
              topicPills: [],
            })}\n\n`,
          ]),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<JournalWorkspace />);

    const bloomInput = await openBloom(user);
    await user.type(bloomInput, "Help me continue{Enter}");
    await user.click(await screen.findByRole("button", { name: "Retry Bloom response" }));

    expect(
      await screen.findByText("Try beginning with the smallest true sentence."),
    ).toBeVisible();
    expect(streamAttempts).toBe(2);
  });

  it("keeps current themes out of the Bloom sidebar after saving", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/entries") && init?.method !== "POST") {
        return Promise.resolve(jsonResponse({ entries: [entry], groups }));
      }
      if (url.includes("/api/entries/entry-1/snapshot")) {
        return Promise.resolve(
          jsonResponse({
            sessionId: "mindbloom-entry-entry-1",
            nodes: [
              {
                id: "theme-1",
                label: "Old writing theme",
                topicOrder: 1,
                kind: "theme",
                lastSeenAt: entry.createdAt,
                createdAt: entry.createdAt,
                updatedAt: entry.createdAt,
              },
            ],
            edges: [],
            memories: [],
            memoryEdges: [],
            capturedAt: entry.createdAt,
          }),
        );
      }
      if (url.endsWith("/api/entries/entry-1/document") && init?.method === "PUT") {
        return Promise.resolve(
          jsonResponse({
            document: {
              entryId: entry.id,
              content: "",
              version: 2,
              savedAt: entry.createdAt,
              lastIngestedVersion: 2,
            },
          }),
        );
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return Promise.resolve(
          jsonResponse({
            document: {
              entryId: entry.id,
              content: "This product idea is taking shape.",
              version: 1,
              savedAt: entry.createdAt,
              lastIngestedVersion: 1,
            },
          }),
        );
      }
      if (url.endsWith("/api/entries/entry-1/ingest")) {
        return Promise.resolve(
          jsonResponse({
            document: {
              entryId: entry.id,
              content: "",
              version: 2,
              savedAt: entry.createdAt,
              lastIngestedVersion: 2,
            },
            ingested: false,
            cleared: true,
            skippedReason: "empty-document",
            topicPills: [],
          }),
        );
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

    expect(await openBloom(user)).toBeVisible();
    expect(screen.queryByText("Old writing theme")).not.toBeInTheDocument();
    const editor = await screen.findByLabelText("Journal entry");
    await user.clear(editor);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.queryByText("Old writing theme")).not.toBeInTheDocument();
    });
    expect(await screen.findByText(/Add a little more writing/)).toBeVisible();
  });

  it("keeps brought-in context controls out of the Bloom sidebar", async () => {
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
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<JournalWorkspace />);

    expect(await openBloom(user)).toBeVisible();
    expect(screen.queryByText("Brought-in context")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Bring in a previous theme")).not.toBeInTheDocument();
    const graftCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/api/entries/entry-1/grafts/relevance"),
    );
    expect(graftCall).toBeUndefined();
  });

  it("creates an entry from optional and custom tags", async () => {
    const createdEntry = {
      ...entry,
      id: "entry-2",
      title: "Campaign idea",
      tags: ["idea", "campaign"],
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
    await user.click(within(createPanel).getByRole("button", { name: /idea/i }));
    await user.type(within(createPanel).getByLabelText("Custom tag"), "campaign");
    await user.click(within(createPanel).getByRole("button", { name: "Add" }));
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
      tags: ["idea", "campaign"],
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
      if (url.includes("/api/entries/entry-1/snapshot")) {
        return Promise.resolve(snapshotResponse());
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

    await user.click(await screen.findByRole("button", { name: "Rename entry title" }));
    const titleInput = screen.getByLabelText("Journal title");
    await user.clear(titleInput);
    await user.type(titleInput, "Renamed thoughts");
    await user.click(screen.getByLabelText("Journal entry"));

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

  it("opens entry rename from the sidebar action menu and closes the menu outside", async () => {
    mockFetch((url) => {
      if (url.endsWith("/api/entries")) {
        return jsonResponse({ entries: [entry], groups });
      }
      if (url.includes("/api/entries/entry-1/snapshot")) {
        return snapshotResponse();
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
    const user = userEvent.setup();

    render(<JournalWorkspace />);

    await user.click(
      await screen.findByRole("button", {
        name: "Entry actions for Morning thoughts",
      }),
    );
    expect(screen.getByRole("button", { name: "Rename Morning thoughts" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Pin Morning thoughts" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete Morning thoughts" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Pin Morning thoughts" }));
    expect(screen.getByRole("button", { name: "Delete Morning thoughts" })).toBeVisible();

    await user.click(screen.getByLabelText("Journal entry"));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Delete Morning thoughts" }),
      ).not.toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", {
        name: "Entry actions for Morning thoughts",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Rename Morning thoughts" }));
    expect(screen.getByLabelText("Rename entry Morning thoughts")).toHaveValue(
      "Morning thoughts",
    );
  });

  it("saves a note linked to the selected entry", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/entries") && !init?.method) {
        return Promise.resolve(jsonResponse({ entries: [entry], groups }));
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return Promise.resolve(
          jsonResponse({
            document: {
              entryId: entry.id,
              content: "This is worth remembering. Keep going.",
              version: 1,
              savedAt: entry.createdAt,
              lastIngestedVersion: null,
            },
          }),
        );
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
                sourceSelectionStart: 0,
                sourceSelectionEnd: 26,
                sourceExcerpt: "This is worth remembering.",
                sourcePath: "document",
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

    const editor = await screen.findByLabelText("Journal entry");
    await waitFor(() => {
      expect(editor).toHaveValue("This is worth remembering. Keep going.");
    });
    (editor as HTMLTextAreaElement).setSelectionRange(0, 26);
    editor.dispatchEvent(new Event("select", { bubbles: true }));
    await user.click(await screen.findByRole("button", { name: "Save note" }));
    const notePanel = screen.getByLabelText("Save note");
    expect(
      within(notePanel).getAllByText("This is worth remembering.").length,
    ).toBeGreaterThanOrEqual(2);
    await user.type(within(notePanel).getByLabelText("Title"), "Keep this");
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
        sourceSelectionStart: 0,
        sourceSelectionEnd: 26,
        sourceExcerpt: "This is worth remembering.",
        sourcePath: "document",
      });
    });
    expect(await screen.findByText("Note saved.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Open note" })).toBeVisible();
  });

  it("shows demo entry-limit errors inside the create-entry modal", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/entries") && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            { error: { message: "Demo mode supports one journal entry" } },
            { status: 403 },
          ),
        );
      }
      if (url.endsWith("/api/entries") && !init?.method) {
        return Promise.resolve(jsonResponse({ entries: [entry], groups }));
      }
      if (url.includes("/api/entries/entry-1/snapshot")) {
        return Promise.resolve(snapshotResponse());
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

    await user.click(await screen.findByRole("button", { name: "New Entry" }));
    const createPanel = screen.getByLabelText("Create journal entry");
    await user.click(within(createPanel).getByRole("button", { name: "Create entry" }));

    expect(
      await within(createPanel).findByText("Demo mode supports one journal entry"),
    ).toBeVisible();
    expect(within(createPanel).getByRole("button", { name: "Create account" })).toBeVisible();
    expect(within(createPanel).getByRole("button", { name: "Login" })).toBeVisible();
  });

  it("deletes the selected entry after confirmation", async () => {
    let deleted = false;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/entries") && !init?.method) {
        return Promise.resolve(
          jsonResponse({
            entries: deleted ? [] : [entry],
            groups: deleted ? [] : groups,
          }),
        );
      }
      if (url.endsWith("/api/entries/entry-1") && init?.method === "DELETE") {
        deleted = true;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.includes("/api/entries/entry-1/snapshot")) {
        return Promise.resolve(snapshotResponse());
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

    await user.click(
      await screen.findByRole("button", {
        name: "Entry actions for Morning thoughts",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Delete Morning thoughts" }));
    const deletePanel = screen.getByLabelText("Delete entry");
    expect(within(deletePanel).getByText(/Morning thoughts/)).toBeVisible();
    await user.click(within(deletePanel).getByRole("button", { name: "Delete entry" }));

    await waitFor(() => {
      expect(deleted).toBe(true);
    });
    expect(fetchMock.mock.calls.some(([url, init]) =>
      String(url).endsWith("/api/entries/entry-1") && init?.method === "DELETE",
    )).toBe(true);
    expect(await screen.findByText("Entry deleted.")).toBeVisible();
    expect(window.location.search).toBe("");
  });

  it("loads the selected entry map from the journal view toggle", async () => {
    const secondEntry = {
      ...entry,
      id: "entry-2",
      title: "Evening thoughts",
      memoSessionId: "mindbloom-entry-entry-2",
    } satisfies JournalEntry;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/entries")) {
        return Promise.resolve(
          jsonResponse({
            entries: [entry, secondEntry],
            groups: [{ date: "2026-06-04", entries: [entry, secondEntry] }],
          }),
        );
      }
      if (url.includes("/api/entries/entry-2/snapshot")) {
        return Promise.resolve(
          jsonResponse({
            sessionId: "mindbloom-entry-entry-2",
            nodes: [
              {
                id: "second-theme",
                sessionId: "mindbloom-entry-entry-2",
                label: "Evening theme",
                summary: "A map theme from the second entry.",
                messageRange: [0, 1],
                topicOrder: 1,
                driftScore: 0.2,
                agentColor: null,
                fleetId: null,
                agentId: null,
                createdAt: "2026-06-04T08:05:00.000Z",
              },
            ],
            edges: [],
            memories: [],
            memoryEdges: [],
            capturedAt: "2026-06-04T08:05:00.000Z",
          }),
        );
      }
      if (url.includes("/api/entries/entry-1/snapshot")) {
        return Promise.resolve(snapshotResponse());
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
      if (url.endsWith("/reflections")) {
        return Promise.resolve(jsonResponse({ reflections: [] }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<JournalWorkspace />);

    expect(await screen.findByRole("button", { name: "Editor" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Map" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reflect" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Calendar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Bloom assistant" })).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Open entry Evening thoughts" }),
    );
    await user.click(screen.getByRole("button", { name: "Map" }));

    expect(await screen.findByText("Evening theme")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Open Bloom assistant" })).not.toBeInTheDocument();
    expect(window.location.search).toBe("?entryId=entry-2&view=map");
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("/api/entries/entry-2/snapshot?scope=overall"),
      ),
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: "Reflect" }));
    expect(screen.queryByRole("button", { name: "Open Bloom assistant" })).not.toBeInTheDocument();
    expect(window.location.search).toBe("?entryId=entry-2&view=reflect");

    await user.click(screen.getByRole("button", { name: "Editor" }));
    expect(
      await screen.findByRole("button", { name: "Open Bloom assistant" }),
    ).toBeInTheDocument();
    expect(window.location.search).toBe("?entryId=entry-2");
  });

  it("keeps the last graph visible while refreshing in the background", async () => {
    const initialSnapshot = deferred<Response>();
    const refreshedSnapshot = deferred<Response>();
    let snapshotRequests = 0;
    mockFetch((url) => {
      if (url.endsWith("/api/entries")) {
        return jsonResponse({ entries: [entry], groups });
      }
      if (url.includes("/api/entries/entry-1/snapshot")) {
        snapshotRequests += 1;
        if (snapshotRequests === 1) {
          return initialSnapshot.promise;
        }
        if (snapshotRequests === 2) {
          return refreshedSnapshot.promise;
        }
        return jsonResponse({ message: "Refresh failed" }, { status: 500 });
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
    const user = userEvent.setup();

    render(<JournalWorkspace />);
    await user.click(await screen.findByRole("button", { name: "Map" }));

    expect(screen.getByText("Loading this entry map...")).toBeVisible();
    initialSnapshot.resolve(
      snapshotWithTheme("Original graph", "2026-06-04T08:00:00.000Z"),
    );
    expect(await screen.findByText("Original graph")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Refresh map" }));
    expect(screen.getByText("Original graph")).toBeVisible();
    expect(screen.queryByText("Loading this entry map...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refreshing" })).toBeDisabled();

    refreshedSnapshot.resolve(
      snapshotWithTheme("Updated graph", "2026-06-04T08:05:00.000Z"),
    );
    expect(await screen.findByText("Updated graph")).toBeVisible();
    expect(screen.queryByText("Original graph")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh map" }));
    expect(
      await screen.findByText(
        "The map could not refresh. Showing the previous version.",
      ),
    ).toBeVisible();
    expect(screen.getByText("Updated graph")).toBeVisible();
  });

  it("shows a cached entry map when switching back while refreshing", async () => {
    const secondEntry = {
      ...entry,
      id: "entry-2",
      title: "Evening thoughts",
      memoSessionId: "mindbloom-entry-entry-2",
    } satisfies JournalEntry;
    const firstRefresh = deferred<Response>();
    let firstSnapshotRequests = 0;
    mockFetch((url) => {
      if (url.endsWith("/api/entries")) {
        return jsonResponse({
          entries: [entry, secondEntry],
          groups: [{ date: "2026-06-04", entries: [entry, secondEntry] }],
        });
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return jsonResponse({ document: null });
      }
      if (url.endsWith("/api/entries/entry-2/document")) {
        return jsonResponse({ document: null });
      }
      if (url.includes("/api/entries/entry-1/snapshot")) {
        firstSnapshotRequests += 1;
        if (firstSnapshotRequests === 1) {
          return snapshotWithTheme("Morning cached graph", "2026-06-04T08:00:00.000Z");
        }
        return firstRefresh.promise;
      }
      if (url.includes("/api/entries/entry-2/snapshot")) {
        return snapshotWithTheme("Evening graph", "2026-06-04T09:00:00.000Z");
      }
      if (url.includes("/messages")) {
        return jsonResponse({ messages: [] });
      }
      if (url.includes("/grafts")) {
        return jsonResponse({ grafts: [] });
      }
      return jsonResponse({});
    });
    const user = userEvent.setup();

    render(<JournalWorkspace />);
    await user.click(await screen.findByRole("button", { name: "Map" }));
    expect(await screen.findByText("Morning cached graph")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Open entry Evening thoughts" }));
    expect(await screen.findByText("Evening graph")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Open entry Morning thoughts" }));
    expect(screen.getByText("Morning cached graph")).toBeVisible();
    expect(screen.queryByText("Loading this entry map...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refreshing" })).toBeDisabled();

    firstRefresh.resolve(
      snapshotWithTheme("Morning refreshed graph", "2026-06-04T10:00:00.000Z"),
    );
    expect(await screen.findByText("Morning refreshed graph")).toBeVisible();
  });

  it("waits for background ingestion before loading the map snapshot", async () => {
    const ingestionResponse = deferred<Response>();
    let snapshotRequests = 0;
    const fetchMock = vi.fn(
      (input: RequestInfo | URL): Response | Promise<Response> => {
        const url = String(input);
        if (url.endsWith("/api/entries")) {
          return jsonResponse({ entries: [entry], groups });
        }
        if (url.endsWith("/api/entries/entry-1/document")) {
          return jsonResponse({
            document: {
              id: "doc-1",
              entryId: entry.id,
              content: "A newly saved entry that still needs its map.",
              version: 2,
              lastIngestedVersion: 1,
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt,
            },
          });
        }
        if (url.endsWith("/api/entries/entry-1/messages")) {
          return jsonResponse({ messages: [] });
        }
        if (url.endsWith("/api/entries/entry-1/ingest")) {
          return ingestionResponse.promise;
        }
        if (url.includes("/api/entries/entry-1/snapshot")) {
          snapshotRequests += 1;
          return snapshotWithTheme("Mapped after ingestion", "2026-06-04T08:05:00.000Z");
        }
        return jsonResponse({});
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<JournalWorkspace />);
    expect(
      await screen.findByDisplayValue(
        "A newly saved entry that still needs its map.",
      ),
    ).toBeVisible();
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).endsWith("/api/entries/entry-1/ingest"),
        ),
      ).toBe(true);
    });

    await user.click(screen.getByRole("button", { name: "Map" }));
    expect(screen.getByText("Loading this entry map...")).toBeVisible();
    expect(snapshotRequests).toBe(0);

    ingestionResponse.resolve(
      jsonResponse({
        document: {
          id: "doc-1",
          entryId: entry.id,
          content: "A newly saved entry that still needs its map.",
          version: 2,
          lastIngestedVersion: 2,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        },
        ingested: true,
        topicPills: [],
      }),
    );

    expect(await screen.findByText("Mapped after ingestion")).toBeVisible();
    expect(snapshotRequests).toBe(1);
  });

  it("reloads persisted writing when switching back to an entry", async () => {
    const secondEntry = {
      ...entry,
      id: "entry-2",
      title: "Evening thoughts",
      memoSessionId: "mindbloom-entry-entry-2",
    } satisfies JournalEntry;
    mockFetch((url) => {
      if (url.endsWith("/api/entries")) {
        return jsonResponse({
          entries: [entry, secondEntry],
          groups: [{ date: "2026-06-04", entries: [entry, secondEntry] }],
        });
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return jsonResponse({
          document: {
            id: "doc-1",
            entryId: entry.id,
            content: "Persisted morning writing about music and learning.",
            version: 2,
            lastIngestedVersion: 2,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          },
        });
      }
      if (url.endsWith("/api/entries/entry-2/document")) {
        return jsonResponse({
          document: {
            id: "doc-2",
            entryId: secondEntry.id,
            content: "Persisted evening writing about rest and planning.",
            version: 1,
            lastIngestedVersion: 1,
            createdAt: secondEntry.createdAt,
            updatedAt: secondEntry.updatedAt,
          },
        });
      }
      if (url.includes("/api/entries/entry-1/snapshot")) {
        return jsonResponse({
          sessionId: "mindbloom-entry-entry-1",
          nodes: [
            {
              id: "morning-theme",
              sessionId: "mindbloom-entry-entry-1",
              label: "Music and learning",
              summary: "The first entry theme.",
              topicOrder: 1,
            },
          ],
          edges: [],
          memories: [],
          memoryEdges: [],
          capturedAt: "2026-06-04T08:00:00.000Z",
        });
      }
      if (url.includes("/api/entries/entry-2/snapshot")) {
        return jsonResponse({
          sessionId: "mindbloom-entry-entry-2",
          nodes: [
            {
              id: "evening-theme",
              sessionId: "mindbloom-entry-entry-2",
              label: "Rest and planning",
              summary: "The second entry theme.",
              topicOrder: 1,
            },
          ],
          edges: [],
          memories: [],
          memoryEdges: [],
          capturedAt: "2026-06-04T08:05:00.000Z",
        });
      }
      if (url.includes("/messages")) {
        return jsonResponse({ messages: [] });
      }
      if (url.includes("/grafts")) {
        return jsonResponse({ grafts: [] });
      }
      return jsonResponse({});
    });
    const user = userEvent.setup();

    render(<JournalWorkspace />);

    expect(
      await screen.findByDisplayValue(
        "Persisted morning writing about music and learning.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Music and learning")).not.toBeInTheDocument();

    await user.click(screen.getByText("Evening thoughts"));

    expect(
      await screen.findByDisplayValue(
        "Persisted evening writing about rest and planning.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Rest and planning")).not.toBeInTheDocument();

    await user.click(screen.getByText("Morning thoughts"));

    expect(
      await screen.findByDisplayValue(
        "Persisted morning writing about music and learning.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Music and learning")).not.toBeInTheDocument();
  });
});
