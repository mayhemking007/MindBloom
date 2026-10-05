import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../http/errors.js";
import { readOwnerScope } from "../http/middleware/requireOwner.js";
import { cancelNotionIngestion, getNotionDocument, getNotionIngestionStatus, importNotionPages, listNotionDocuments, listNotionPages, notionBloom, notionDocumentGraph, relatedThoughts, removeNotionDocument, retryNotionDocument, saveMindBloomDocumentContent, syncNotionDocument, updateNotionDocumentContent } from "../services/notion.service.js";

const idSchema = z.object({ documentId: z.string().uuid() });
const importSchema = z.object({ pageIds: z.array(z.string().trim().min(1)).min(1).max(50) });
const bloomSchema = z.object({
  question: z.string().trim().min(1).max(4000).optional(),
  thoughtId: z.string().trim().min(1).optional(),
}).refine((value) => Boolean(value.question || value.thoughtId), { message: "A question or related thought is required" });
const updateDocumentSchema = z.object({ content: z.string().max(100_000), expectedSourceUpdatedAt: z.string().datetime() });
const saveDocumentSchema = z.object({ content: z.string().max(100_000) });
const syncDocumentSchema = z.object({ discardLocalChanges: z.boolean().optional().default(false) });
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, result.error.issues[0]?.message ?? "Invalid request");
  return result.data;
}

export const notionRouter = Router();
notionRouter.get("/pages", async (req,res) => res.json({ pages: await listNotionPages(await readOwnerScope(req)) }));
notionRouter.post("/import", async (req,res) => {
  const body = parse(importSchema, req.body);
  res.status(207).json({ results: await importNotionPages(body.pageIds, await readOwnerScope(req)) });
});
notionRouter.get("/documents", async (req,res) => res.json({ documents: await listNotionDocuments(await readOwnerScope(req)) }));
notionRouter.get("/documents/:documentId", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  res.json({ document: await getNotionDocument(documentId, await readOwnerScope(req)) });
});
notionRouter.patch("/documents/:documentId", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  const body = parse(saveDocumentSchema, req.body);
  res.json({ document: await saveMindBloomDocumentContent(documentId, body.content, await readOwnerScope(req)) });
});
notionRouter.post("/documents/:documentId/notion", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  const body = parse(updateDocumentSchema, req.body);
  res.json({ document: await updateNotionDocumentContent(documentId, body.content, body.expectedSourceUpdatedAt, await readOwnerScope(req)) });
});
notionRouter.post("/documents/:documentId/sync", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  const body = parse(syncDocumentSchema, req.body ?? {});
  res.json({ document: await syncNotionDocument(documentId, await readOwnerScope(req), body.discardLocalChanges) });
});
notionRouter.get("/documents/:documentId/ingestion", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  res.json({ document: await getNotionIngestionStatus(documentId, await readOwnerScope(req)) });
});
notionRouter.post("/documents/:documentId/ingestion/retry", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  res.json({ document: await retryNotionDocument(documentId, await readOwnerScope(req)) });
});
notionRouter.post("/documents/:documentId/ingestion/cancel", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  res.json({ document: await cancelNotionIngestion(documentId, await readOwnerScope(req)) });
});
notionRouter.delete("/documents/:documentId", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  await removeNotionDocument(documentId, await readOwnerScope(req)); res.status(204).end();
});
notionRouter.get("/documents/:documentId/related", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  res.json({ thoughts: await relatedThoughts(documentId, await readOwnerScope(req)) });
});
notionRouter.post("/documents/:documentId/bloom", async (req,res) => {
  const { documentId } = parse(idSchema, req.params); const body = parse(bloomSchema, req.body);
  res.json(await notionBloom(documentId, body.question, body.thoughtId, await readOwnerScope(req)));
});
notionRouter.get("/documents/:documentId/graph", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  res.json(await notionDocumentGraph(documentId, await readOwnerScope(req)));
});
