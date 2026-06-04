import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { agent, getAgentForSession } = vi.hoisted(() => ({
  agent: {
    ingestText: vi.fn(),
    getActiveNodes: vi.fn(),
  },
  getAgentForSession: vi.fn(),
}));

vi.mock("../src/lib/agent.js", () => ({
  getAgentForSession,
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

describe("entry routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entryStore.clear();
    getAgentForSession.mockResolvedValue(agent);
    agent.ingestText.mockResolvedValue(undefined);
    agent.getActiveNodes.mockResolvedValue([
      {
        id: "theme-1",
        label: "Creative direction",
        topicOrder: 1,
      },
    ]);
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
});
