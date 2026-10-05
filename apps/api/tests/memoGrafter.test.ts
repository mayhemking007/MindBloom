import { beforeEach, describe, expect, it, vi } from "vitest";

const { agentCreate, coreCreate, agent, core } = vi.hoisted(() => {
  const agent = {
    getSessionId: vi.fn(),
    close: vi.fn(),
  };
  const core = {
    close: vi.fn(),
  };
  return {
    agent,
    core,
    agentCreate: vi.fn(),
    coreCreate: vi.fn(),
  };
});

vi.mock("memo-grafter", () => ({
  MemoGrafter: { create: coreCreate },
  MemoGrafterAgent: { create: agentCreate },
  OpenAIEmbedAdapter: vi.fn(),
}));

describe("MindBloom MemoGrafter boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agent.getSessionId.mockReturnValue("entry-session-1");
    agent.close.mockResolvedValue(undefined);
    core.close.mockResolvedValue(undefined);
    agentCreate.mockResolvedValue(agent);
    coreCreate.mockResolvedValue(core);
  });

  it("binds a cached agent to the requested application session", async () => {
    const { getMemoGrafterForSession, shutdownMemoGrafters } = await import(
      "../src/memo-grafter/memoGrafter.js"
    );

    const first = await getMemoGrafterForSession("entry-session-1");
    const second = await getMemoGrafterForSession("entry-session-1");

    expect(first).toBe(agent);
    expect(second).toBe(agent);
    expect(agentCreate).toHaveBeenCalledTimes(1);
    expect(agentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "entry-session-1",
        ingestion: {
          concurrency: {
            extraction: 2,
            embedding: 4,
          },
        },
      }),
    );

    await shutdownMemoGrafters();
  });

  it("drains the shared core during graceful shutdown", async () => {
    const { getMemoGrafterCore, shutdownMemoGrafters } = await import(
      "../src/memo-grafter/memoGrafter.js"
    );

    await getMemoGrafterCore();
    await shutdownMemoGrafters();

    expect(core.close).toHaveBeenCalledWith({
      drain: true,
      timeoutMs: 10_000,
    });
  });
});
