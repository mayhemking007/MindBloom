import { randomBytes } from "node:crypto";
import { NotionIntegration, NotionOAuthClient, type NotionOAuthToken } from "@mindbloom/integrations";
import type { NotionConnection } from "@mindbloom/shared";
import { APIErrorCode, isNotionClientError } from "@notionhq/client";

import { env } from "../config/env.js";
import { ApiError } from "../http/errors.js";
import {
  consumeOauthState,
  claimConnectionRefresh,
  createOauthState,
  findConnection,
  listConnections,
  publicConnection,
  updateConnectionStatus,
  updateConnectionTokens,
  upsertOauthConnection,
} from "../repositories/notionConnections.repository.js";
import type { NotionConnectionRow } from "../db/schema.js";
import type { OwnerScope } from "./entries.service.js";
import { decryptNotionSecret, encryptNotionSecret } from "./notionTokenCrypto.js";

function oauthClient(): NotionOAuthClient {
  if (!env.NOTION_OAUTH_CLIENT_ID || !env.NOTION_OAUTH_CLIENT_SECRET || !env.NOTION_OAUTH_REDIRECT_URI) {
    throw new ApiError(503, "Notion OAuth is not configured");
  }
  return new NotionOAuthClient({
    clientId: env.NOTION_OAUTH_CLIENT_ID,
    clientSecret: env.NOTION_OAUTH_CLIENT_SECRET,
    redirectUri: env.NOTION_OAUTH_REDIRECT_URI,
  });
}

function requireAuthenticated(owner: OwnerScope): string {
  if (owner.ownerKind !== "authenticated") throw new ApiError(401, "Authentication is required");
  return owner.ownerId;
}

function encryptedTokens(token: NotionOAuthToken) {
  return {
    access: encryptNotionSecret(token.access_token),
    refresh: token.refresh_token ? encryptNotionSecret(token.refresh_token) : null,
  };
}

function accessToken(row: NotionConnectionRow): string {
  return decryptNotionSecret({
    ciphertext: row.access_token_ciphertext,
    iv: row.token_iv,
    authTag: row.token_auth_tag,
    keyVersion: row.encryption_key_version,
  });
}

function refreshToken(row: NotionConnectionRow): string | null {
  if (!row.refresh_token_ciphertext || !row.refresh_token_iv || !row.refresh_token_auth_tag) return null;
  return decryptNotionSecret({
    ciphertext: row.refresh_token_ciphertext,
    iv: row.refresh_token_iv,
    authTag: row.refresh_token_auth_tag,
    keyVersion: row.encryption_key_version,
  });
}

export async function getNotionConnections(owner: OwnerScope): Promise<{ connections: NotionConnection[]; legacyInternalAvailable: boolean }> {
  const ownerId = requireAuthenticated(owner);
  const connections = await listConnections(ownerId);
  return {
    connections: connections.map(({ row, importedPages }) => publicConnection(row, importedPages)),
    legacyInternalAvailable: env.NOTION_CONNECTION_MODE !== "oauth" && Boolean(env.NOTION_TOKEN),
  };
}

