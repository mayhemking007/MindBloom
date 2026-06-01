import cors from "cors";
import express from "express";
import {
  type HealthResponse,
  type TodaySessionResponse,
} from "@mindbloom/shared";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./http/errors.js";
import { getDateStamp, getTodaySessionId } from "./lib/sessionStore.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
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

  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}
