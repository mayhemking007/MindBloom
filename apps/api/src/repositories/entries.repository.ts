import type { JournalEntryRow } from "../db/schema.js";
import { appTables } from "../db/schema.js";
import { query } from "../config/db.js";

export interface CreateEntryRowInput {
  id: string;
  ownerId: string;
  ownerKind: JournalEntryRow["owner_kind"];
  title: string;
  tags: string[];
  status: JournalEntryRow["status"];
  memoSessionId: string;
  allowFutureContext: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface UpdateEntryRowInput {
  title?: string;
  tags?: string[];
  status?: JournalEntryRow["status"];
  allowFutureContext?: boolean;
  completedAt?: string | null;
}

export async function insertEntry(
  input: CreateEntryRowInput,
): Promise<JournalEntryRow> {
  const result = await query<JournalEntryRow>(
    `INSERT INTO ${appTables.journalEntries}
      (id, owner_id, owner_kind, title, tags, status, memo_session_id,
       allow_future_context, created_at, updated_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      input.id,
      input.ownerId,
      input.ownerKind,
      input.title,
      input.tags,
      input.status,
      input.memoSessionId,
      input.allowFutureContext,
      input.createdAt,
      input.updatedAt,
      input.completedAt,
    ],
  );

  return result.rows[0]!;
}

export async function findEntryById(
  entryId: string,
): Promise<JournalEntryRow | null> {
  const result = await query<JournalEntryRow>(
    `SELECT * FROM ${appTables.journalEntries} WHERE id = $1`,
    [entryId],
  );

  return result.rows[0] ?? null;
}

export async function listEntriesByOwner(input: {
  ownerId: string;
  ownerKind: JournalEntryRow["owner_kind"];
}): Promise<JournalEntryRow[]> {
  const result = await query<JournalEntryRow>(
    `SELECT * FROM ${appTables.journalEntries}
     WHERE owner_id = $1 AND owner_kind = $2
     ORDER BY updated_at DESC`,
    [input.ownerId, input.ownerKind],
  );

  return result.rows;
}

export async function updateEntryById(
  entryId: string,
  input: UpdateEntryRowInput,
): Promise<JournalEntryRow | null> {
  const result = await query<JournalEntryRow>(
    `UPDATE ${appTables.journalEntries}
     SET title = COALESCE($2, title),
         tags = COALESCE($3, tags),
         status = COALESCE($4, status),
         allow_future_context = COALESCE($5, allow_future_context),
         completed_at = CASE WHEN $6::boolean THEN $7::timestamptz ELSE completed_at END,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      entryId,
      input.title ?? null,
      input.tags ?? null,
      input.status ?? null,
      input.allowFutureContext ?? null,
      Object.hasOwn(input, "completedAt"),
      input.completedAt ?? null,
    ],
  );

  return result.rows[0] ?? null;
}

export async function deleteEntryById(entryId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM ${appTables.journalEntries} WHERE id = $1`,
    [entryId],
  );

  return (result.rowCount ?? 0) > 0;
}
