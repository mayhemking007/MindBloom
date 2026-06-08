import { z } from "zod";
import type { EntryOwnerKind, JournalEntry } from "@mindbloom/shared";

import { readCookie } from "./cookies.js";
import { ApiError } from "./errors.js";
import { entryStore, type OwnerScope } from "../lib/entryStore.js";
import { authStore, sessionCookieName } from "../lib/authStore.js";

const ownerKindSchema = z.enum(["authenticated", "demo"]);

const entryIdParamSchema = z.object({
  entryId: z.string().trim().min(1, "entryId is required").max(128),
});

export function readOwnerScope(req: {
  get(name: string): string | undefined;
}): OwnerScope {
  const sessionUser = authStore.getUserForToken(
    readCookie(req.get("cookie"), sessionCookieName),
  );
  if (sessionUser) {
    return {
      ownerId: sessionUser.id,
      ownerKind: "authenticated",
    };
  }

  const parsedOwnerKind = ownerKindSchema.safeParse(
    req.get("x-mindbloom-owner-kind") ?? "demo",
  );
  if (!parsedOwnerKind.success) {
    throw new ApiError(
      400,
      "x-mindbloom-owner-kind must be authenticated or demo",
    );
  }

  const ownerKind: EntryOwnerKind = parsedOwnerKind.data;
  const ownerId = req.get("x-mindbloom-owner-id")?.trim();
  if (ownerKind === "authenticated" && !ownerId) {
    throw new ApiError(
      400,
      "x-mindbloom-owner-id is required for authenticated requests",
    );
  }

  return {
    ownerId: ownerId || "demo-local",
    ownerKind,
  };
}

export function parseEntryId(params: unknown): string {
  const parsed = entryIdParamSchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid route params",
    );
  }

  return parsed.data.entryId;
}

export function getEntryForOwner(
  entryId: string,
  owner: OwnerScope,
): JournalEntry {
  const entry = entryStore.getEntry(entryId);
  if (!entry) {
    throw new ApiError(404, "Entry not found");
  }
  if (entry.ownerId !== owner.ownerId || entry.ownerKind !== owner.ownerKind) {
    throw new ApiError(403, "Entry does not belong to this user");
  }

  return entry;
}
