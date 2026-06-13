import { Router } from "express";
import { z } from "zod";
import type {
  PublicReflectionShareResponse,
  ReflectionShareLinkResponse,
  ReflectionShareLinksResponse,
} from "@mindbloom/shared";

import { ApiError } from "../http/errors.js";
import { readOwnerScope } from "../http/middleware/requireOwner.js";
import { entryStore, type OwnerScope } from "../services/entries.service.js";

const reflectionIdParamSchema = z.object({
  reflectionId: z.string().trim().min(1, "reflectionId is required").max(128),
});

const shareLinkIdParamSchema = z.object({
  shareLinkId: z.string().trim().min(1, "shareLinkId is required").max(128),
});

const shareTokenParamSchema = z.object({
  token: z.string().trim().min(16, "token is required").max(160),
});

const createShareLinkSchema = z.object({
  selectedCardIds: z
    .array(z.string().trim().min(1).max(80))
    .min(1, "Select at least one card")
    .max(12),
  expiresAt: z.string().datetime().nullable().optional(),
});

function parseReflectionId(params: unknown): string {
  const parsed = reflectionIdParamSchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid route params",
    );
  }

  return parsed.data.reflectionId;
}

function parseShareLinkId(params: unknown): string {
  const parsed = shareLinkIdParamSchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid route params",
    );
  }

  return parsed.data.shareLinkId;
}

function parseToken(params: unknown): string {
  const parsed = shareTokenParamSchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid route params",
    );
  }

  return parsed.data.token;
}

async function getReflectionForOwner(reflectionId: string, owner: OwnerScope) {
  if (owner.ownerKind !== "authenticated") {
    throw new ApiError(403, "Sign in to share reflections");
  }

  const reflection = await entryStore.getReflection(reflectionId);
  if (!reflection) {
    throw new ApiError(404, "Reflection not found");
  }

  const entry = await entryStore.getEntry(reflection.entryId);
  if (!entry) {
    throw new ApiError(404, "Entry not found");
  }
  if (entry.ownerId !== owner.ownerId || entry.ownerKind !== owner.ownerKind) {
    throw new ApiError(403, "Reflection does not belong to this user");
  }

  return reflection;
}

function isExpired(expiresAt: string | null): boolean {
  return Boolean(expiresAt && Date.parse(expiresAt) <= Date.now());
}

export const shareRouter = Router();

shareRouter.post("/reflections/:reflectionId/share-links", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const reflection = await getReflectionForOwner(parseReflectionId(req.params), owner);
    const parsed = createShareLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid body",
      );
    }

    const validCardIds = new Set(reflection.cards.map((card) => card.id));
    const invalidCardId = parsed.data.selectedCardIds.find(
      (cardId) => !validCardIds.has(cardId),
    );
    if (invalidCardId) {
      throw new ApiError(400, `Unknown reflection card: ${invalidCardId}`);
    }

    const shareLink = await entryStore.createShareLink({
      reflectionId: reflection.id,
      selectedCardIds: [...new Set(parsed.data.selectedCardIds)],
      expiresAt: parsed.data.expiresAt ?? null,
    });
    const response: ReflectionShareLinkResponse = { shareLink };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

shareRouter.get("/reflections/:reflectionId/share-links", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const reflection = await getReflectionForOwner(parseReflectionId(req.params), owner);
    const response: ReflectionShareLinksResponse = {
      shareLinks: await entryStore.listShareLinks(reflection.id),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

shareRouter.delete("/share-links/:shareLinkId", async (req, res, next) => {
  try {
    const owner = await readOwnerScope(req);
    const shareLinkId = parseShareLinkId(req.params);
    const shareLink = await entryStore.getShareLink(shareLinkId);
    if (!shareLink) {
      throw new ApiError(404, "Share link not found");
    }

    await getReflectionForOwner(shareLink.reflectionId, owner);
    await entryStore.revokeShareLink(shareLink.id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

shareRouter.get("/share/:token", async (req, res, next) => {
  try {
    const token = parseToken(req.params);
    const shareLink = await entryStore.getShareLinkByToken(token);
    if (!shareLink || shareLink.revokedAt || isExpired(shareLink.expiresAt)) {
      throw new ApiError(404, "Shared reflection not found");
    }

    const reflection = await entryStore.getReflection(shareLink.reflectionId);
    if (!reflection) {
      throw new ApiError(404, "Shared reflection not found");
    }

    const selectedCardIds = new Set(shareLink.selectedCardIds);
    const response: PublicReflectionShareResponse = {
      token: shareLink.token,
      cards: reflection.cards.filter((card) => selectedCardIds.has(card.id)),
      createdAt: shareLink.createdAt,
      expiresAt: shareLink.expiresAt,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});
