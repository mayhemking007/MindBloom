import { render, screen, waitFor } from "@testing-library/react";
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
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<JournalWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText("Morning thoughts")).toHaveLength(2);
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
});
