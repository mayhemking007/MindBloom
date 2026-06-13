import type { EntryGraftRow } from "../db/schema.js";
import { appTables } from "../db/schema.js";
import { query } from "../config/db.js";

export async function insertEntryGraft(input: {
  id: string;
  entryId: string;
  graftQuery: string;
  sourceEntryId: string | null;
  sourceEntryTitle: string | null;
  sourceEntryCreatedAt: string | null;
  sourceSessionId: string | null;
  sourceThemeId: string | null;
  themeLabel: string;
  similarity: number | null;
  graftedAt: string;
}): Promise<EntryGraftRow> {
  const result = await query<EntryGraftRow>(
    `INSERT INTO ${appTables.entryGrafts}
      (id, entry_id, query, source_entry_id, source_entry_title,
       source_entry_created_at, source_session_id, source_theme_id,
       theme_label, similarity, grafted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      input.id,
      input.entryId,
      input.graftQuery,
      input.sourceEntryId,
      input.sourceEntryTitle,
      input.sourceEntryCreatedAt,
      input.sourceSessionId,
      input.sourceThemeId,
      input.themeLabel,
      input.similarity,
      input.graftedAt,
    ],
  );

  return result.rows[0]!;
}

export async function listEntryGrafts(entryId: string): Promise<EntryGraftRow[]> {
  const result = await query<EntryGraftRow>(
    `SELECT * FROM ${appTables.entryGrafts}
     WHERE entry_id = $1
     ORDER BY grafted_at DESC`,
    [entryId],
  );

  return result.rows;
}
