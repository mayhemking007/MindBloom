import { query, withTransaction } from "../config/db.js";
import { appTables } from "../db/schema.js";
import { ApiError } from "../http/errors.js";
import { getMemoGrafterForSession } from "../memo-grafter/memoGrafter.js";
import { listSourceDocuments } from "../repositories/sourceDocuments.repository.js";
import type { OwnerScope } from "./entries.service.js";

export async function deleteNotionBloomAccount(owner: OwnerScope): Promise<void> {
  if (owner.ownerKind !== "authenticated") throw new ApiError(401, "Authentication is required");
  const activeJobs = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${appTables.notionImportJobs}
     WHERE owner_id=$1 AND status IN ('queued','running')`,
    [owner.ownerId],
  );
  if (Number(activeJobs.rows[0]?.count ?? 0) > 0) throw new ApiError(409, "Cancel active imports before deleting your account");

  const [documents, entries] = await Promise.all([
    listSourceDocuments({ ownerId: owner.ownerId, ownerKind: "authenticated" }),
    query<{ memo_session_id: string }>(
      `SELECT memo_session_id FROM ${appTables.journalEntries} WHERE owner_id=$1 AND owner_kind='authenticated'`,
      [owner.ownerId],
    ),
  ]);
  for (const sessionId of [...documents.map((item) => item.memo_session_id), ...entries.rows.map((item) => item.memo_session_id)]) {
    await (await getMemoGrafterForSession(sessionId)).clearSession();
  }

  await withTransaction(async (client) => {
    await client.query(`DELETE FROM ${appTables.sourceDocuments} WHERE owner_id=$1 AND owner_kind='authenticated'`, [owner.ownerId]);
    await client.query(`DELETE FROM ${appTables.notes} WHERE owner_id=$1 AND owner_kind='authenticated'`, [owner.ownerId]);
    await client.query(`DELETE FROM ${appTables.journalEntries} WHERE owner_id=$1 AND owner_kind='authenticated'`, [owner.ownerId]);
    await client.query(`DELETE FROM ${appTables.userSettings} WHERE owner_id=$1 AND owner_kind='authenticated'`, [owner.ownerId]);
    await client.query(`DELETE FROM ${appTables.users} WHERE id=$1`, [owner.ownerId]);
  });
}
