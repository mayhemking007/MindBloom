import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { authStore } from "../src/services/auth.service.js";
import { entryStore } from "../src/services/entries.service.js";

const app = createApp();

describe("auth routes", () => {
  beforeEach(async () => {
    await authStore.clear();
    await entryStore.clear();
  });

  it("logs in a seeded dev user and owns entries through the session cookie", async () => {
    const agent = request.agent(app);

    const login = await agent
      .post("/api/auth/login")
      .send({
        email: "writer@mindbloom.local",
        password: "password123",
      })
      .expect(200);

    expect(login.body.user.email).toBe("writer@mindbloom.local");

    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.ownerKind).toBe("authenticated");
    expect(me.body.user.email).toBe("writer@mindbloom.local");

    const created = await agent
      .post("/api/entries")
      .send({ title: "Private entry", purpose: "journal", mode: "classic" })
      .expect(201);
    expect(created.body.entry.ownerKind).toBe("authenticated");
    expect(created.body.entry.ownerId).toBe(login.body.user.id);

    const entries = await agent.get("/api/entries").expect(200);
    expect(entries.body.entries).toHaveLength(1);
  });

  it("registers, rejects duplicate users, and logs out", async () => {
    const agent = request.agent(app);

    const registered = await agent
      .post("/api/auth/register")
      .send({
        email: "new@mindbloom.local",
        password: "password123",
        displayName: "New Writer",
      })
      .expect(201);
    expect(registered.body.user.displayName).toBe("New Writer");

    await request(app)
      .post("/api/auth/register")
      .send({
        email: "new@mindbloom.local",
        password: "password123",
      })
      .expect(409);

    await agent.post("/api/auth/logout").expect(204);
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.user).toBeNull();
    expect(me.body.ownerKind).toBe("demo");
  });

  it("rejects invalid login and keeps unauthenticated requests in demo mode", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({
        email: "writer@mindbloom.local",
        password: "wrong-password",
      })
      .expect(401);

    const entry = await request(app)
      .post("/api/entries")
      .send({ purpose: "journal", mode: "classic" })
      .expect(201);
    expect(entry.body.entry.ownerKind).toBe("demo");
    expect(entry.body.entry.ownerId).toBe("demo-local");
  });
});
