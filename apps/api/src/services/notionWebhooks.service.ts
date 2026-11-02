import { verifyWebhookSignature } from "@notionhq/client";
import { env } from "../config/env.js";
import { ApiError } from "../http/errors.js";
import {
  debounceRefreshJob, documentsForWebhook, finishWebhookEvent, readWebhookVerificationToken,
  recordWebhookEvent, storeWebhookVerificationToken,
} from "../repositories/notionWebhooks.repository.js";
import { decryptNotionSecret, encryptNotionSecret } from "./notionTokenCrypto.js";
import { acceptSourceDocumentWebhook, markSourceDocumentSyncState } from "../repositories/sourceDocuments.repository.js";

type WebhookPayload = {
  id?: string;
  type?: string;
  workspace_id?: string;
  entity?: { id?: string };
  verification_token?: string;
  timestamp?: string;
};

export async function handleNotionWebhook(rawBody: Buffer, signature: string | undefined): Promise<{ duplicate?: boolean; verification?: boolean; queued?: number }> {
  let payload: WebhookPayload;
  try { payload = JSON.parse(rawBody.toString("utf8")) as WebhookPayload; }
  catch { throw new ApiError(400, "Invalid Notion webhook payload"); }

  if (payload.verification_token) {
    if (!env.NOTION_WEBHOOK_SETUP_ENABLED) throw new ApiError(403, "Webhook subscription setup is disabled");
    if (await readWebhookVerificationToken()) throw new ApiError(409, "A webhook verification token is already configured");
    await storeWebhookVerificationToken(encryptNotionSecret(payload.verification_token));
    return { verification: true };
  }

  const encryptedToken = await readWebhookVerificationToken();
  if (!encryptedToken) throw new ApiError(503, "Notion webhook verification is not configured");
  if (!signature || !(await verifyWebhookSignature({ body: rawBody, signature, verificationToken: decryptNotionSecret(encryptedToken) }))) {
    throw new ApiError(401, "Invalid Notion webhook signature");
  }
  if (!payload.id || !payload.type) throw new ApiError(400, "Notion webhook event is missing its id or type");
  const entityId = payload.entity?.id ?? null;
  const workspaceId = payload.workspace_id ?? null;
  const inserted = await recordWebhookEvent({ id: payload.id, type: payload.type, workspaceId, entityId, payload });
  if (!inserted) return { duplicate: true, queued: 0 };
  const refreshTypes = new Set(["page.content_updated", "page.properties_updated", "page.undeleted", "page.moved"]);
  if ((!refreshTypes.has(payload.type) && payload.type !== "page.deleted") || !workspaceId || !entityId) {
    await finishWebhookEvent(payload.id, "ignored");
    return { queued: 0 };
  }
  try {
    const documents = await documentsForWebhook(workspaceId, entityId);
    const eventTime = payload.timestamp && !Number.isNaN(Date.parse(payload.timestamp)) ? new Date(payload.timestamp) : new Date();
    const accepted: typeof documents = [];
    for (const document of documents) if (await acceptSourceDocumentWebhook(document.id, eventTime)) accepted.push(document);
    if (payload.type === "page.deleted") {
      await Promise.all(accepted.map((document) => markSourceDocumentSyncState(document.id, { unavailable: true, error: "This page was moved to the Notion trash." })));
      await finishWebhookEvent(payload.id, accepted.length ? "queued" : "ignored");
      return { queued: 0 };
    }
    const availableAt = new Date(Date.now() + env.NOTION_WEBHOOK_DEBOUNCE_SECONDS * 1_000);
    await Promise.all(accepted.map((document) => debounceRefreshJob(document, payload.id!, availableAt)));
    await finishWebhookEvent(payload.id, accepted.length ? "queued" : "ignored");
    return { queued: accepted.length };
  } catch (error) {
    await finishWebhookEvent(payload.id, "failed", error instanceof Error ? error.message : "Webhook scheduling failed");
    throw error;
  }
}
