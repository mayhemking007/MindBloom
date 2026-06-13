import type { EntryReflectionRow, ReflectionShareLinkRow } from "../db/schema.js";
import { appTables } from "../db/schema.js";
import { query } from "../config/db.js";

export async function insertEntryReflection(input: {
  id: string;
  entryId: string;
  cards: unknown;
  graphSnapshot: unknown;
  createdAt: string;
}): Promise<EntryReflectionRow> {
  const result = await query<EntryReflectionRow>(
    `INSERT INTO ${appTables.entryReflections}
      (id, entry_id, cards, graph_snapshot, created_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.id,
      input.entryId,
      JSON.stringify(input.cards),
      JSON.stringify(input.graphSnapshot),
      input.createdAt,
    ],
  );

  return result.rows[0]!;
}

export async function insertReflectionShareLink(input: {
  id: string;
  reflectionId: string;
  token: string;
  selectedCardIds: string[];
  expiresAt: string | null;
}): Promise<ReflectionShareLinkRow> {
  const result = await query<ReflectionShareLinkRow>(
    `INSERT INTO ${appTables.reflectionShareLinks}
      (id, reflection_id, token, selected_card_ids, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.id,
      input.reflectionId,
      input.token,
      input.selectedCardIds,
      input.expiresAt,
    ],
  );

  return result.rows[0]!;
}
