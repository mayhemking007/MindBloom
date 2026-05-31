import "dotenv/config";

import cors from "cors";
import express from "express";
import { z } from "zod";
import {
  getDateStamp,
  getTodaySessionId,
  type HealthResponse,
  type TodaySessionResponse,
} from "@mindbloom/shared";

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  PORT: z.coerce.number().int().positive().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

const env = envSchema.parse(process.env);
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

const port = env.PORT ?? env.API_PORT;

app.listen(port, () => {
  console.log(`MindBloom API listening on http://localhost:${port}`);
});
