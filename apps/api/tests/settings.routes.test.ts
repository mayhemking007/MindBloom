import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { entryStore } from "../src/services/entries.service.js";

const app = createApp();

const ownerHeaders = {
  "x-mindbloom-owner-kind": "authenticated",
  "x-mindbloom-owner-id": "settings-user",
};

describe("settings and calendar routes", () => {
  beforeEach(async () => {
    await entryStore.clear();
  });

  it("returns gentle calendar defaults", async () => {
    const response = await request(app)
      .get("/api/settings")
      .set(ownerHeaders)
      .expect(200);

    expect(response.body.settings).toMatchObject({
      calendarEnabled: false,
      calendarMode: "gentle",
      streaksEnabled: false,
    });
    expect(response.body.settings.updatedAt).toEqual(expect.any(String));
  });

  it("updates settings and only allows streaks in habit mode", async () => {
    const habit = await request(app)
      .patch("/api/settings")
      .set(ownerHeaders)
      .send({
        calendarEnabled: true,
        calendarMode: "habit",
        streaksEnabled: true,
      })
      .expect(200);

    expect(habit.body.settings).toMatchObject({
      calendarEnabled: true,
      calendarMode: "habit",
      streaksEnabled: true,
    });

    const gentle = await request(app)
      .patch("/api/settings")
      .set(ownerHeaders)
      .send({ calendarMode: "gentle" })
      .expect(200);

    expect(gentle.body.settings).toMatchObject({
      calendarEnabled: true,
      calendarMode: "gentle",
      streaksEnabled: false,
    });
  });

  it("summarizes calendar activity by day for the owner", async () => {
    await request(app)
      .patch("/api/settings")
      .set(ownerHeaders)
      .send({ calendarEnabled: true })
      .expect(200);

    const createdEntry = await request(app)
      .post("/api/entries")
      .set(ownerHeaders)
      .send({ purpose: "journal", mode: "classic", title: "A day" })
      .expect(201);
    const entryId = createdEntry.body.entry.id as string;

    await request(app)
      .post("/api/notes")
      .set(ownerHeaders)
      .send({ entryId, body: "A sticky thing to remember." })
      .expect(201);

    entryStore.createReflection({
      entryId,
      graphSnapshot: null,
      cards: [
        {
          id: "mood",
          type: "mood",
          title: "Mood",
          body: "Calm and focused",
        },
      ],
    });

    const response = await request(app)
      .get("/api/calendar/activity")
      .set(ownerHeaders)
      .expect(200);

    expect(response.body.settings.calendarEnabled).toBe(true);
    expect(response.body.days[0]).toMatchObject({
      entryCount: 1,
      noteCount: 1,
      reflectionCount: 1,
      moodLabel: "Calm and focused",
      moodColor: "teal",
    });
  });

  it("validates settings payloads", async () => {
    await request(app)
      .patch("/api/settings")
      .set(ownerHeaders)
      .send({ calendarMode: "strict" })
      .expect(400);
  });
});
