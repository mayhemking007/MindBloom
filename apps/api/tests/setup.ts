import "dotenv/config";

process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/mindbloom_test";
process.env.OPENAI_API_KEY ??= "test-openai-key";
process.env.CORS_ORIGIN ??= "http://localhost:5173";

const { initializeDb } = await import("../src/config/db.js");
const { authStore } = await import("../src/services/auth.service.js");

await initializeDb();
await authStore.seedDevUsers();
