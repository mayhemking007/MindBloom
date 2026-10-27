import { randomUUID } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import { env } from "../../config/env.js";
import { ApiError } from "../errors.js";

const attempts = new Map<string, { count: number; resetAt: number }>();
const authWindowMs = 15 * 60 * 1_000;

function requestIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export const notionSecurityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  if (env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
};

export const requestContext: RequestHandler = (req, res, next) => {
  const requestId = req.get("x-request-id")?.slice(0, 100) || randomUUID();
  res.setHeader("X-Request-Id", requestId);
  const startedAt = Date.now();
  res.on("finish", () => {
    console.log(JSON.stringify({
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      service: "notion-bloom-api",
      event: "request",
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    }));
  });
  next();
};

export const notionCsrfGuard: RequestHandler = (req, _res, next) => {
  if (env.NODE_ENV !== "production" || ["GET", "HEAD", "OPTIONS"].includes(req.method) || !req.get("cookie")) return next();
  const origin = req.get("origin");
  const allowedOrigins = env.NOTION_CORS_ORIGIN.split(",").map((value) => value.trim());
  if (!origin || !allowedOrigins.includes(origin)) return next(new ApiError(403, "This request did not come from an allowed Notion Bloom origin"));
  next();
};

export const notionAuthRateLimit: RequestHandler = (req, res, next) => {
  const key = requestIp(req);
  const now = Date.now();
  const current = attempts.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + authWindowMs } : current;
  bucket.count += 1;
  attempts.set(key, bucket);
  if (attempts.size > 10_000) {
    for (const [candidate, value] of attempts) if (value.resetAt <= now) attempts.delete(candidate);
  }
  res.setHeader("RateLimit-Limit", env.NOTION_AUTH_RATE_LIMIT);
  res.setHeader("RateLimit-Remaining", Math.max(0, env.NOTION_AUTH_RATE_LIMIT - bucket.count));
  res.setHeader("RateLimit-Reset", Math.ceil(bucket.resetAt / 1_000));
  if (bucket.count > env.NOTION_AUTH_RATE_LIMIT) {
    res.setHeader("Retry-After", Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)));
    return next(new ApiError(429, "Too many authentication attempts. Try again later."));
  }
  next();
};

export function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req, res, next) => { void handler(req, res, next).catch(next); };
}
