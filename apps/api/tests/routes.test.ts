import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { agent, getAgentForSession, openaiCreate } = vi.hoisted(() => ({
  agent: {
    invoke: vi.fn(),
    getActiveNodes: vi.fn(),
    getGraphSnapshot: vi.fn(),
    getHistory: vi.fn(),
    recall: vi.fn(),
    getGraftRegistry: vi.fn(),
    absorbFromAgent: vi.fn(),
    removeGraft: vi.fn(),
    clearSession: vi.fn(),
  },
  getAgentForSession: vi.fn(),
  openaiCreate: vi.fn(),
}));

vi.mock("../src/lib/agent.js", () => ({
  getAgentForSession,
}));

vi.mock("../src/lib/openai.js", () => ({
  openai: {
    chat: {
      completions: {
        create: openaiCreate,
      },
    },
  },
}));

import { createApp } from "../src/app.js";

const createdAt = new Date("2026-06-01T10:00:00.000Z");

function topicNode(id = "topic-1") {
  return {
    id,
    sessionId: "mindbloom-session-2026-06-01",
    segmentId: "segment-1",
    label: "Work pressure",
    summary: "The user kept returning to pressure at work.",
    embedding: [],
    messageRange: [0, 2] as [number, number],
    topicOrder: 1,
    driftScore: 0.4,
    agentColor: null,
    fleetId: null,
    agentId: null,
    createdAt,
  };
}

function memoryNode() {
  return {
    id: "memory-1",
    segmentId: "segment-1",
    topicNodeId: "topic-1",
    agentId: null,
    sessionId: "mindbloom-session-2026-06-01",
    memoryType: "fact" as const,
    sourceType: "conversation" as const,
    subject: "user",
    predicate: "feels",
    value: "pressure at work",
    confidence: 0.9,
    embedding: [],
    sourceUrl: null,
    sourceTitle: null,
    supersededBy: null,
    decayed: false,
    agentColor: null,
    fleetId: null,
    createdAt,
  };
}

function graphSnapshot(sessionId = "mindbloom-session-2026-06-01") {
  return {
    sessionId,
    nodes: [topicNode()],
    snapshotNodes: [
      {
        node: topicNode(),
        graftOrigin: {
          sourceSessionId: "mindbloom-session-2026-05-31",
          sourceNodeId: "source-topic",
          graftedAt: createdAt,
        },
      },
    ],
    edges: [
      {
        srcId: "topic-1",
        dstId: "topic-2",
        weight: 0.7,
        type: "semantic",
      },
    ],
    memories: [memoryNode()],
    memoryEdges: [],
    capturedAt: createdAt.toISOString(),
  };
}

