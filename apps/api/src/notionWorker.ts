import { closeDb, initializeDb } from "./config/db.js";
import { shutdownMemoGrafters } from "./memo-grafter/memoGrafter.js";
import { recoverInterruptedImportJobs } from "./repositories/notionImportJobs.repository.js";
import { processNextNotionImportJob } from "./services/notionImportJobs.service.js";

let stopping = false;
const pollIntervalMs = 1_000;

await initializeDb();
const recovered = await recoverInterruptedImportJobs();
console.log(JSON.stringify({ level: "info", service: "notion-bloom-worker", event: "started", recoveredJobs: recovered }));

async function loop(): Promise<void> {
  while (!stopping) {
    try {
      const processed = await processNextNotionImportJob();
      if (!processed) await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (error) {
      console.error(JSON.stringify({ level: "error", service: "notion-bloom-worker", event: "loop_failed", message: error instanceof Error ? error.message : String(error) }));
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(JSON.stringify({ level: "info", service: "notion-bloom-worker", event: "shutdown", signal }));
  await shutdownMemoGrafters();
  await closeDb();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await loop();
