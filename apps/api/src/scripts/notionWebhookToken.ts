import { closeDb, initializeDb } from "../config/db.js";
import { readWebhookVerificationToken } from "../repositories/notionWebhooks.repository.js";
import { decryptNotionSecret } from "../services/notionTokenCrypto.js";

await initializeDb();
try {
  const token = await readWebhookVerificationToken();
  if (!token) throw new Error("No Notion webhook verification token has been received yet.");
  process.stdout.write(`${decryptNotionSecret(token)}\n`);
} finally {
  await closeDb();
}
