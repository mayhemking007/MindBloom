import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "../auth/AuthContext";
import { AuthPage } from "./AuthPage";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("AuthPage", () => {
  it("signs in with the seeded local test user", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) {
        return Promise.resolve(jsonResponse({ user: null, ownerKind: "demo" }));
      }
      if (url.endsWith("/api/auth/login") && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({
            user: {
              id: "user-1",
              email: "writer@mindbloom.local",
              displayName: "writer",
              createdAt: "2026-06-04T08:00:00.000Z",
            },
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/" element={<p>Signed in home</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Signed in home")).toBeVisible();
    });
    const loginCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/api/auth/login"),
    );
    expect(JSON.parse(String(loginCall?.[1]?.body))).toEqual({
      email: "writer@mindbloom.local",
      password: "password123",
    });
    expect(loginCall?.[1]?.credentials).toBe("include");
  });
});
