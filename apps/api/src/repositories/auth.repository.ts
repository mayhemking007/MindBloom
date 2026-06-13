import type { AuthSessionRow, UserRow } from "../db/schema.js";
import { appTables } from "../db/schema.js";
import { query } from "../config/db.js";

export async function insertUser(input: {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
}): Promise<UserRow> {
  const result = await query<UserRow>(
    `INSERT INTO ${appTables.users}
      (id, email, password_hash, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.id, input.email, input.passwordHash, input.displayName],
  );

  return result.rows[0]!;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    `SELECT * FROM ${appTables.users} WHERE email = $1`,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function insertAuthSession(input: {
  token: string;
  userId: string;
  expiresAt: string;
}): Promise<AuthSessionRow> {
  const result = await query<AuthSessionRow>(
    `INSERT INTO ${appTables.authSessions}
      (token, user_id, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.token, input.userId, input.expiresAt],
  );

  return result.rows[0]!;
}

export async function findUserBySessionToken(
  token: string,
): Promise<UserRow | null> {
  const result = await query<UserRow>(
    `SELECT users.*
     FROM ${appTables.authSessions} sessions
     JOIN ${appTables.users} users ON users.id = sessions.user_id
     WHERE sessions.token = $1 AND sessions.expires_at > now()`,
    [token],
  );

  return result.rows[0] ?? null;
}
