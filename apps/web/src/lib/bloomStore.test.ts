import { beforeEach, describe, expect, it, vi } from "vitest";

import { bloomFixture } from "../test/fixtures";
import { getSavedBlooms, saveBloom } from "./bloomStore";

describe("bloomStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads Blooms newest first", () => {
    vi.setSystemTime(new Date("2026-06-01T10:00:00.000Z"));
    saveBloom(bloomFixture("mindbloom-session-2026-06-01", "First mood"));
    vi.setSystemTime(new Date("2026-06-02T10:00:00.000Z"));
    saveBloom(bloomFixture("mindbloom-session-2026-06-02", "Second mood"));
    vi.useRealTimers();

    const blooms = getSavedBlooms();
    expect(blooms).toHaveLength(2);
    expect(blooms[0]?.sessionId).toBe("mindbloom-session-2026-06-02");
  });

  it("ignores corrupt and incomplete localStorage entries", () => {
    localStorage.setItem("mindbloom:blooms:bad-json", "{");
    localStorage.setItem(
      "mindbloom:blooms:incomplete",
      JSON.stringify({ sessionId: "mindbloom-session-2026-06-01" }),
    );

    expect(getSavedBlooms()).toEqual([]);
  });
});
