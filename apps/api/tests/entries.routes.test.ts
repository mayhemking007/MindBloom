import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { agent, getAgentForSession, openaiCreate } = vi.hoisted(() => ({
  agent: {
    ingestText: vi.fn(),
    graftByRelevance: vi.fn(),
    ingestGraftedNodes: vi.fn(),
    getActiveNodes: vi.fn(),
    getGraphSnapshot: vi.fn(),
    invoke: vi.fn(),
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
import { entryStore } from "../src/lib/entryStore.js";

const app = createApp();

const ownerAHeaders = {
  "x-mindbloom-owner-kind": "authenticated",
  "x-mindbloom-owner-id": "user-a",
};

const ownerBHeaders = {
  "x-mindbloom-owner-kind": "authenticated",
  "x-mindbloom-owner-id": "user-b",
};

const createdAt = new Date("2026-06-04T08:00:00.000Z");

function graphSnapshot() {
  return {
    sessionId: "mindbloom-entry-entry-1",
    nodes: [
      {
        id: "theme-1",
        sessionId: "mindbloom-entry-entry-1",
        segmentId: "segment-1",
        label: "Creative direction",
        summary: "The user kept circling creative direction.",
        embedding: [],
        messageRange: [0, 1] as [number, number],
        topicOrder: 1,
        driftScore: 0.2,
        agentColor: null,
        fleetId: null,
        agentId: null,
        createdAt,
      },
    ],
    snapshotNodes: [],
    edges: [],
    memories: [],
    memoryEdges: [],
    capturedAt: createdAt.toISOString(),
  };
}

describe("entry routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entryStore.clear();
    getAgentForSession.mockResolvedValue(agent);
    agent.ingestText.mockResolvedValue(undefined);
    agent.graftByRelevance.mockResolvedValue({
      systemPrompt: "memory context",
      nodes: [
        {
          id: "source-theme-1",
          label: "Setting better boundaries",
          topicOrder: 1,
        },
      ],
      tokenCount: 42,
    });
    agent.ingestGraftedNodes.mockResolvedValue([]);
    agent.getActiveNodes.mockResolvedValue([
      {
        id: "theme-1",
        label: "Creative direction",
        topicOrder: 1,
      },
    ]);
    agent.getGraphSnapshot.mockResolvedValue(graphSnapshot());
    agent.invoke.mockResolvedValue("This should not be used for reflection.");
    openaiCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              mood: "You noticed the shape of the idea.",
              takeaways: [
                "You wanted the idea to feel easier to begin.",
                "You returned to creative direction.",
              ],
              quote: "This product idea is about making journaling easier.",
              song: "A bright synth-pop demo with a patient chorus.",
              weather: "Morning light after a long cloudy stretch.",
              word: "direction",
              question: "What would make this easier to start tomorrow?",
            }),
          },
        },
      ],
    });
  });

  it("limits demo mode to one temporary entry", async () => {
    const first = await request(app)
      .post("/api/entries")
      .send({ purpose: "journal", mode: "classic" })
      .expect(201);

    expect(first.body.entry.ownerKind).toBe("demo");
    expect(first.body.entry.ownerId).toBe("demo-local");

    await request(app)
      .post("/api/entries")
      .send({ purpose: "idea", mode: "classic" })
      .expect(403);
  });

  it("creates and lists authenticated entries grouped by day", async () => {
    const first = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({
        title: "Morning thoughts",
        purpose: "journal",
        mode: "classic",
      })
      .expect(201);
    const second = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({
        title: "Product idea",
        purpose: "idea",
        mode: "mixed",
        allowFutureContext: false,
      })
      .expect(201);

    expect(first.body.entry.memoSessionId).toMatch(/^mindbloom-entry-/);
    expect(second.body.entry.allowFutureContext).toBe(false);

    const response = await request(app)
      .get("/api/entries")
      .set(ownerAHeaders)
      .expect(200);

    expect(response.body.entries).toHaveLength(2);
    expect(response.body.groups).toHaveLength(1);
    expect(response.body.groups[0].entries).toHaveLength(2);
  });

  it("updates, completes, reads, and deletes an owned entry", async () => {
    const created = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({ purpose: "brainstorm", mode: "chat" })
      .expect(201);
    const entryId = created.body.entry.id;

    const updated = await request(app)
      .patch(`/api/entries/${entryId}`)
      .set(ownerAHeaders)
      .send({
        title: "Launch thoughts",
        mode: "mixed",
        status: "completed",
      })
      .expect(200);

    expect(updated.body.entry.title).toBe("Launch thoughts");
    expect(updated.body.entry.completedAt).toEqual(expect.any(String));

    const fetched = await request(app)
      .get(`/api/entries/${entryId}`)
      .set(ownerAHeaders)
      .expect(200);

    expect(fetched.body.entry.id).toBe(entryId);

    await request(app)
      .delete(`/api/entries/${entryId}`)
      .set(ownerAHeaders)
      .expect(204);
    await request(app)
      .get(`/api/entries/${entryId}`)
      .set(ownerAHeaders)
      .expect(404);
  });

  it("protects entries from other owner scopes", async () => {
    const created = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({ purpose: "journal", mode: "classic" })
      .expect(201);

    await request(app)
      .get(`/api/entries/${created.body.entry.id}`)
      .set(ownerBHeaders)
      .expect(403);
  });

  it("stores document drafts without creating messages or ingestion", async () => {
    const created = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({ purpose: "journal", mode: "classic" })
      .expect(201);
    const entryId = created.body.entry.id;

    const firstDraft = await request(app)
      .put(`/api/entries/${entryId}/document`)
      .set(ownerAHeaders)
      .send({ content: "First draft" })
      .expect(200);
    const secondDraft = await request(app)
      .put(`/api/entries/${entryId}/document`)
      .set(ownerAHeaders)
      .send({ content: "Second draft" })
      .expect(200);

    expect(firstDraft.body.document.version).toBe(1);
    expect(secondDraft.body.document.version).toBe(2);
    expect(secondDraft.body.document.lastIngestedVersion).toBeNull();

    const fetched = await request(app)
      .get(`/api/entries/${entryId}/document`)
      .set(ownerAHeaders)
      .expect(200);

    expect(fetched.body.document.content).toBe("Second draft");
  });

  it("stores and lists entry messages", async () => {
    const created = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({ purpose: "journal", mode: "chat" })
      .expect(201);
    const entryId = created.body.entry.id;

    await request(app)
      .post(`/api/entries/${entryId}/messages`)
      .set(ownerAHeaders)
      .send({ role: "user", content: "I am thinking about this." })
      .expect(201);
    await request(app)
      .post(`/api/entries/${entryId}/messages`)
      .set(ownerAHeaders)
      .send({ role: "assistant", content: "Let's stay with that thought." })
      .expect(201);

    const response = await request(app)
      .get(`/api/entries/${entryId}/messages`)
      .set(ownerAHeaders)
      .expect(200);

    expect(response.body.messages.map((message: { role: string }) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
  });

  it("validates owner headers and entry bodies", async () => {
    await request(app)
      .post("/api/entries")
      .set("x-mindbloom-owner-kind", "authenticated")
      .send({ purpose: "journal", mode: "classic" })
      .expect(400);

    await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({ purpose: "unknown", mode: "classic" })
      .expect(400);
  });

  it("ingests classic document text through the entry memo-grafter session", async () => {
    const created = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({
        title: "Idea sketch",
        purpose: "idea",
        mode: "classic",
      })
      .expect(201);
    const entryId = created.body.entry.id;

    const response = await request(app)
      .post(`/api/entries/${entryId}/ingest`)
      .set(ownerAHeaders)
      .send({
        content: "This product idea is about making journaling feel easier.",
      })
      .expect(200);

    expect(getAgentForSession).toHaveBeenCalledWith(
      created.body.entry.memoSessionId,
    );
    expect(agent.ingestText).toHaveBeenCalledWith(
      "This product idea is about making journaling feel easier.",
      {
        label: "Idea sketch",
        source: `entry:${entryId}`,
        replace: true,
      },
    );
    expect(response.body.ingested).toBe(true);
    expect(response.body.document.lastIngestedVersion).toBe(
      response.body.document.version,
    );
    expect(response.body.topicPills).toEqual([
      { id: "theme-1", label: "Creative direction", topicOrder: 1 },
    ]);
  });

  it("skips missing, empty, and unchanged document ingestion gracefully", async () => {
    const created = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({ purpose: "journal", mode: "classic" })
      .expect(201);
    const entryId = created.body.entry.id;

    const missing = await request(app)
      .post(`/api/entries/${entryId}/ingest`)
      .set(ownerAHeaders)
      .send({})
      .expect(200);
    expect(missing.body.skippedReason).toBe("no-document");

    const empty = await request(app)
      .post(`/api/entries/${entryId}/ingest`)
      .set(ownerAHeaders)
      .send({ content: "tiny" })
      .expect(200);
    expect(empty.body.skippedReason).toBe("empty-document");

    await request(app)
      .post(`/api/entries/${entryId}/ingest`)
      .set(ownerAHeaders)
      .send({ content: "This longer draft has enough substance to ingest." })
      .expect(200);
    const unchanged = await request(app)
      .post(`/api/entries/${entryId}/ingest`)
      .set(ownerAHeaders)
      .send({})
      .expect(200);

    expect(unchanged.body.skippedReason).toBe("unchanged-document");
    expect(agent.ingestText).toHaveBeenCalledTimes(1);
  });

  it("protects ingestion from other owner scopes", async () => {
    const created = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({ purpose: "journal", mode: "classic" })
      .expect(201);

    await request(app)
      .post(`/api/entries/${created.body.entry.id}/ingest`)
      .set(ownerBHeaders)
      .send({ content: "This should not ingest for another owner." })
      .expect(403);
  });

  it("brings in previous themes by relevance from owned source entries", async () => {
    const source = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({
        title: "Earlier boundary note",
        purpose: "journal",
        mode: "classic",
      })
      .expect(201);
    const target = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({
        title: "Current entry",
        purpose: "journal",
        mode: "classic",
      })
      .expect(201);

    const response = await request(app)
      .post(`/api/entries/${target.body.entry.id}/grafts/relevance`)
      .set(ownerAHeaders)
      .send({
        query: "setting boundaries",
        sourceEntryIds: [source.body.entry.id],
        maxThemes: 3,
        minSimilarity: 0.62,
        expansionDepth: 1,
        expansionStrategy: "graph",
      })
      .expect(200);

    expect(agent.graftByRelevance).toHaveBeenCalledWith("setting boundaries", {
      topK: 3,
      minSimilarity: 0.62,
      hopDepth: 1,
      expansionStrategy: "graph",
    });
    expect(agent.ingestGraftedNodes).toHaveBeenCalledWith([
      {
        id: "source-theme-1",
        label: "Setting better boundaries",
        topicOrder: 1,
      },
    ]);
    expect(response.body.grafts[0]).toMatchObject({
      entryId: target.body.entry.id,
      query: "setting boundaries",
      sourceEntryId: source.body.entry.id,
      sourceEntryTitle: "Earlier boundary note",
      themeLabel: "Setting better boundaries",
    });
    expect(response.body.topicPills).toEqual([
      { id: "theme-1", label: "Creative direction", topicOrder: 1 },
    ]);
  });

  it("lists brought-in context and rejects source entries from another owner", async () => {
    const target = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({ purpose: "journal", mode: "classic" })
      .expect(201);
    const forbiddenSource = await request(app)
      .post("/api/entries")
      .set(ownerBHeaders)
      .send({ purpose: "journal", mode: "classic" })
      .expect(201);

    await request(app)
      .post(`/api/entries/${target.body.entry.id}/grafts/relevance`)
      .set(ownerAHeaders)
      .send({
        query: "private thought",
        sourceEntryIds: [forbiddenSource.body.entry.id],
      })
      .expect(403);

    const source = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({ title: "Owned source", purpose: "journal", mode: "classic" })
      .expect(201);
    await request(app)
      .post(`/api/entries/${target.body.entry.id}/grafts/relevance`)
      .set(ownerAHeaders)
      .send({
        query: "owned thought",
        sourceEntryIds: [source.body.entry.id],
      })
      .expect(200);

    const response = await request(app)
      .get(`/api/entries/${target.body.entry.id}/grafts`)
      .set(ownerAHeaders)
      .expect(200);

    expect(response.body.grafts).toHaveLength(1);
    expect(response.body.grafts[0].themeLabel).toBe("Setting better boundaries");
  });

  it("validates relevance graft queries", async () => {
    const target = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({ purpose: "journal", mode: "classic" })
      .expect(201);

    await request(app)
      .post(`/api/entries/${target.body.entry.id}/grafts/relevance`)
      .set(ownerAHeaders)
      .send({ query: " " })
      .expect(400);
  });

  it("creates entry reflection cards without invoking the memo-grafter agent", async () => {
    const created = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({
        title: "Idea sketch",
        purpose: "idea",
        mode: "mixed",
      })
      .expect(201);
    const entryId = created.body.entry.id;

    await request(app)
      .put(`/api/entries/${entryId}/document`)
      .set(ownerAHeaders)
      .send({
        content: "This product idea is about making journaling easier.",
      })
      .expect(200);
    await request(app)
      .post(`/api/entries/${entryId}/messages`)
      .set(ownerAHeaders)
      .send({ role: "user", content: "I want it to feel simple." })
      .expect(201);
    await request(app)
      .post("/api/notes")
      .set(ownerAHeaders)
      .send({
        entryId,
        sourceType: "entry-selection",
        body: "Make the first step feel light.",
      })
      .expect(201);

    const response = await request(app)
      .post(`/api/entries/${entryId}/reflections`)
      .set(ownerAHeaders)
      .send({})
      .expect(201);

    expect(agent.getGraphSnapshot).toHaveBeenCalled();
    expect(agent.getActiveNodes).toHaveBeenCalled();
    expect(agent.invoke).not.toHaveBeenCalled();
    expect(openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("This product idea is about making journaling easier."),
          }),
          expect.objectContaining({
            content: expect.stringContaining("Make the first step feel light."),
          }),
        ]),
      }),
    );
    expect(response.body.reflection.cards).toHaveLength(9);
    expect(response.body.reflection.cards[0]).toMatchObject({
      type: "stats",
      title: "Words You Put Down",
    });
    expect(response.body.reflection.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "takeaways",
          body: expect.stringContaining("You wanted"),
        }),
        expect.objectContaining({
          type: "mind-map",
          metadata: expect.objectContaining({
            themeLabels: ["Creative direction"],
          }),
        }),
      ]),
    );
    expect(response.body.reflection.graphSnapshot.nodes[0]).toMatchObject({
      label: "Creative direction",
      kindLabel: "Theme",
    });

    const listResponse = await request(app)
      .get(`/api/entries/${entryId}/reflections`)
      .set(ownerAHeaders)
      .expect(200);
    expect(listResponse.body.reflections).toHaveLength(1);

    await request(app)
      .get(`/api/entries/${entryId}/reflections/${response.body.reflection.id}`)
      .set(ownerAHeaders)
      .expect(200);
  });

  it("protects entry reflections from other owner scopes", async () => {
    const created = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({ purpose: "journal", mode: "classic" })
      .expect(201);
    const other = await request(app)
      .post("/api/entries")
      .set(ownerBHeaders)
      .send({ purpose: "journal", mode: "classic" })
      .expect(201);

    const reflection = await request(app)
      .post(`/api/entries/${created.body.entry.id}/reflections`)
      .set(ownerAHeaders)
      .send({})
      .expect(201);

    await request(app)
      .post(`/api/entries/${created.body.entry.id}/reflections`)
      .set(ownerBHeaders)
      .send({})
      .expect(403);
    await request(app)
      .get(
        `/api/entries/${other.body.entry.id}/reflections/${reflection.body.reflection.id}`,
      )
      .set(ownerBHeaders)
      .expect(403);
  });
});
