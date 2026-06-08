import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { CalendarPage } from "./CalendarPage";
import { SettingsPage } from "./SettingsPage";

const defaultSettings = {
  calendarEnabled: false,
  calendarMode: "gentle",
  streaksEnabled: false,
  updatedAt: "2026-06-08T08:00:00.000Z",
};

describe("settings and calendar pages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads and updates calendar settings", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/settings") && init?.method === "PATCH") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              settings: {
                ...defaultSettings,
                calendarEnabled: true,
                updatedAt: "2026-06-08T08:01:00.000Z",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ settings: defaultSettings }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<SettingsPage />);

    expect(await screen.findByText("Shape MindBloom around your rhythm")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Enable" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith("/api/settings") &&
            init?.method === "PATCH" &&
            JSON.parse(String(init.body)).calendarEnabled === true,
        ),
      ).toBe(true);
    });
  });

  it("shows a soft calendar disabled state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ settings: defaultSettings, days: [] }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Your calendar is tucked away")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("renders activity counts in the calendar", async () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
    const activityDate = `${currentYear}-${currentMonth}-08`;
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              settings: {
                ...defaultSettings,
                calendarEnabled: true,
              },
              days: [
                {
                  date: activityDate,
                  entryCount: 1,
                  noteCount: 2,
                  reflectionCount: 1,
                  moodLabel: "Calm and focused",
                  moodColor: "teal",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("4 saved")).toBeVisible();
    expect(screen.getByText("Calm and focused")).toBeVisible();
  });
});
