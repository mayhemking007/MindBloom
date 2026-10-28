import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createNotionBloomApp } from "../src/notionApp.js";
import { authStore } from "../src/services/auth.service.js";
import { upsertOauthConnection } from "../src/repositories/notionConnections.repository.js";
import { encryptNotionSecret } from "../src/services/notionTokenCrypto.js";

const app = createNotionBloomApp();

describe("standalone Notion Bloom API", () => {
  beforeEach(async () => { await authStore.clear(); });
  it("identifies itself independently", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.body).toEqual({ ok: true, service: "notion-bloom-api", version: "0.1.0" });
  });

  it("does not expose MindBloom journal routes", async () => {
    await request(app).get("/api/entries").expect(404);
    await request(app).get("/api/notes").expect(404);
    await request(app).get("/api/session/today").expect(404);
  });

  it("keeps account routes available for the private garden", async () => {
    const response = await request(app).get("/api/auth/me").expect(200);
    expect(response.body).toEqual({ user: null, ownerKind: "demo" });
  });

  it("rejects unauthenticated and forged owner access to Notion data", async () => {
    await request(app).get("/api/notion/documents").expect(401);
    await request(app)
      .get("/api/notion/documents")
      .set("x-mindbloom-owner-kind", "authenticated")
      .set("x-mindbloom-owner-id", "someone-else")
      .expect(401);
  });

  it("queues imports and isolates job status by authenticated account", async () => {
    const first = request.agent(app);
    const second = request.agent(app);
    await first.post("/api/auth/register").send({ email: "notion-one@example.com", password: "private-beta-one", displayName: "One" }).expect(201);
    await second.post("/api/auth/register").send({ email: "notion-two@example.com", password: "private-beta-two", displayName: "Two" }).expect(201);

    const queued = await first.post("/api/notion/import").send({ pageIds: ["page-a", "page-a", "page-b"] }).expect(202);
    expect(queued.body.job).toMatchObject({ status: "queued", totalPages: 2, completedPages: 0 });

    await first.get(`/api/notion/imports/${queued.body.job.id}`).expect(200);
    await second.get(`/api/notion/imports/${queued.body.job.id}`).expect(404);
  });

  it("creates an OAuth authorization request with an opaque one-time state", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: "oauth@example.com", password: "private-beta-oauth" }).expect(201);
    const response = await agent.post("/api/notion/oauth/start").send({ returnPath: "/notion" }).expect(200);
    expect(response.body.authorizationUrl).toContain("https://api.notion.com/v1/oauth/authorize");
    const url = new URL(response.body.authorizationUrl);
    expect(url.searchParams.get("client_id")).toBe("test-notion-client");
    expect(url.searchParams.get("state")).toHaveLength(43);
    await request(app).get("/api/notion/oauth/callback?code=fake&state=not-a-valid-state").expect(400);
  });

  it("isolates stored workspace connections by account", async () => {
    const first = request.agent(app);
    const second = request.agent(app);
    const firstUser = (await first.post("/api/auth/register").send({ email: "workspace-one@example.com", password: "private-beta-one" }).expect(201)).body.user;
    await second.post("/api/auth/register").send({ email: "workspace-two@example.com", password: "private-beta-two" }).expect(201);
    const access = encryptNotionSecret("oauth-access-token");
    await upsertOauthConnection({
      ownerId: firstUser.id,
      workspaceId: "workspace-one",
      workspaceName: "Private workspace",
      workspaceIcon: null,
      botId: "bot-one",
      access,
      refresh: null,
      scopes: [],
    });
    expect((await first.get("/api/notion/connections").expect(200)).body.connections).toHaveLength(1);
    expect((await second.get("/api/notion/connections").expect(200)).body.connections).toHaveLength(0);
  });

  it("deletes a Notion Bloom account and invalidates its session", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: "delete-me@example.com", password: "private-beta-delete" }).expect(201);
    await agent.delete("/api/notion/account").expect(204);
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.user).toBeNull();
  });
});
