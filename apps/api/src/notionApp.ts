import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./http/middleware/errorHandler.js";
import { authRouter } from "./routes/auth.routes.js";
import { notionRouter } from "./routes/notion.routes.js";

export function createNotionBloomApp() {
  const app = express();

  app.use(express.json({ limit: "128kb" }));
  app.use(cors({ origin: env.NOTION_CORS_ORIGIN, credentials: true }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "notion-bloom-api", version: "0.1.0" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/notion", notionRouter);

  app.use(notFoundHandler());
  app.use(errorHandler("Notion Bloom API"));
  return app;
}
