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

describe("note routes", () => {
  beforeEach(() => {
    entryStore.clear();
  });

  it("creates and lists blank notes grouped by day", async () => {
    const created = await request(app)
      .post("/api/notes")
      .set(ownerAHeaders)
      .send({
        title: "A thought to keep",
        body: "Remember that writing felt easier after starting small.",
        color: "blue",
        pinned: true,
      })
      .expect(201);

    expect(created.body.note).toMatchObject({
      title: "A thought to keep",
      body: "Remember that writing felt easier after starting small.",
      sourceType: "blank",
      pinned: true,
    });

    const response = await request(app)
      .get("/api/notes")
      .set(ownerAHeaders)
      .expect(200);

    expect(response.body.notes).toHaveLength(1);
    expect(response.body.groups).toHaveLength(1);
    expect(response.body.groups[0].notes[0].id).toBe(created.body.note.id);
  });

  it("creates notes linked to owned entries and rejects another owner's entry", async () => {
    const ownedEntry = await request(app)
      .post("/api/entries")
      .set(ownerAHeaders)
      .send({ purpose: "journal", mode: "classic" })
      .expect(201);
    const otherEntry = await request(app)
      .post("/api/entries")
      .set(ownerBHeaders)
      .send({ purpose: "journal", mode: "classic" })
      .expect(201);

    await request(app)
      .post("/api/notes")
      .set(ownerAHeaders)
      .send({
        entryId: otherEntry.body.entry.id,
        sourceType: "entry-selection",
        body: "This should not save.",
      })
      .expect(403);

    const linked = await request(app)
      .post("/api/notes")
      .set(ownerAHeaders)
      .send({
        entryId: ownedEntry.body.entry.id,
        sourceType: "entry-selection",
        body: "This came from my current journal entry.",
        sourceSelectionStart: 4,
        sourceSelectionEnd: 18,
        sourceExcerpt: "came from my",
        sourcePath: "document",
      })
      .expect(201);

    expect(linked.body.note.entryId).toBe(ownedEntry.body.entry.id);
    expect(linked.body.note.sourceType).toBe("entry-selection");
    expect(linked.body.note).toMatchObject({
      sourceSelectionStart: 4,
      sourceSelectionEnd: 18,
      sourceExcerpt: "came from my",
      sourcePath: "document",
    });
  });

  it("updates, reads, and deletes notes", async () => {
    const created = await request(app)
      .post("/api/notes")
      .set(ownerAHeaders)
      .send({ body: "Original note" })
      .expect(201);

    const updated = await request(app)
      .patch(`/api/notes/${created.body.note.id}`)
      .set(ownerAHeaders)
      .send({
        title: "Edited",
        body: "Edited note",
        color: "teal",
        pinned: true,
      })
      .expect(200);

    expect(updated.body.note).toMatchObject({
      title: "Edited",
      body: "Edited note",
      color: "teal",
      pinned: true,
    });

    await request(app)
      .get(`/api/notes/${created.body.note.id}`)
      .set(ownerAHeaders)
      .expect(200);
    await request(app)
      .delete(`/api/notes/${created.body.note.id}`)
      .set(ownerAHeaders)
      .expect(204);
    await request(app)
      .get(`/api/notes/${created.body.note.id}`)
      .set(ownerAHeaders)
      .expect(404);
  });

  it("validates note body and owner access", async () => {
    const created = await request(app)
      .post("/api/notes")
      .set(ownerAHeaders)
      .send({ body: "Private note" })
      .expect(201);

    await request(app)
      .post("/api/notes")
      .set(ownerAHeaders)
      .send({ body: " " })
      .expect(400);
    await request(app)
      .get(`/api/notes/${created.body.note.id}`)
      .set(ownerBHeaders)
      .expect(403);
  });
});
