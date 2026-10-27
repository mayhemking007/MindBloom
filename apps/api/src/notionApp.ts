import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./http/middleware/errorHandler.js";
import { authRouter } from "./routes/auth.routes.js";
import { notionRouter } from "./routes/notion.routes.js";
import { dbPool } from "./config/db.js";
import { notionAuthRateLimit, notionCsrfGuard, notionSecurityHeaders, requestContext } from "./http/middleware/notionSecurity.js";

export function createNotionBloomApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(requestContext);
  app.use(notionSecurityHeaders);
  app.use(express.json({ limit: "128kb" }));
  app.use(cors({ origin: env.NOTION_CORS_ORIGIN.split(",").map((value) => value.trim()), credentials: true }));
  app.use(notionCsrfGuard);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "notion-bloom-api", version: "0.1.0" });
  });
  app.get("/health/live", (_req, res) => res.json({ ok: true, service: "notion-bloom-api" }));
  app.get("/health/ready", async (_req, res, next) => {
    try {
      await dbPool.query("SELECT 1");
      const notionConfigured = Boolean(env.NOTION_TOKEN);
      res.status(notionConfigured ? 200 : 503).json({ ok: notionConfigured, service: "notion-bloom-api", checks: { database: "ok", notionConfigured } });
    } catch (error) { next(error); }
  });

  app.use("/api/auth/login", notionAuthRateLimit);
  app.use("/api/auth/register", notionAuthRateLimit);
  app.use("/api/auth", authRouter);
  app.use("/api/notion", notionRouter);

  app.use(notFoundHandler());
  app.use(errorHandler("Notion Bloom API"));
  return app;
}
