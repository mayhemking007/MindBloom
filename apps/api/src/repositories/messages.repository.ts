import type { EntryMessageRow } from "../db/schema.js";
import { appTables } from "../db/schema.js";
import { query } from "../config/db.js";

export async function insertEntryMessage(input: {
  id: string;
  entryId: string;
  role: EntryMessageRow["role"];
  content: string;
  createdAt: string;
}): Promise<EntryMessageRow> {
  const result = await query<EntryMessageRow>(
    `INSERT INTO ${appTables.entryMessages}
      (id, entry_id, role, content, created_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.id, input.entryId, input.role, input.content, input.createdAt],
  );

  return result.rows[0]!;
}

export async function listEntryMessages(
  entryId: string,
): Promise<EntryMessageRow[]> {
  const result = await query<EntryMessageRow>(
    `SELECT * FROM ${appTables.entryMessages}
     WHERE entry_id = $1
     ORDER BY created_at ASC`,
    [entryId],
  );

  return result.rows;
}