describe("MindBloom API routes", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    getAgentForSession.mockResolvedValue(agent);
    agent.invoke.mockResolvedValue("That sounds like a lot to carry.");
    agent.getActiveNodes.mockResolvedValue([topicNode()]);
    agent.getGraphSnapshot.mockResolvedValue(graphSnapshot());
    agent.getHistory.mockReturnValue([
      { role: "user", content: "Work pressure keeps following me home." },
    ]);
    agent.recall.mockResolvedValue({
      facts: [{ ...memoryNode(), similarity: 0.82 }],
      nodes: [topicNode()],
      systemPrompt: "memory context",
      tokenCount: 42,
    });
    agent.getGraftRegistry.mockResolvedValue([]);
    agent.absorbFromAgent.mockResolvedValue([topicNode()]);
    agent.removeGraft.mockResolvedValue(undefined);
    agent.clearSession.mockResolvedValue(undefined);
    openaiCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              mood: "A busy mind asking for room",
              moodArc: "The session moved from pressure toward recognition.",
              archetype: "The Thoughtful Load Bearer",
              archetypeCaption: "You noticed what work kept asking of you.",
              sessionSong: "A steady indie track with a softer final chorus.",
              wordOfDay: "pressure",
              wordOfDayCopy: "It kept showing up at the edge of everything.",
              recurringThread: "Work followed you into spaces meant for rest.",
              shareableTagline: "I noticed what I was carrying.",
            }),
          },
        },
      ],
    });
  });

  it("returns health and today's deterministic session", async () => {
    await request(app).get("/health").expect(200, {
      ok: true,
      service: "mindbloom-api",
      version: "0.1.0",
    });

    const response = await request(app).get("/api/session/today").expect(200);
    expect(response.body.sessionId).toMatch(/^mindbloom-session-\d{4}-\d{2}-\d{2}$/);
  });

  it("validates chat and invokes before reading active nodes", async () => {
    await request(app).post("/api/chat").send({ message: "hello" }).expect(400);
    await request(app)
      .post("/api/chat")
      .send({ sessionId: "mindbloom-session-2026-06-01", message: "   " })
      .expect(400);

    const response = await request(app)
      .post("/api/chat")
      .send({
        sessionId: "mindbloom-session-2026-06-01",
        message: "Work is still on my mind.",
      })
      .expect(200);

    expect(response.body.reply).toBe("That sounds like a lot to carry.");
    expect(response.body.topicPills).toEqual([
      { id: "topic-1", label: "Work pressure", topicOrder: 1 },
    ]);
    expect(agent.invoke).toHaveBeenCalledBefore(agent.getActiveNodes);
  });

  it("normalizes snapshots including graft provenance", async () => {
    await request(app).get("/api/snapshot").expect(400);

    const response = await request(app)
      .get("/api/snapshot")
      .query({ sessionId: "mindbloom-session-2026-06-01" })
      .expect(200);

    expect(response.body.nodes[0].createdAt).toBe(createdAt.toISOString());
    expect(response.body.nodes[0].graftOrigin.sourceSessionId).toBe(
      "mindbloom-session-2026-05-31",
    );
    expect(response.body.nodes[0]).toMatchObject({
      kind: "brought-in-context",
      kindLabel: "Brought-in context",
      helperText: "A previous thought you chose to bring into this entry.",
    });
    expect(response.body.nodes[0].graftOrigin.sourceLabel).toBe(
      "an entry from 2026-05-31",
    );
    expect(response.body.edges[0]).toEqual({
      sourceId: "topic-1",
      targetId: "topic-2",
      type: "semantic",
      connectionLabel: "Related thought",
      helperText: "These themes appear to be talking about similar ideas.",
      weight: 0.7,
    });
  });

  it("validates recall options and returns normalized recall data", async () => {
    await request(app)
      .get("/api/recall")
      .query({ sessionId: "mindbloom-session-2026-06-01" })
      .expect(400);
    await request(app)
      .get("/api/recall")
      .query({
        sessionId: "mindbloom-session-2026-06-01",
        q: "work",
        minSimilarity: 2,
      })
      .expect(400);

    const response = await request(app)
      .get("/api/recall")
      .query({
        sessionId: "mindbloom-session-2026-06-01",
        q: "work",
      })
      .expect(200);

    expect(response.body.tokenCount).toBe(42);
    expect(response.body.facts[0].similarity).toBe(0.82);
  });

  it("returns fallback Bloom insights when OpenAI JSON is invalid", async () => {
    openaiCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "not json" } }],
    });

    const response = await request(app)
      .post("/api/bloom")
      .send({ sessionId: "mindbloom-session-2026-06-01" })
      .expect(200);

    expect(response.body.insights.mood).toBe("Something real happened here");
    expect(agent.invoke).not.toHaveBeenCalled();
  });

  it("does not leak internal provider or database errors", async () => {
    agent.invoke.mockRejectedValueOnce(
      new Error("OPENAI_API_KEY=secret DATABASE_URL=postgres://secret"),
    );

    const response = await request(app)
      .post("/api/chat")
      .send({
        sessionId: "mindbloom-session-2026-06-01",
        message: "hello",
      })
      .expect(500);

    expect(response.body.error.message).toBe(
      "Something went wrong inside MindBloom API.",
    );
    expect(JSON.stringify(response.body)).not.toContain("secret");
  });

  it("grafts selected sessions without invoking or clearing daily sessions", async () => {
    const reflectionSnapshot = graphSnapshot("mindbloom-reflection-2026-23");
    agent.getGraphSnapshot.mockResolvedValue(reflectionSnapshot);
    agent.getGraftRegistry
      .mockResolvedValueOnce([
        {
          id: "registry-old",
          sessionId: "mindbloom-reflection-2026-23",
          nodeId: "old-node",
          sourceSessionId: "mindbloom-session-2026-05-30",
          sourceNodeId: "source-old",
          graftedAt: createdAt,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "registry-new",
          sessionId: "mindbloom-reflection-2026-23",
          nodeId: "topic-1",
          sourceSessionId: "mindbloom-session-2026-06-01",
          sourceNodeId: "source-topic",
          graftedAt: createdAt,
        },
      ]);
    openaiCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              recurringThemes: ["Work pressure"],
              resurfacingTopics: ["Rest"],
              emotionalShifts: "Pressure became easier to name.",
              questionsForNextWeek: ["What belongs outside work hours?"],
              weeklyTagline: "I noticed the weight before it became the week.",
            }),
          },
        },
      ],
    });

    await request(app)
      .post("/api/reflect")
      .send({ sourceSessionIds: [] })
      .expect(400);

    const response = await request(app)
      .post("/api/reflect")
      .send({
        sourceSessionIds: ["mindbloom-session-2026-06-01"],
        reflectionSessionId: "mindbloom-reflection-2026-23",
      })
      .expect(200);

    expect(agent.removeGraft).toHaveBeenCalledWith("old-node");
    expect(agent.absorbFromAgent).toHaveBeenCalled();
    expect(agent.invoke).not.toHaveBeenCalled();
    expect(agent.clearSession).not.toHaveBeenCalled();
    expect(response.body.graftedSources[0].sourceSessionId).toBe(
      "mindbloom-session-2026-06-01",
    );
  });
});
