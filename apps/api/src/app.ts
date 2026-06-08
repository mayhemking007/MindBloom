import cors from "cors";
import express from "express";
import {
  type HealthResponse,
  type TodaySessionResponse,
} from "@mindbloom/shared";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./http/errors.js";
import { getDateStamp, getTodaySessionId } from "./lib/sessionStore.js";
import { bloomRouter } from "./routes/bloom.js";
import { authRouter } from "./routes/auth.js";
import { chatRouter } from "./routes/chat.js";
import { entriesRouter } from "./routes/entries.js";
import { notesRouter } from "./routes/notes.js";
import { recallRouter } from "./routes/recall.js";
import { reflectRouter } from "./routes/reflect.js";
import { shareRouter } from "./routes/share.js";
import { snapshotRouter } from "./routes/snapshot.js";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "64kb" }));
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );

  app.get("/health", (_req, res) => {
    const response: HealthResponse = {
      ok: true,
      service: "mindbloom-api",
      version: "0.1.0",
    };

    res.json(response);
  });

  app.get("/api/session/today", (_req, res) => {
    const now = new Date();
    const response: TodaySessionResponse = {
      sessionId: getTodaySessionId(now),
      date: getDateStamp(now),
    };

    res.json(response);
  });

  app.use("/api/auth", authRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/entries", entriesRouter);
  app.use("/api/notes", notesRouter);
  app.use("/api/bloom", bloomRouter);
  app.use("/api/snapshot", snapshotRouter);
  app.use("/api/recall", recallRouter);
  app.use("/api/reflect", reflectRouter);
  app.use("/api", shareRouter);

  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}
