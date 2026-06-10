import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { AuthUser } from "@mindbloom/shared";
import {
  dataFilePath,
  isPersistenceEnabled,
  readJsonFile,
  writeJsonFile,
} from "./persistence.js";

interface StoredUser extends AuthUser {
  passwordHash: string;
  passwordSalt: string;
  updatedAt: string;
}

interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

interface AuthStoreSnapshot {
  users: StoredUser[];
  sessions: StoredSession[];
}

export interface SessionResult {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

export const sessionCookieName = "mindbloom_session";

const sessionDays = 30;

function nowIso(): string {
  return new Date().toISOString();
}

function hashSecret(secret: string, salt: string): string {
  return scryptSync(secret, salt, 64).toString("base64url");
}

function publicUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class InMemoryAuthStore {
  private readonly users = new Map<string, StoredUser>();

  private readonly usersByEmail = new Map<string, string>();

  private readonly sessions = new Map<string, StoredSession>();

  private readonly persistenceFile: string | null;

  constructor(options: { persistenceFile?: string | null } = {}) {
    this.persistenceFile = options.persistenceFile ?? null;
    this.load();
    if (process.env.NODE_ENV !== "production") {
      this.seedDevUsers();
    }
  }

  private load(): void {
    if (!this.persistenceFile) {
      return;
    }

    const snapshot = readJsonFile<AuthStoreSnapshot>(this.persistenceFile);
    if (!snapshot) {
      return;
    }

    for (const user of snapshot.users ?? []) {
      this.users.set(user.id, user);
      this.usersByEmail.set(user.email, user.id);
    }
    for (const session of snapshot.sessions ?? []) {
      this.sessions.set(session.id, session);
    }
  }

  private save(): void {
    if (!this.persistenceFile) {
      return;
    }

    writeJsonFile(this.persistenceFile, {
      users: [...this.users.values()],
      sessions: [...this.sessions.values()],
    } satisfies AuthStoreSnapshot);
  }

  createUser(input: {
    email: string;
    password: string;
    displayName?: string;
  }): AuthUser {
    const email = normalizeEmail(input.email);
    if (this.usersByEmail.has(email)) {
      throw new Error("User already exists");
    }

    const timestamp = nowIso();
    const passwordSalt = randomBytes(16).toString("base64url");
    const user: StoredUser = {
      id: randomUUID(),
      email,
      displayName:
        input.displayName?.trim() || email.split("@")[0] || "MindBloom user",
      passwordHash: hashSecret(input.password, passwordSalt),
      passwordSalt,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user.id);
    this.save();
    return publicUser(user);
  }

  authenticate(emailInput: string, password: string): AuthUser | null {
    const email = normalizeEmail(emailInput);
    const userId = this.usersByEmail.get(email);
    const user = userId ? this.users.get(userId) : undefined;
    if (!user) {
      return null;
    }

    const candidateHash = hashSecret(password, user.passwordSalt);
    const expected = Buffer.from(user.passwordHash);
    const candidate = Buffer.from(candidateHash);
    if (
      expected.length !== candidate.length ||
      !timingSafeEqual(expected, candidate)
    ) {
      return null;
    }

    return publicUser(user);
  }

  createSession(userId: string): SessionResult {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const token = randomBytes(32).toString("base64url");
    const tokenSalt = randomBytes(16).toString("base64url");
    const createdAt = nowIso();
    const expiresAt = new Date(
      Date.now() + sessionDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const session: StoredSession = {
      id: randomUUID(),
      userId,
      tokenHash: `${tokenSalt}.${hashSecret(token, tokenSalt)}`,
      createdAt,
      expiresAt,
      revokedAt: null,
    };

    this.sessions.set(session.id, session);
    this.save();
    return {
      token: `${session.id}.${token}`,
      expiresAt,
      user: publicUser(user),
    };
  }

  getUserForToken(cookieToken: string | undefined): AuthUser | null {
    if (!cookieToken) {
      return null;
    }

    const [sessionId, token] = cookieToken.split(".");
    if (!sessionId || !token) {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session || session.revokedAt || Date.parse(session.expiresAt) <= Date.now()) {
      return null;
    }

    const [salt, expectedHash] = session.tokenHash.split(".");
    if (!salt || !expectedHash) {
      return null;
    }

    const candidateHash = hashSecret(token, salt);
    const expected = Buffer.from(expectedHash);
    const candidate = Buffer.from(candidateHash);
    if (
      expected.length !== candidate.length ||
      !timingSafeEqual(expected, candidate)
    ) {
      return null;
    }

    const user = this.users.get(session.userId);
    return user ? publicUser(user) : null;
  }

  revokeToken(cookieToken: string | undefined): void {
    const [sessionId] = cookieToken?.split(".") ?? [];
    if (!sessionId) {
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.sessions.set(sessionId, {
      ...session,
      revokedAt: session.revokedAt ?? nowIso(),
    });
    this.save();
  }

  clear(): void {
    this.users.clear();
    this.usersByEmail.clear();
    this.sessions.clear();
    if (process.env.NODE_ENV !== "production") {
      this.seedDevUsers();
    }
    this.save();
  }

  private seedDevUsers(): void {
    for (const email of [
      "demo@mindbloom.local",
      "writer@mindbloom.local",
      "tester@mindbloom.local",
    ]) {
      if (!this.usersByEmail.has(email)) {
        this.createUser({
          email,
          password: "password123",
          displayName: email.split("@")[0] ?? "tester",
        });
      }
    }
  }
}

export const authStore = new InMemoryAuthStore({
  persistenceFile: isPersistenceEnabled() ? dataFilePath("auth.json") : null,
});
