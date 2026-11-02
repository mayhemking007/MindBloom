import { randomUUID } from "node:crypto";
import { query } from "../config/db.js";
import { appTables } from "../db/schema.js";

export async function saveThoughtFeedback(input: { ownerId: string; connectionId: string | null; documentId: string; memoryId: string; useful: boolean }): Promise<void> {
  await query(
    `INSERT INTO ${appTables.notionThoughtFeedback} (id,owner_id,connection_id,document_id,memory_id,useful)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (owner_id,document_id,memory_id) DO UPDATE SET useful=EXCLUDED.useful,created_at=now()`,
    [randomUUID(), input.ownerId, input.connectionId, input.documentId, input.memoryId, input.useful],
  );
}

export async function findCommentDelivery(documentId: string, contentHash: string): Promise<string | null> {
  const result = await query<{ notion_comment_id: string }>(
    `SELECT notion_comment_id FROM ${appTables.notionCommentDeliveries} WHERE document_id=$1 AND content_hash=$2`,
    [documentId, contentHash],
  );
  return result.rows[0]?.notion_comment_id ?? null;
}

export async function storeCommentDelivery(input: { ownerId: string; documentId: string; memoryId: string | null; contentHash: string; commentId: string }): Promise<void> {
  await query(
    `INSERT INTO ${appTables.notionCommentDeliveries} (id,owner_id,document_id,memory_id,content_hash,notion_comment_id)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (document_id,content_hash) DO NOTHING`,
    [randomUUID(), input.ownerId, input.documentId, input.memoryId, input.contentHash, input.commentId],
  );
}
