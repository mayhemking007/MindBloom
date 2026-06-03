import { beforeEach, describe, expect, it } from "vitest";

import { loadStoredChat, saveStoredChat } from "./chatStorage";

describe("chatStorage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("restores valid chat messages", () => {
    saveStoredChat("session-1", {
      messages: [{ id: "1", role: "user", content: "hello" }],
      topicPills: [{ id: "topic-1", label: "Work", topicOrder: 1 }],
    });

    expect(loadStoredChat("session-1")?.messages[0]?.content).toBe("hello");
  });

  it("ignores malformed messages", () => {
    sessionStorage.setItem(
      "mindbloom:chat:session-1",
      JSON.stringify({
        messages: [{ id: "1", role: "invalid", content: "hello" }],
      }),
    );

    expect(loadStoredChat("session-1")?.messages).toEqual([]);
  });
});
