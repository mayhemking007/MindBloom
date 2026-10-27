import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../http/errors.js";
import { readAuthenticatedOwner } from "../http/middleware/requireOwner.js";
import { cancelNotionIngestion, exportNotionData, getNotionDocument, getNotionIngestionStatus, listNotionDocuments, listNotionPages, notionBloom, notionDocumentGraph, relatedThoughts, removeNotionDocument, retryNotionDocument, saveMindBloomDocumentContent, syncNotionDocument, updateNotionDocumentContent } from "../services/notion.service.js";
import { cancelNotionImportJob, enqueueNotionImport, getActiveNotionImportJobs, getNotionImportJob } from "../services/notionImportJobs.service.js";
import { deleteNotionBloomAccount } from "../services/notionAccount.service.js";

const idSchema = z.object({ documentId: z.string().uuid() });
const jobIdSchema = z.object({ jobId: z.string().uuid() });
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
notionRouter.get("/pages", async (req,res) => res.json({ pages: await listNotionPages(await readAuthenticatedOwner(req)) }));
notionRouter.delete("/account", async (req, res) => {
  await deleteNotionBloomAccount(await readAuthenticatedOwner(req));
  res.setHeader("Set-Cookie", "mindbloom_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.status(204).end();
});
notionRouter.post("/import", async (req,res) => {
  const body = parse(importSchema, req.body);
  res.status(202).json({ job: await enqueueNotionImport(body.pageIds, await readAuthenticatedOwner(req)) });
});
notionRouter.get("/imports", async (req,res) => res.json({ jobs: await getActiveNotionImportJobs(await readAuthenticatedOwner(req)) }));
notionRouter.get("/imports/:jobId", async (req,res) => {
  const { jobId } = parse(jobIdSchema, req.params);
  res.json({ job: await getNotionImportJob(jobId, await readAuthenticatedOwner(req)) });
});
notionRouter.post("/imports/:jobId/cancel", async (req,res) => {
  const { jobId } = parse(jobIdSchema, req.params);
  res.json({ job: await cancelNotionImportJob(jobId, await readAuthenticatedOwner(req)) });
});
notionRouter.get("/documents", async (req,res) => res.json({ documents: await listNotionDocuments(await readAuthenticatedOwner(req)) }));
notionRouter.get("/export", async (req, res) => {
  const payload = await exportNotionData(await readAuthenticatedOwner(req));
  res.setHeader("Content-Disposition", `attachment; filename=notion-bloom-export-${new Date().toISOString().slice(0, 10)}.json`);
  res.json(payload);
});
notionRouter.get("/documents/:documentId", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  res.json({ document: await getNotionDocument(documentId, await readAuthenticatedOwner(req)) });
});
notionRouter.patch("/documents/:documentId", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  const body = parse(saveDocumentSchema, req.body);
  res.json({ document: await saveMindBloomDocumentContent(documentId, body.content, await readAuthenticatedOwner(req)) });
});
notionRouter.post("/documents/:documentId/notion", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  const body = parse(updateDocumentSchema, req.body);
  res.json({ document: await updateNotionDocumentContent(documentId, body.content, body.expectedSourceUpdatedAt, await readAuthenticatedOwner(req)) });
});
notionRouter.post("/documents/:documentId/sync", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  const body = parse(syncDocumentSchema, req.body ?? {});
  res.json({ document: await syncNotionDocument(documentId, await readAuthenticatedOwner(req), body.discardLocalChanges) });
});
notionRouter.get("/documents/:documentId/ingestion", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  res.json({ document: await getNotionIngestionStatus(documentId, await readAuthenticatedOwner(req)) });
});
notionRouter.post("/documents/:documentId/ingestion/retry", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  res.json({ document: await retryNotionDocument(documentId, await readAuthenticatedOwner(req)) });
});
notionRouter.post("/documents/:documentId/ingestion/cancel", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  res.json({ document: await cancelNotionIngestion(documentId, await readAuthenticatedOwner(req)) });
});
notionRouter.delete("/documents/:documentId", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  await removeNotionDocument(documentId, await readAuthenticatedOwner(req)); res.status(204).end();
});
notionRouter.get("/documents/:documentId/related", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  res.json({ thoughts: await relatedThoughts(documentId, await readAuthenticatedOwner(req)) });
});
notionRouter.post("/documents/:documentId/bloom", async (req,res) => {
  const { documentId } = parse(idSchema, req.params); const body = parse(bloomSchema, req.body);
  res.json(await notionBloom(documentId, body.question, body.thoughtId, await readAuthenticatedOwner(req)));
});
notionRouter.get("/documents/:documentId/graph", async (req,res) => {
  const { documentId } = parse(idSchema, req.params);
  res.json(await notionDocumentGraph(documentId, await readAuthenticatedOwner(req)));
});
