import { randomUUID } from "node:crypto";
import { query } from "../config/db.js";
import { appTables, type NotionImportJobRow, type SourceDocumentRow } from "../db/schema.js";
import type { EncryptedSecret } from "../services/notionTokenCrypto.js";

export async function storeWebhookVerificationToken(token: EncryptedSecret): Promise<void> {
  await query(
    `INSERT INTO ${appTables.notionWebhookConfig} (id,verification_token_ciphertext,token_iv,token_auth_tag,encryption_key_version)
     VALUES ('primary',$1,$2,$3,$4)
     ON CONFLICT (id) DO UPDATE SET verification_token_ciphertext=EXCLUDED.verification_token_ciphertext,
       token_iv=EXCLUDED.token_iv,token_auth_tag=EXCLUDED.token_auth_tag,
       encryption_key_version=EXCLUDED.encryption_key_version,updated_at=now()`,
    [token.ciphertext, token.iv, token.authTag, token.keyVersion],
  );
}

export async function readWebhookVerificationToken(): Promise<{ ciphertext: string; iv: string; authTag: string; keyVersion: string } | null> {
  const result = await query<{ verification_token_ciphertext: string; token_iv: string; token_auth_tag: string; encryption_key_version: string }>(
    `SELECT * FROM ${appTables.notionWebhookConfig} WHERE id='primary'`,
  );
  const row = result.rows[0];
  return row ? { ciphertext: row.verification_token_ciphertext, iv: row.token_iv, authTag: row.token_auth_tag, keyVersion: row.encryption_key_version } : null;
}

export async function recordWebhookEvent(input: { id: string; type: string; workspaceId: string | null; entityId: string | null; payload: unknown }): Promise<boolean> {
  await query(`DELETE FROM ${appTables.notionWebhookEvents} WHERE received_at < now() - interval '30 days'`);
  const result = await query(
    `INSERT INTO ${appTables.notionWebhookEvents} (event_id,event_type,workspace_id,entity_id,payload)
     VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT (event_id) DO NOTHING`,
    [input.id, input.type, input.workspaceId, input.entityId, JSON.stringify(input.payload)],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function finishWebhookEvent(id: string, status: "queued" | "ignored" | "failed", error: string | null = null): Promise<void> {
  await query(`UPDATE ${appTables.notionWebhookEvents} SET status=$2,error=$3,processed_at=now() WHERE event_id=$1`, [id, status, error]);
}

export async function documentsForWebhook(workspaceId: string, entityId: string): Promise<SourceDocumentRow[]> {
  const result = await query<SourceDocumentRow>(
    `SELECT * FROM ${appTables.sourceDocuments}
      WHERE workspace_id=$1 AND external_id=$2 AND owner_kind='authenticated'`,
    [workspaceId, entityId],
  );
  return result.rows;
}

export async function debounceRefreshJob(document: SourceDocumentRow, eventId: string, availableAt: Date): Promise<NotionImportJobRow> {
  const existing = await query<NotionImportJobRow>(
    `UPDATE ${appTables.notionImportJobs}
        SET available_at=$4,trigger_event_id=$5,updated_at=now()
      WHERE owner_id=$1 AND connection_id=$2 AND job_kind='refresh' AND status='queued' AND page_ids @> ARRAY[$3]::text[]
      RETURNING *`,
    [document.owner_id, document.connection_id, document.external_id, availableAt, eventId],
  );
  if (existing.rows[0]) return existing.rows[0];
  const inserted = await query<NotionImportJobRow>(
    `INSERT INTO ${appTables.notionImportJobs}
      (id,owner_id,owner_kind,connection_id,workspace_id,page_ids,total_pages,job_kind,trigger_event_id,available_at)
     VALUES ($1,$2,'authenticated',$3,$4,ARRAY[$5]::text[],1,'refresh',$6,$7) RETURNING *`,
    [randomUUID(), document.owner_id, document.connection_id, document.workspace_id, document.external_id, eventId, availableAt],
  );
  return inserted.rows[0]!;
}
