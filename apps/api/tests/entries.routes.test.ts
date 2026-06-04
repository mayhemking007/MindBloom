import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

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
    entryStore.clear();
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
});
