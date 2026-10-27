import { Router } from "express";
import { z } from "zod";
import type { AuthMeResponse, AuthResponse } from "@mindbloom/shared";

import { env } from "../config/env.js";
import { readCookie } from "../http/cookies.js";
import { ApiError } from "../http/errors.js";
import { authStore, sessionCookieName } from "../services/auth.service.js";

const registerSchema = z.object({
  email: z.string().trim().email().max(240),
  password: z.string().min(10, "Password must be at least 10 characters").max(200),
  displayName: z.string().trim().min(1).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(240),
  password: z.string().min(1).max(200),
});

function sessionCookie(token: string, expiresAt: string): string {
  const attributes = [
    `${sessionCookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];
  if (env.NODE_ENV === "production") {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

function clearSessionCookie(): string {
  return [
    `${sessionCookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
}

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }
    if (env.NODE_ENV === "production") {
      const invitedEmails = new Set((env.NOTION_INVITE_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
      if (!env.NOTION_REGISTRATION_ENABLED || (invitedEmails.size > 0 && !invitedEmails.has(parsed.data.email.toLowerCase()))) {
        throw new ApiError(403, "Notion Bloom is currently invite-only. Ask the workspace owner for access.");
      }
    }

    let user;
    try {
      user = await authStore.createUser(parsed.data);
    } catch {
      throw new ApiError(409, "A user with this email already exists");
    }

    const session = await authStore.createSession(user.id);
    const response: AuthResponse = { user: session.user };
    res.setHeader("Set-Cookie", sessionCookie(session.token, session.expiresAt));
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    const user = await authStore.authenticate(
      parsed.data.email,
      parsed.data.password,
    );
    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    const session = await authStore.createSession(user.id);
    const response: AuthResponse = { user: session.user };
    res.setHeader("Set-Cookie", sessionCookie(session.token, session.expiresAt));
    res.json(response);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    await authStore.revokeToken(readCookie(req.get("cookie"), sessionCookieName));
    res.setHeader("Set-Cookie", clearSessionCookie());
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", async (req, res, next) => {
  try {
    const user = await authStore.getUserForToken(
      readCookie(req.get("cookie"), sessionCookieName),
    );
    const response: AuthMeResponse = {
      user,
      ownerKind: user ? "authenticated" : "demo",
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});
