import type { NoteRow } from "../db/schema.js";
import { appTables } from "../db/schema.js";
import { query } from "../config/db.js";

export async function insertNote(input: {
  id: string;
  ownerId: string;
  ownerKind: NoteRow["owner_kind"];
  entryId: string | null;
  title: string;
  body: string;
  sourceType: NoteRow["source_type"];
  color: string | null;
  pinned: boolean;
}): Promise<NoteRow> {
  const result = await query<NoteRow>(
    `INSERT INTO ${appTables.notes}
      (id, owner_id, owner_kind, entry_id, title, body, source_type, color, pinned)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.id,
      input.ownerId,
      input.ownerKind,
      input.entryId,
      input.title,
      input.body,
      input.sourceType,
      input.color,
      input.pinned,
    ],
  );

  return result.rows[0]!;
}

export async function listNotesByOwner(input: {
  ownerId: string;
  ownerKind: NoteRow["owner_kind"];
}): Promise<NoteRow[]> {
  const result = await query<NoteRow>(
    `SELECT * FROM ${appTables.notes}
     WHERE owner_id = $1 AND owner_kind = $2
     ORDER BY pinned DESC, created_at DESC`,
    [input.ownerId, input.ownerKind],
  );

  return result.rows;
}
