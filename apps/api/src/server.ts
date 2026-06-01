import { createServer } from "node:http";

import { createApp } from "./app.js";
import { apiPort } from "./config/env.js";
import { shutdownAgents } from "./lib/agent.js";

const app = createApp();
const server = createServer(app);

server.listen(apiPort, () => {
  console.log(`MindBloom API listening on http://localhost:${apiPort}`);
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`Received ${signal}; shutting down MindBloom API.`);

  server.close(async (error) => {
    if (error) {
      console.error("HTTP server shutdown failed", error);
      process.exitCode = 1;
    }

    await shutdownAgents();
    process.exit();
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
