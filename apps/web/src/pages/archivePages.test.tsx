import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReflectPage } from "./ReflectPage";
import { NotesPage } from "./NotesPage";

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

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith("/api/notes/note-1") && init?.method === "DELETE",
        ),
      ).toBe(true);
    });
  });

  it("renders Reflection empty state when no sessions are available", () => {
    render(<ReflectPage />);
    expect(screen.getByText("A reflection needs a few days")).toBeVisible();
  });
});
