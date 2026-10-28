import "dotenv/config";

process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/mindbloom_test";
process.env.OPENAI_API_KEY ??= "test-openai-key";
process.env.CORS_ORIGIN ??= "http://localhost:5173";
process.env.NOTION_TOKEN = "test-notion-token";
process.env.NOTION_CONNECTION_MODE = "hybrid";
process.env.NOTION_OAUTH_CLIENT_ID = "test-notion-client";
process.env.NOTION_OAUTH_CLIENT_SECRET = "test-notion-secret";
process.env.NOTION_OAUTH_REDIRECT_URI = "http://localhost:4000/api/notion/oauth/callback";
process.env.NOTION_TOKEN_ENCRYPTION_KEY = "12345678901234567890123456789012";

const { initializeDb } = await import("../src/config/db.js");
const { authStore } = await import("../src/services/auth.service.js");

await initializeDb();
await authStore.seedDevUsers();