export async function startNotionOAuth(owner: OwnerScope, returnPath = "/notion"): Promise<string> {
  const ownerId = requireAuthenticated(owner);
  const safeReturnPath = /^\/notion(?:[/?#].*)?$/.test(returnPath) ? returnPath : "/notion";
  const state = randomBytes(32).toString("base64url");
  await createOauthState(state, ownerId, safeReturnPath);
  return oauthClient().authorizationUrl(state);
}

export async function completeNotionOAuth(code: string, state: string): Promise<{ connection: NotionConnection; returnPath: string }> {
  const oauthState = await consumeOauthState(state);
  if (!oauthState) throw new ApiError(400, "This Notion authorization request is invalid, expired, or already used");
  let token: NotionOAuthToken;
  try { token = await oauthClient().exchangeCode(code); }
  catch { throw new ApiError(400, "Notion authorization could not be completed. Start the connection again."); }
  const encrypted = encryptedTokens(token);
  let scopes: string[] = [];
  try {
    const introspection = await oauthClient().introspect(token.access_token);
    scopes = introspection.scope?.split(/[ ,]+/).filter(Boolean) ?? [];
  } catch { /* Connection is still usable; health verification can retry. */ }
  const row = await upsertOauthConnection({
    ownerId: oauthState.owner_id,
    workspaceId: token.workspace_id,
    workspaceName: token.workspace_name ?? "Notion workspace",
    workspaceIcon: token.workspace_icon,
    botId: token.bot_id,
    access: encrypted.access,
    refresh: encrypted.refresh,
    scopes,
  });
  return { connection: publicConnection(row), returnPath: oauthState.return_path };
}

export async function getOwnedConnection(connectionId: string, owner: OwnerScope): Promise<NotionConnectionRow> {
  const row = await findConnection(connectionId, requireAuthenticated(owner));
  if (!row) throw new ApiError(404, "Notion workspace connection not found");
  return row;
}

export async function notionClientFor(owner: OwnerScope, connectionId?: string | null): Promise<{ client: NotionIntegration; connection: NotionConnectionRow | null }> {
  if (!connectionId) {
    if (env.NOTION_CONNECTION_MODE === "oauth" || !env.NOTION_TOKEN) throw new ApiError(400, "Choose a connected Notion workspace");
    return { client: new NotionIntegration(env.NOTION_TOKEN, { contentApi: env.NOTION_CONTENT_API }), connection: null };
  }
  const connection = await getOwnedConnection(connectionId, owner);
  if (connection.status !== "connected") throw new ApiError(409, "This Notion workspace must be reconnected before it can be used");
  return { client: new NotionIntegration(accessToken(connection), { contentApi: env.NOTION_CONTENT_API }), connection };
}

export async function withNotionClient<T>(
  owner: OwnerScope,
  connectionId: string | null | undefined,
  operation: (client: NotionIntegration) => Promise<T>,
): Promise<T> {
  const resolved = await notionClientFor(owner, connectionId);
  try { return await operation(resolved.client); }
  catch (error) {
    if (!resolved.connection || !isNotionClientError(error) || error.code !== APIErrorCode.Unauthorized) throw error;
    const refreshed = await refreshNotionConnection(resolved.connection.id, owner);
    const retryClient = new NotionIntegration(accessToken(refreshed), { contentApi: env.NOTION_CONTENT_API });
    return operation(retryClient);
  }
}

export async function refreshNotionConnection(connectionId: string, owner: OwnerScope): Promise<NotionConnectionRow> {
  let connection = await getOwnedConnection(connectionId, owner);
  if (connection.status === "revoked") throw new ApiError(409, "This Notion workspace was disconnected. Connect it again to continue.");
  const claimed = await claimConnectionRefresh(connection.id);
  if (!claimed) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      connection = await getOwnedConnection(connectionId, owner);
      if (connection.status === "connected") return connection;
      if (connection.status === "reauthorization_required" || connection.status === "revoked") {
        throw new ApiError(401, "Reconnect this Notion workspace to continue");
      }
    }
    throw new ApiError(409, "This Notion workspace is already refreshing. Try again in a moment.");
  }
  connection = claimed;
  const refresh = refreshToken(connection);
  if (!refresh) {
    await updateConnectionStatus(connection.id, "reauthorization_required", "Notion did not provide a refresh token");
    throw new ApiError(401, "Reconnect this Notion workspace to continue");
  }
  try {
    const token = await oauthClient().refresh(refresh);
    const encrypted = encryptedTokens(token);
    return updateConnectionTokens(connection.id, encrypted.access, encrypted.refresh ?? encryptNotionSecret(refresh));
  } catch {
    await updateConnectionStatus(connection.id, "reauthorization_required", "Notion rejected the refresh credential");
    throw new ApiError(401, "Reconnect this Notion workspace to continue");
  }
}

export async function verifyNotionConnection(connectionId: string, owner: OwnerScope): Promise<NotionConnection> {
  let connection = await getOwnedConnection(connectionId, owner);
  if (connection.status === "revoked") throw new ApiError(409, "This Notion workspace was disconnected. Connect it again to continue.");
  try {
    let result;
    try { result = await oauthClient().introspect(accessToken(connection)); }
    catch {
      connection = await refreshNotionConnection(connection.id, owner);
      result = await oauthClient().introspect(accessToken(connection));
    }
    if (!result.active) {
      connection = await refreshNotionConnection(connection.id, owner);
      result = await oauthClient().introspect(accessToken(connection));
    }
    if (!result.active) throw new Error("inactive");
    await updateConnectionStatus(connection.id, "connected", null);
    return publicConnection({ ...connection, status: "connected", last_verified_at: new Date(), last_error: null });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    await updateConnectionStatus(connection.id, "reauthorization_required", "Notion connection verification failed");
    throw new ApiError(401, "Reconnect this Notion workspace to continue");
  }
}

export async function disconnectNotionConnection(connectionId: string, owner: OwnerScope): Promise<void> {
  const connection = await getOwnedConnection(connectionId, owner);
  try { await oauthClient().revoke(accessToken(connection)); }
  catch { /* Local revocation still prevents further use. */ }
  await updateConnectionStatus(connection.id, "revoked", null);
}
