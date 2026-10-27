# Notion Bloom private-beta deployment

Notion Bloom runs as three independently deployable processes backed by one managed PostgreSQL database:

- `@mindbloom/notion-web` — static Vite frontend
- `npm run start:notion-api` — authenticated HTTP API
- `npm run start:notion-worker` — persistent import worker

## Required secrets

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `NOTION_TOKEN` for the single private-beta workspace
- `NOTION_CORS_ORIGIN`, set to the exact frontend origin (comma-separated origins are supported)
- `NOTION_INVITE_EMAILS`, set to the comma-separated beta email allowlist

Set `NODE_ENV=production` and `NOTION_REGISTRATION_ENABLED=true` when using an invite allowlist. Set registration to `false` to close all new signup.

## Domain and cookies

Use sibling custom domains such as `app.notionbloom.example` and `api.notionbloom.example`, or proxy `/api` through the frontend domain. Do not use unrelated Vercel and Render default domains in production: the `SameSite=Lax` session cookie is intentionally not sent cross-site.

## Deploy order

1. Provision PostgreSQL with backups enabled.
2. Deploy the API and worker with identical database, Notion, OpenAI, and MemoGrafter settings.
3. Run the MemoGrafter migration command.
4. Deploy the frontend using `vercel.notion.json` and set `VITE_PRODUCT=notion-bloom` plus `VITE_API_BASE_URL`.
5. Verify `/health/live` and `/health/ready`.
6. Register an allowlisted tester, import one page, close the browser, and verify that the worker completes it.

The Phase 1 connection is deliberately single-workspace. Do not invite users from unrelated Notion workspaces until per-user OAuth is implemented.
