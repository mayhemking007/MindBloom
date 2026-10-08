import request from "supertest";
import { describe, expect, it } from "vitest";

import { createNotionBloomApp } from "../src/notionApp.js";

const app = createNotionBloomApp();

describe("standalone Notion Bloom API", () => {
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
});
