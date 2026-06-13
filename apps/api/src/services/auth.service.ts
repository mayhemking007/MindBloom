import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { AuthUser } from "@mindbloom/shared";

import { query } from "../config/db.js";
import { appTables } from "../db/schema.js";

export interface SessionResult {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

interface StoredUserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: Date;
}

interface StoredSessionRow {
  token: string;
  user_id: string;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

export const sessionCookieName = "mindbloom_session";

const sessionDays = 30;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function hashSecret(secret: string, salt: string): string {
  return scryptSync(secret, salt, 64).toString("base64url");
}

function publicUser(user: StoredUserRow): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    createdAt: toIso(user.created_at),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function verifySecret(secret: string, storedValue: string): boolean {
  const [salt, expectedHash] = storedValue.split(".");
  if (!salt || !expectedHash) {
    return false;
  }

  const candidateHash = hashSecret(secret, salt);
  const expected = Buffer.from(expectedHash);
  const candidate = Buffer.from(candidateHash);
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

async function findUserById(userId: string): Promise<StoredUserRow | null> {
  const result = await query<StoredUserRow>(
    `SELECT id, email, password_hash, display_name, created_at
     FROM ${appTables.users}
     WHERE id = $1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

export const authStore = {
  async createUser(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<AuthUser> {
    const email = normalizeEmail(input.email);
    const passwordSalt = randomBytes(16).toString("base64url");
    const passwordHash = `${passwordSalt}.${hashSecret(input.password, passwordSalt)}`;

    const result = await query<StoredUserRow>(
      `INSERT INTO ${appTables.users}
        (id, email, password_hash, display_name, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, email, password_hash, display_name, created_at`,
      [
        randomUUID(),
        email,
        passwordHash,
        input.displayName?.trim() || email.split("@")[0] || "MindBloom user",
      ],
    );

    return publicUser(result.rows[0]!);
  },

  async authenticate(emailInput: string, password: string): Promise<AuthUser | null> {
    const result = await query<StoredUserRow>(
      `SELECT id, email, password_hash, display_name, created_at
       FROM ${appTables.users}
       WHERE email = $1`,
      [normalizeEmail(emailInput)],
    );
    const user = result.rows[0];
    if (!user || !verifySecret(password, user.password_hash)) {
      return null;
    }

    return publicUser(user);
  },

  async createSession(userId: string): Promise<SessionResult> {
    const user = await findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const sessionId = randomUUID();
    const token = randomBytes(32).toString("base64url");
    const tokenSalt = randomBytes(16).toString("base64url");
    const tokenHash = `${tokenSalt}.${hashSecret(token, tokenSalt)}`;
    const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);

    await query<StoredSessionRow>(
      `INSERT INTO ${appTables.authSessions}
        (token, user_id, token_hash, created_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, now(), $4, null)`,
      [sessionId, user.id, tokenHash, expiresAt.toISOString()],
    );

    return {
      token: `${sessionId}.${token}`,
      expiresAt: expiresAt.toISOString(),
      user: publicUser(user),
    };
  },

  async getUserForToken(cookieToken: string | undefined): Promise<AuthUser | null> {
    if (!cookieToken) {
      return null;
    }

    const [sessionId, token] = cookieToken.split(".");
    if (!sessionId || !token) {
      return null;
    }

    const result = await query<StoredSessionRow & StoredUserRow>(
      `SELECT
         sessions.token,
         sessions.user_id,
         sessions.created_at,
         sessions.expires_at,
         sessions.revoked_at,
         sessions.token_hash,
         users.id,
         users.email,
         users.password_hash,
         users.display_name,
         users.created_at AS user_created_at
       FROM ${appTables.authSessions} sessions
       JOIN ${appTables.users} users ON users.id = sessions.user_id
       WHERE sessions.token = $1`,
      [sessionId],
    );
    const row = result.rows[0] as
      | (StoredSessionRow & StoredUserRow & { token_hash: string; user_created_at: Date })
      | undefined;
    if (
      !row ||
      row.revoked_at ||
      Date.parse(toIso(row.expires_at)) <= Date.now() ||
      !verifySecret(token, row.token_hash)
    ) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      createdAt: toIso(row.user_created_at),
    };
  },

  async revokeToken(cookieToken: string | undefined): Promise<void> {
    const [sessionId] = cookieToken?.split(".") ?? [];
    if (!sessionId) {
      return;
    }

    await query(
      `UPDATE ${appTables.authSessions}
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE token = $1`,
      [sessionId],
    );
  },

  async clear(): Promise<void> {
    await query(`DELETE FROM ${appTables.authSessions}`);
    await query(`DELETE FROM ${appTables.users}`);
    if (process.env.NODE_ENV !== "production") {
      await this.seedDevUsers();
    }
  },

  async seedDevUsers(): Promise<void> {
    for (const email of [
      "demo@mindbloom.local",
      "writer@mindbloom.local",
      "tester@mindbloom.local",
    ]) {
      try {
        await this.createUser({
          email,
          password: "password123",
          displayName: email.split("@")[0] ?? "tester",
        });
      } catch {
        // User already exists.
      }
    }
  },
};
