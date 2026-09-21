import { randomUUID } from "node:crypto";
import { query } from "../config/db.js";
import { appTables, type SourceDocumentMessageRow, type SourceDocumentRow } from "../db/schema.js";

export interface SourceOwner { ownerId: string; ownerKind: "authenticated" | "demo"; }

export async function listSourceDocuments(owner: SourceOwner): Promise<SourceDocumentRow[]> {
  const result = await query<SourceDocumentRow>(
    `SELECT * FROM ${appTables.sourceDocuments} WHERE owner_id=$1 AND owner_kind=$2 ORDER BY source_updated_at DESC`,
    [owner.ownerId, owner.ownerKind],
  );
  return result.rows;
}

export async function findSourceDocument(id: string, owner: SourceOwner): Promise<SourceDocumentRow | null> {
  const result = await query<SourceDocumentRow>(
    `SELECT * FROM ${appTables.sourceDocuments} WHERE id=$1 AND owner_id=$2 AND owner_kind=$3`,
    [id, owner.ownerId, owner.ownerKind],
  );
  return result.rows[0] ?? null;
}

export async function findSourceDocumentByExternalId(externalId: string, owner: SourceOwner): Promise<SourceDocumentRow | null> {
  const result = await query<SourceDocumentRow>(
    `SELECT * FROM ${appTables.sourceDocuments} WHERE source='notion' AND external_id=$1 AND owner_id=$2 AND owner_kind=$3`,
    [externalId, owner.ownerId, owner.ownerKind],
  );
  return result.rows[0] ?? null;
}

export async function upsertSourceDocument(input: Omit<SourceDocumentRow, "created_at" | "updated_at">): Promise<SourceDocumentRow> {
  const values = [input.id,input.owner_id,input.owner_kind,input.external_id,input.title,input.content,input.content_hash,input.source_url,input.source_created_at,input.source_updated_at,input.memo_session_id,input.status,input.last_synced_at,input.last_error];
  const result = await query<SourceDocumentRow>(
    `INSERT INTO ${appTables.sourceDocuments}
      (id,owner_id,owner_kind,source,external_id,title,content,content_hash,source_url,source_created_at,source_updated_at,memo_session_id,status,last_synced_at,last_error)
     VALUES ($1,$2,$3,'notion',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (owner_kind,owner_id,source,external_id) DO UPDATE SET
       title=EXCLUDED.title, content=EXCLUDED.content, content_hash=EXCLUDED.content_hash,
       source_url=EXCLUDED.source_url, source_created_at=EXCLUDED.source_created_at,
       source_updated_at=EXCLUDED.source_updated_at, status=EXCLUDED.status,
       last_synced_at=EXCLUDED.last_synced_at, last_error=EXCLUDED.last_error, updated_at=now()
     RETURNING *`, values,
  );
  return result.rows[0]!;
}

export async function markSourceDocumentFailed(id: string, message: string): Promise<void> {
  await query(`UPDATE ${appTables.sourceDocuments} SET status='failed', last_error=$2, updated_at=now() WHERE id=$1`, [id, message]);
}

export async function deleteSourceDocument(id: string, owner: SourceOwner): Promise<void> {
  await query(`DELETE FROM ${appTables.sourceDocuments} WHERE id=$1 AND owner_id=$2 AND owner_kind=$3`, [id, owner.ownerId, owner.ownerKind]);
}

export async function listSourceDocumentMessages(documentId: string): Promise<SourceDocumentMessageRow[]> {
  const result = await query<SourceDocumentMessageRow>(`SELECT * FROM ${appTables.sourceDocumentMessages} WHERE document_id=$1 ORDER BY created_at`, [documentId]);
  return result.rows;
}

export async function createSourceDocumentMessage(documentId: string, role: "user" | "assistant", content: string): Promise<SourceDocumentMessageRow> {
  const result = await query<SourceDocumentMessageRow>(
    `INSERT INTO ${appTables.sourceDocumentMessages} (id,document_id,role,content) VALUES ($1,$2,$3,$4) RETURNING *`,
    [randomUUID(), documentId, role, content],
  );
  return result.rows[0]!;
}
