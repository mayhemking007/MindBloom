import { createHash, randomUUID } from "node:crypto";
import type { NotionConnection } from "@mindbloom/shared";

import { query, withTransaction } from "../config/db.js";
import { appTables, type NotionConnectionRow, type NotionOauthStateRow } from "../db/schema.js";
import type { EncryptedSecret } from "../services/notionTokenCrypto.js";

function stateHash(state: string): string { return createHash("sha256").update(state).digest("hex"); }

export function publicConnection(row: NotionConnectionRow, importedPages = 0): NotionConnection {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    workspaceIcon: row.workspace_icon,
    status: row.status,
    scopes: row.scopes,
    connectedAt: row.connected_at.toISOString(),
    lastVerifiedAt: row.last_verified_at?.toISOString() ?? null,
    lastError: row.last_error,
    importedPages,
  };
}

export async function createOauthState(state: string, ownerId: string, returnPath: string): Promise<void> {
  await query(`DELETE FROM ${appTables.notionOauthStates} WHERE expires_at < now() OR used_at < now() - interval '1 day'`);
  await query(
    `INSERT INTO ${appTables.notionOauthStates} (state_hash,owner_id,return_path,expires_at)
     VALUES ($1,$2,$3,now()+interval '10 minutes')`,
    [stateHash(state), ownerId, returnPath],
  );
}

export async function consumeOauthState(state: string): Promise<NotionOauthStateRow | null> {
  return withTransaction(async (client) => {
    const result = await client.query<NotionOauthStateRow>(
      `SELECT * FROM ${appTables.notionOauthStates}
       WHERE state_hash=$1 AND used_at IS NULL AND expires_at>now()
       FOR UPDATE`,
      [stateHash(state)],
    );
    const row = result.rows[0];
    if (!row) return null;
    await client.query(`UPDATE ${appTables.notionOauthStates} SET used_at=now() WHERE state_hash=$1`, [row.state_hash]);
    return row;
  });
}

export async function upsertOauthConnection(input: {
  ownerId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceIcon: string | null;
  botId: string;
  access: EncryptedSecret;
  refresh: EncryptedSecret | null;
  scopes: string[];
}): Promise<NotionConnectionRow> {
  const result = await query<NotionConnectionRow>(
    `INSERT INTO ${appTables.notionConnections}
      (id,owner_id,workspace_id,workspace_name,workspace_icon,bot_id,status,
       access_token_ciphertext,refresh_token_ciphertext,token_iv,token_auth_tag,
       refresh_token_iv,refresh_token_auth_tag,encryption_key_version,scopes,last_verified_at)
     VALUES ($1,$2,$3,$4,$5,$6,'connected',$7,$8,$9,$10,$11,$12,$13,$14,now())
     ON CONFLICT (owner_id,workspace_id) DO UPDATE SET
       workspace_name=EXCLUDED.workspace_name,workspace_icon=EXCLUDED.workspace_icon,bot_id=EXCLUDED.bot_id,
       status='connected',access_token_ciphertext=EXCLUDED.access_token_ciphertext,
       refresh_token_ciphertext=EXCLUDED.refresh_token_ciphertext,token_iv=EXCLUDED.token_iv,
       token_auth_tag=EXCLUDED.token_auth_tag,refresh_token_iv=EXCLUDED.refresh_token_iv,
       refresh_token_auth_tag=EXCLUDED.refresh_token_auth_tag,encryption_key_version=EXCLUDED.encryption_key_version,
       scopes=EXCLUDED.scopes,last_verified_at=now(),last_error=null,revoked_at=null,updated_at=now()
     RETURNING *`,
    [randomUUID(),input.ownerId,input.workspaceId,input.workspaceName,input.workspaceIcon,input.botId,
      input.access.ciphertext,input.refresh?.ciphertext ?? null,input.access.iv,input.access.authTag,
      input.refresh?.iv ?? null,input.refresh?.authTag ?? null,input.access.keyVersion,input.scopes],
  );
  return result.rows[0]!;
}

export async function listConnections(ownerId: string): Promise<Array<{ row: NotionConnectionRow; importedPages: number }>> {
  const result = await query<NotionConnectionRow & { imported_pages: string }>(
    `SELECT connections.*, count(documents.id)::text AS imported_pages
     FROM ${appTables.notionConnections} connections
     LEFT JOIN ${appTables.sourceDocuments} documents ON documents.connection_id=connections.id
     WHERE connections.owner_id=$1
     GROUP BY connections.id
     ORDER BY connections.updated_at DESC`,
    [ownerId],
  );
  return result.rows.map((row) => ({ row, importedPages: Number(row.imported_pages) }));
}

export async function findConnection(id: string, ownerId: string): Promise<NotionConnectionRow | null> {
  const result = await query<NotionConnectionRow>(
    `SELECT * FROM ${appTables.notionConnections} WHERE id=$1 AND owner_id=$2`,
    [id, ownerId],
  );
  return result.rows[0] ?? null;
}

export async function updateConnectionTokens(
  id: string,
  access: EncryptedSecret,
  refresh: EncryptedSecret | null,
): Promise<NotionConnectionRow> {
  const result = await query<NotionConnectionRow>(
    `UPDATE ${appTables.notionConnections} SET status='connected',access_token_ciphertext=$2,
       refresh_token_ciphertext=$3,token_iv=$4,token_auth_tag=$5,refresh_token_iv=$6,
       refresh_token_auth_tag=$7,encryption_key_version=$8,last_verified_at=now(),last_error=null,updated_at=now()
     WHERE id=$1 RETURNING *`,
    [id,access.ciphertext,refresh?.ciphertext ?? null,access.iv,access.authTag,refresh?.iv ?? null,refresh?.authTag ?? null,access.keyVersion],
  );
  return result.rows[0]!;
}

export async function updateConnectionStatus(id: string, status: NotionConnectionRow["status"], error: string | null): Promise<void> {
  await query(
    `UPDATE ${appTables.notionConnections} SET status=$2,last_error=$3,
       revoked_at=CASE WHEN $2='revoked' THEN now() ELSE revoked_at END,updated_at=now() WHERE id=$1`,
    [id, status, error],
  );
}

export async function claimConnectionRefresh(id: string): Promise<NotionConnectionRow | null> {
  const result = await query<NotionConnectionRow>(
    `UPDATE ${appTables.notionConnections}
        SET status='refreshing',last_error=null,updated_at=now()
      WHERE id=$1 AND status <> 'refreshing' AND revoked_at IS NULL
      RETURNING *`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function deleteConnection(id: string, ownerId: string): Promise<void> {
  await query(`DELETE FROM ${appTables.notionConnections} WHERE id=$1 AND owner_id=$2`, [id, ownerId]);
}
