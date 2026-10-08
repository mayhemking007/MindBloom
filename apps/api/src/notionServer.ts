import { createServer } from "node:http";

import { closeDb, initializeDb } from "./config/db.js";
import { notionApiPort } from "./config/env.js";
import { createNotionBloomApp } from "./notionApp.js";
import { shutdownMemoGrafters } from "./memo-grafter/memoGrafter.js";
import { authStore } from "./services/auth.service.js";

const server = createServer(createNotionBloomApp());

await initializeDb();
await authStore.seedDevUsers();

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${notionApiPort} is already in use. Stop that process or set NOTION_API_PORT.`);
  } else {
    console.error("Notion Bloom API server failed", error);
  }
  void cleanup().finally(() => {
    process.exitCode = 1;
    process.exit();
  });
});

server.listen(notionApiPort, () => {
  console.log(`Notion Bloom API listening on http://localhost:${notionApiPort}`);
});

async function cleanup(): Promise<void> {
  await shutdownMemoGrafters();
  await closeDb();
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`Received ${signal}; shutting down Notion Bloom API.`);
  server.close(async (error) => {
    if (error) {
      console.error("Notion Bloom API shutdown failed", error);
      process.exitCode = 1;
    }
    await cleanup();
    process.exit();
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
