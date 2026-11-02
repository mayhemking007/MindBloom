import { signWebhookPayload } from "@notionhq/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  debounceRefreshJob: vi.fn(), documentsForWebhook: vi.fn(), finishWebhookEvent: vi.fn(),
  acceptSourceDocumentWebhook: vi.fn(),
  readWebhookVerificationToken: vi.fn(), recordWebhookEvent: vi.fn(), storeWebhookVerificationToken: vi.fn(),
}));
vi.mock("../src/repositories/notionWebhooks.repository.js", () => repository);

import { encryptNotionSecret } from "../src/services/notionTokenCrypto.js";
import { handleNotionWebhook } from "../src/services/notionWebhooks.service.js";

describe("Notion webhook handling", () => {
  beforeEach(() => {
    repository.readWebhookVerificationToken.mockResolvedValue(encryptNotionSecret("webhook-secret"));
    repository.recordWebhookEvent.mockResolvedValue(true);
    repository.documentsForWebhook.mockResolvedValue([]);
    repository.acceptSourceDocumentWebhook.mockResolvedValue(true);
    repository.finishWebhookEvent.mockResolvedValue(undefined);
  });

  it("validates the raw body and records a page update once", async () => {
    const body = Buffer.from(JSON.stringify({ id: "event-1", type: "page.content_updated", workspace_id: "workspace-1", entity: { id: "page-1" } }));
    const signature = await signWebhookPayload({ body, verificationToken: "webhook-secret" });
    await expect(handleNotionWebhook(body, signature)).resolves.toEqual({ queued: 0 });
    expect(repository.recordWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({ id: "event-1", workspaceId: "workspace-1", entityId: "page-1" }));
  });

  it("rejects a payload with an invalid signature", async () => {
    const body = Buffer.from(JSON.stringify({ id: "event-2", type: "page.content_updated" }));
    await expect(handleNotionWebhook(body, "sha256=invalid")).rejects.toMatchObject({ statusCode: 401 });
    expect(repository.recordWebhookEvent).not.toHaveBeenCalled();
  });
});
