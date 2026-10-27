import { randomUUID } from "node:crypto";
import type pg from "pg";

import { query, withTransaction } from "../config/db.js";
import { appTables, type NotionImportJobRow, type NotionImportJobStatus } from "../db/schema.js";

export interface ImportJobOwner {
  ownerId: string;
  ownerKind: "authenticated";
}

export async function createImportJob(pageIds: string[], owner: ImportJobOwner): Promise<NotionImportJobRow> {
  const result = await query<NotionImportJobRow>(
    `INSERT INTO ${appTables.notionImportJobs}
      (id, owner_id, owner_kind, page_ids, total_pages)
     VALUES ($1, $2, 'authenticated', $3, $4)
     RETURNING *`,
    [randomUUID(), owner.ownerId, pageIds, pageIds.length],
  );
  return result.rows[0]!;
}

export async function findImportJob(id: string, owner: ImportJobOwner): Promise<NotionImportJobRow | null> {
  const result = await query<NotionImportJobRow>(
    `SELECT * FROM ${appTables.notionImportJobs} WHERE id=$1 AND owner_id=$2 AND owner_kind='authenticated'`,
    [id, owner.ownerId],
  );
  return result.rows[0] ?? null;
}

export async function listActiveImportJobs(owner: ImportJobOwner): Promise<NotionImportJobRow[]> {
  const result = await query<NotionImportJobRow>(
    `SELECT * FROM ${appTables.notionImportJobs}
     WHERE owner_id=$1 AND owner_kind='authenticated' AND status IN ('queued','running')
     ORDER BY created_at`,
    [owner.ownerId],
  );
  return result.rows;
}

export async function claimNextImportJob(): Promise<NotionImportJobRow | null> {
  return withTransaction(async (client) => {
    const result = await client.query<NotionImportJobRow>(
      `SELECT * FROM ${appTables.notionImportJobs}
       WHERE status='queued' AND available_at <= now()
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
    );
    const row = result.rows[0];
    if (!row) return null;
    const claimed = await client.query<NotionImportJobRow>(
      `UPDATE ${appTables.notionImportJobs}
       SET status='running', stage='reading_notion', locked_at=now(), attempts=attempts+1, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [row.id],
    );
    return claimed.rows[0] ?? null;
  });
}

export async function updateImportJobProgress(
  id: string,
  input: { completedPages: number; currentPageId: string | null; currentPageTitle: string | null; stage: NotionImportJobRow["stage"]; results: unknown[] },
): Promise<void> {
  await query(
    `UPDATE ${appTables.notionImportJobs}
     SET completed_pages=$2, current_page_id=$3, current_page_title=$4, stage=$5, results=$6::jsonb, updated_at=now()
     WHERE id=$1 AND status='running'`,
    [id, input.completedPages, input.currentPageId, input.currentPageTitle, input.stage, JSON.stringify(input.results)],
  );
}

export async function finishImportJob(
  id: string,
  status: Extract<NotionImportJobStatus, "completed" | "completed_with_errors" | "failed">,
  results: unknown[],
  lastError: string | null = null,
): Promise<void> {
  await query(
    `UPDATE ${appTables.notionImportJobs}
     SET status=$2, stage='finished', completed_pages=CASE WHEN $2='failed' THEN completed_pages ELSE total_pages END,
       current_page_id=null, current_page_title=null, results=$3::jsonb, last_error=$4,
       completed_at=now(), locked_at=null, updated_at=now()
     WHERE id=$1 AND status='running'`,
    [id, status, JSON.stringify(results), lastError],
  );
}

export async function cancelImportJob(id: string, owner: ImportJobOwner): Promise<NotionImportJobRow | null> {
  const result = await query<NotionImportJobRow>(
    `UPDATE ${appTables.notionImportJobs}
     SET status='cancelled', stage='finished', completed_at=now(), updated_at=now()
     WHERE id=$1 AND owner_id=$2 AND owner_kind='authenticated' AND status IN ('queued','running')
     RETURNING *`,
    [id, owner.ownerId],
  );
  return result.rows[0] ?? findImportJob(id, owner);
}

export async function isImportJobCancelled(id: string): Promise<boolean> {
  const result = await query<{ status: NotionImportJobStatus }>(
    `SELECT status FROM ${appTables.notionImportJobs} WHERE id=$1`,
    [id],
  );
  return result.rows[0]?.status === "cancelled";
}

export async function recoverInterruptedImportJobs(): Promise<number> {
  const result = await query(
    `UPDATE ${appTables.notionImportJobs}
     SET status='queued', stage='queued', locked_at=null, available_at=now(),
       last_error='Worker restarted; import resumed safely.', updated_at=now()
     WHERE status='running'`,
  );
  return result.rowCount ?? 0;
}

export async function deleteImportJobsForOwner(client: pg.PoolClient, ownerId: string): Promise<void> {
  await client.query(`DELETE FROM ${appTables.notionImportJobs} WHERE owner_id=$1`, [ownerId]);
}

export async function deleteAllImportJobs(owner: ImportJobOwner): Promise<void> {
  await query(`DELETE FROM ${appTables.notionImportJobs} WHERE owner_id=$1 AND owner_kind='authenticated'`, [owner.ownerId]);
}
