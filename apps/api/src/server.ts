import { createServer } from "node:http";

import { createApp } from "./app.js";
import { apiPort } from "./config/env.js";
import { closeDb, initializeDb } from "./config/db.js";
import { shutdownMemoGrafters } from "./memo-grafter/memoGrafter.js";
import { authStore } from "./services/auth.service.js";

const app = createApp();
const server = createServer(app);

await initializeDb();
await authStore.seedDevUsers();

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${apiPort} is already in use. Stop the existing API process or set API_PORT to another port.`,
    );
  } else {
    console.error("MindBloom API server failed", error);
  }

  void cleanup().finally(() => {
    process.exitCode = 1;
    process.exit();
  });
});

server.listen(apiPort, () => {
  console.log(`MindBloom API listening on http://localhost:${apiPort}`);
});

async function cleanup(): Promise<void> {
  await shutdownMemoGrafters();
  await closeDb();
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`Received ${signal}; shutting down MindBloom API.`);

  server.close(async (error) => {
    if (error) {
      console.error("HTTP server shutdown failed", error);
      process.exitCode = 1;
    }

    await cleanup();
    process.exit();
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
