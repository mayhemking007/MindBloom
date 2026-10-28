# Notion Bloom OAuth deployment

Notion Bloom runs as three independently deployable processes backed by one managed PostgreSQL database:

- `@mindbloom/notion-web` — static Vite frontend
- `npm run start:notion-api` — authenticated API and OAuth callback
- `npm run start:notion-worker` — persistent import worker

## Create the Notion integration

Create a public Notion integration and add the exact callback URL `https://<api-domain>/api/notion/oauth/callback`. Copy its OAuth client ID and secret. Request read content, update content, and user-information capabilities; users still choose which pages the connection can access.

## Required settings

Set these on both the API and worker unless a setting is described as API-only:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `NOTION_CONNECTION_MODE=oauth`
- `NOTION_OAUTH_CLIENT_ID`
- `NOTION_OAUTH_CLIENT_SECRET`
- `NOTION_OAUTH_REDIRECT_URI` — the exact callback registered in Notion
- `NOTION_TOKEN_ENCRYPTION_KEY` — exactly 32 random bytes, or `base64:<32-byte-base64>`
- `NOTION_TOKEN_ENCRYPTION_KEY_VERSION=v1`
- `NOTION_CONTENT_API=markdown`
- `NOTION_MAX_PAGES_PER_IMPORT=25`
- `NOTION_DAILY_IMPORT_PAGE_LIMIT=250`

The API also needs `NOTION_CORS_ORIGIN`, set to the exact frontend origin (comma-separated origins are supported), and the registration settings. Keep the encryption key and version identical on the API and worker. Never expose the client secret or encryption key to Vite.

For a controlled migration, use `NOTION_CONNECTION_MODE=hybrid` and keep `NOTION_TOKEN`; legacy documents remain available while users connect their own workspaces. Switch to `oauth` and remove `NOTION_TOKEN` after migration. Existing legacy rows intentionally keep a null connection ID.

## Domain and cookies

Use sibling custom domains such as `app.notionbloom.example` and `api.notionbloom.example`, or proxy `/api` through the frontend domain. Unrelated default domains will not receive the `SameSite=Lax` session cookie. The OAuth callback must use the API’s public HTTPS domain.

## Deploy and verify

1. Provision PostgreSQL with backups and `pgvector` enabled.
2. Generate the token-encryption key and store it in the platform secret manager.
3. Deploy API and worker with identical database, OAuth, encryption, OpenAI, and MemoGrafter settings.
4. Run the MemoGrafter migration command.
5. Deploy the frontend with `VITE_PRODUCT=notion-bloom` and `VITE_API_BASE_URL`.
6. Verify `/health/live` and `/health/ready`; readiness reports the selected connection mode.
7. Connect two test workspaces, import a page from each, and confirm workspace switching does not mix documents.
8. Revoke one connection in Notion and confirm Notion Bloom reports that reconnection is required without exposing credentials.

OAuth access and refresh tokens are encrypted with AES-256-GCM before storage. Rotating the encryption key requires a re-encryption migration; changing only the version makes old credentials intentionally unreadable.
