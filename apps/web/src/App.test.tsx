import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./theme/ThemeContext";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
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

describe("App", () => {
  it("waits for auth before restoring a journal entry map from the URL", async () => {
    const authResponse = deferred<Response>();
    const firstEntry = {
      id: "entry-1",
      ownerId: "user-1",
      ownerKind: "authenticated",
      title: "Latest thoughts",
      tags: ["journal"],
      status: "draft",
      memoSessionId: "mindbloom-entry-entry-1",
      createdAt: "2026-06-04T09:00:00.000Z",
      updatedAt: "2026-06-04T09:00:00.000Z",
      completedAt: null,
      allowFutureContext: true,
    };
    const secondEntry = {
      ...firstEntry,
      id: "entry-2",
      title: "Older thoughts",
      memoSessionId: "mindbloom-entry-entry-2",
      createdAt: "2026-06-03T09:00:00.000Z",
      updatedAt: "2026-06-03T09:00:00.000Z",
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) {
        return authResponse.promise;
      }
      if (url.endsWith("/api/entries")) {
        return Promise.resolve(
          jsonResponse({
            entries: [firstEntry, secondEntry],
            groups: [
              {
                date: "2026-06-04",
                entries: [firstEntry, secondEntry],
              },
            ],
          }),
        );
      }
      if (url.endsWith("/api/entries/entry-1/document")) {
        return Promise.resolve(
          jsonResponse({
            document: {
              id: "doc-1",
              entryId: firstEntry.id,
              content: "The latest entry should not win the refresh race.",
              version: 1,
              lastIngestedVersion: 1,
              createdAt: firstEntry.createdAt,
              updatedAt: firstEntry.updatedAt,
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
              content: "The entry from the refreshed URL.",
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
                content: "Bloom history from the refreshed URL.",
                createdAt: secondEntry.createdAt,
              },
            ],
          }),
        );
      }
      if (url.includes("/api/entries/entry-2/snapshot")) {
        return Promise.resolve(
          jsonResponse({
            sessionId: "mindbloom-entry-entry-2",
            nodes: [
              {
                id: "theme-restored-map",
                sessionId: "mindbloom-entry-entry-2",
                segmentId: "segment-1",
                label: "Authenticated restored map",
                summary: "The map from the refreshed URL.",
                messageRange: [0, 1],
                topicOrder: 1,
                driftScore: 0.2,
                agentColor: null,
                fleetId: null,
                agentId: null,
                createdAt: secondEntry.createdAt,
              },
            ],
            edges: [],
            memories: [],
            memoryEdges: [],
            capturedAt: secondEntry.createdAt,
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
    window.history.pushState(null, "", "/?entryId=entry-2&view=map");

    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>,
    );

    expect(screen.getByText("Preparing MindBloom...")).toBeVisible();
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/api/entries")),
    ).toBe(false);

    authResponse.resolve(
      jsonResponse({
        user: {
          id: "user-1",
          email: "writer@mindbloom.local",
          displayName: "Writer",
          createdAt: "2026-06-04T08:00:00.000Z",
        },
        ownerKind: "authenticated",
      }),
    );

    expect(await screen.findByText("Authenticated restored map")).toBeVisible();
    expect(screen.queryByLabelText("Bloom assistant")).not.toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("The latest entry should not win the refresh race."),
    ).not.toBeInTheDocument();
    expect(window.location.search).toBe("?entryId=entry-2&view=map");

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/entries")),
      ).toHaveLength(1);
    });
  });
});
