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

async function createReflection() {
  const entry = await request(app)
    .post("/api/entries")
    .set(ownerAHeaders)
    .send({ title: "Private entry", purpose: "journal", mode: "classic" })
    .expect(201);

  return entryStore.createReflection({
    entryId: entry.body.entry.id,
    graphSnapshot: null,
    cards: [
      {
        id: "mood",
        type: "mood",
        title: "Mood",
        body: "You noticed a softer mood.",
      },
      {
        id: "quote",
        type: "quote",
        title: "Private Quote",
        body: "A selected frozen quote.",
      },
      {
        id: "question",
        type: "question",
        title: "Question",
        body: "What comes next?",
      },
    ],
  });
}

describe("share routes", () => {
  beforeEach(() => {
    entryStore.clear();
  });

  it("creates a share link for selected reflection cards and returns public cards only", async () => {
    const reflection = await createReflection();

    const created = await request(app)
      .post(`/api/reflections/${reflection.id}/share-links`)
      .set(ownerAHeaders)
      .send({
        selectedCardIds: ["mood", "question"],
      })
      .expect(201);

    expect(created.body.shareLink.token).toEqual(expect.any(String));
    expect(created.body.shareLink.selectedCardIds).toEqual(["mood", "question"]);

    const listResponse = await request(app)
      .get(`/api/reflections/${reflection.id}/share-links`)
      .set(ownerAHeaders)
      .expect(200);
    expect(listResponse.body.shareLinks).toHaveLength(1);

    const publicResponse = await request(app)
      .get(`/api/share/${created.body.shareLink.token}`)
      .expect(200);

    expect(publicResponse.body.cards.map((card: { id: string }) => card.id)).toEqual([
      "mood",
      "question",
    ]);
    expect(JSON.stringify(publicResponse.body)).not.toContain("Private entry");
    expect(JSON.stringify(publicResponse.body)).not.toContain("ownerId");
  });

  it("rejects unknown and foreign reflection share requests", async () => {
    const reflection = await createReflection();

    await request(app)
      .post(`/api/reflections/${reflection.id}/share-links`)
      .set(ownerAHeaders)
      .send({ selectedCardIds: ["missing"] })
      .expect(400);

    await request(app)
      .post(`/api/reflections/${reflection.id}/share-links`)
      .set(ownerBHeaders)
      .send({ selectedCardIds: ["mood"] })
      .expect(403);

    await request(app)
      .post("/api/reflections/missing/share-links")
      .set(ownerAHeaders)
      .send({ selectedCardIds: ["mood"] })
      .expect(404);
  });

  it("requires sign in before creating share links", async () => {
    const demoEntry = await request(app)
      .post("/api/entries")
      .send({ title: "Demo entry", purpose: "journal", mode: "classic" })
      .expect(201);
    const reflection = entryStore.createReflection({
      entryId: demoEntry.body.entry.id,
      graphSnapshot: null,
      cards: [
        {
          id: "mood",
          type: "mood",
          title: "Mood",
          body: "A demo mood.",
        },
      ],
    });

    await request(app)
      .post(`/api/reflections/${reflection.id}/share-links`)
      .send({ selectedCardIds: ["mood"] })
      .expect(403);
  });

  it("revokes share links and prevents public access", async () => {
    const reflection = await createReflection();
    const created = await request(app)
      .post(`/api/reflections/${reflection.id}/share-links`)
      .set(ownerAHeaders)
      .send({ selectedCardIds: ["mood"] })
      .expect(201);

    await request(app)
      .delete(`/api/share-links/${created.body.shareLink.id}`)
      .set(ownerBHeaders)
      .expect(403);
    await request(app)
      .delete(`/api/share-links/${created.body.shareLink.id}`)
      .set(ownerAHeaders)
      .expect(204);
    await request(app)
      .get(`/api/share/${created.body.shareLink.token}`)
      .expect(404);
  });

  it("does not return expired public share links", async () => {
    const reflection = await createReflection();
    const created = await request(app)
      .post(`/api/reflections/${reflection.id}/share-links`)
      .set(ownerAHeaders)
      .send({
        selectedCardIds: ["mood"],
        expiresAt: "2020-01-01T00:00:00.000Z",
      })
      .expect(201);

    await request(app)
      .get(`/api/share/${created.body.shareLink.token}`)
      .expect(404);
  });
});
