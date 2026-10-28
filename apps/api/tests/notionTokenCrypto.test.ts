import { describe, expect, it } from "vitest";
import { decryptNotionSecret, encryptNotionSecret } from "../src/services/notionTokenCrypto.js";

describe("Notion credential encryption", () => {
  it("round-trips OAuth credentials without storing plaintext", () => {
    const encrypted = encryptNotionSecret("secret-access-token");
    expect(encrypted.ciphertext).not.toContain("secret-access-token");
    expect(decryptNotionSecret(encrypted)).toBe("secret-access-token");
  });

  it("rejects modified ciphertext", () => {
    const encrypted = encryptNotionSecret("secret-access-token");
    const replacement = encrypted.ciphertext.startsWith("A") ? "B" : "A";
    expect(() => decryptNotionSecret({ ...encrypted, ciphertext: `${replacement}${encrypted.ciphertext.slice(1)}` })).toThrow();
  });
});
