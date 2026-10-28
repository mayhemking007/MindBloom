import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "../config/env.js";
import { ApiError } from "../http/errors.js";

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
}

function encryptionKey(): Buffer {
  const configured = env.NOTION_TOKEN_ENCRYPTION_KEY;
  if (!configured) throw new ApiError(503, "Notion OAuth token encryption is not configured");
  const value = configured.startsWith("base64:")
    ? Buffer.from(configured.slice(7), "base64")
    : configured.startsWith("hex:")
      ? Buffer.from(configured.slice(4), "hex")
      : Buffer.from(configured, "utf8");
  if (value.length !== 32) throw new ApiError(503, "NOTION_TOKEN_ENCRYPTION_KEY must contain exactly 32 bytes");
  return value;
}

export function encryptNotionSecret(secret: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    keyVersion: env.NOTION_TOKEN_ENCRYPTION_KEY_VERSION,
  };
}

export function decryptNotionSecret(secret: Pick<EncryptedSecret, "ciphertext" | "iv" | "authTag" | "keyVersion">): string {
  if (secret.keyVersion !== env.NOTION_TOKEN_ENCRYPTION_KEY_VERSION) {
    throw new ApiError(503, `Notion token key version ${secret.keyVersion} is not available`);
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(secret.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(secret.authTag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(secret.ciphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new ApiError(503, "Stored Notion credentials could not be decrypted");
  }
}
