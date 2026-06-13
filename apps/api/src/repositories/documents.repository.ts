import type { EntryDocumentRow } from "../db/schema.js";
import { appTables } from "../db/schema.js";
import { query } from "../config/db.js";

export async function upsertEntryDocument(input: {
  id: string;
  entryId: string;
  content: string;
}): Promise<EntryDocumentRow> {
  const result = await query<EntryDocumentRow>(
    `INSERT INTO ${appTables.entryDocuments}
      (id, entry_id, content, version, created_at, updated_at)
     VALUES ($1, $2, $3, 1, now(), now())
     ON CONFLICT (entry_id)
     DO UPDATE SET
       content = EXCLUDED.content,
       version = ${appTables.entryDocuments}.version + 1,
       updated_at = now()
     RETURNING *`,
    [input.id, input.entryId, input.content],
  );

  return result.rows[0]!;
}

export async function findEntryDocument(
  entryId: string,
): Promise<EntryDocumentRow | null> {
  const result = await query<EntryDocumentRow>(
    `SELECT * FROM ${appTables.entryDocuments} WHERE entry_id = $1`,
    [entryId],
  );

  return result.rows[0] ?? null;
}

export async function markEntryDocumentIngested(input: {
  entryId: string;
  version: number;
}): Promise<EntryDocumentRow | null> {
  const result = await query<EntryDocumentRow>(
    `UPDATE ${appTables.entryDocuments}
     SET last_ingested_version = $2, updated_at = now()
     WHERE entry_id = $1
     RETURNING *`,
    [input.entryId, input.version],
  );

  return result.rows[0] ?? null;
}
