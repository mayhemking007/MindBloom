import type { RequestHandler } from "express";
import { handleNotionWebhook } from "../services/notionWebhooks.service.js";

export const notionWebhookHandler: RequestHandler = (req, res, next) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  void handleNotionWebhook(rawBody, req.get("x-notion-signature") ?? undefined)
    .then((result) => res.status(200).json({ ok: true, ...result }))
    .catch(next);
};
