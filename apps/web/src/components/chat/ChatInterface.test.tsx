import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useChatMock, useBloomMock } = vi.hoisted(() => ({
  useChatMock: vi.fn(),
  useBloomMock: vi.fn(),
}));

vi.mock("../../hooks/useChat", () => ({
  useChat: useChatMock,
}));

vi.mock("../../hooks/useBloom", () => ({
  useBloom: useBloomMock,
}));

vi.mock("../bloom/BloomOverlay", () => ({
  BloomOverlay: () => null,
}));

import { ChatInterface } from "./ChatInterface";

function chatState(userMessageCount: number) {
  return {
    error: null,
    loadingSession: false,
    messages: [],
    sendMessage: vi.fn(),
    sending: false,
    sessionId: "mindbloom-session-2026-06-01",
    topicPills: [],
    userMessageCount,
  };
}

describe("ChatInterface Bloom threshold", () => {
  beforeEach(() => {
    useBloomMock.mockReturnValue({
      bloomData: null,
      error: null,
      generateBloom: vi.fn(),
      loading: false,
    });
  });

  it("hides Bloom CTA before five user messages", () => {
    useChatMock.mockReturnValue(chatState(4));
    render(<ChatInterface />);
    expect(screen.queryByText("Bloom My Mind")).not.toBeInTheDocument();
  });

  it("shows Bloom CTA at five user messages", () => {
    useChatMock.mockReturnValue(chatState(5));
    render(<ChatInterface />);
    expect(screen.getByText("Bloom My Mind")).toBeInTheDocument();
  });
});
