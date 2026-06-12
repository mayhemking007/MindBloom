# MindBloom

MindBloom is a journal-first writing app and TypeScript example for `memo-grafter`.
It gives people a calm place to write, capture notes, brainstorm with the optional
Bloom assistant, explore recurring themes in a mind map, and share generated
reflection cards.

The project is a small npm workspace with an Express API, a React/Vite web app,
and shared TypeScript types.

## Features

- Classic journal writing with memory ingestion through `memo-grafter`.
- Bloom assistant for conversational reflection and brainstorming.
- Notes, saved Bloom cards, calendar/timeline views, and daily writing flows.
- Mind map and graph snapshots built from active memory nodes.
- Entry reflections and public share links.
- Mock-friendly test suites for API, web, and Playwright smoke coverage.

## Workspace Layout

```text
apps/
  api/        Express API, OpenAI integration, persistence, routes, and memory calls
  web/        React 19 + Vite frontend
packages/
  shared/     Shared types and utilities used by API and web
docs/         Deployment notes
e2e/          Playwright tests
scripts/      Repo-level checks
```

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL with `pgvector` enabled, or a Neon database
- OpenAI API key for real Bloom, embedding, note, and reflection generation

The unit tests use mocks, so they do not require Postgres, `pgvector`, or an
OpenAI key.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

On Windows PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

3. Configure `apps/api/.env`:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mindbloom
OPENAI_API_KEY=sk-...
API_PORT=4000
CORS_ORIGIN=http://localhost:5173
```

4. Configure `apps/web/.env`:

```env
VITE_API_BASE_URL=http://localhost:4000
```

5. Enable `pgvector` in your database:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

6. Start both apps:

```bash
npm run dev
```

By default, the API runs at `http://localhost:4000` and the web app runs at
`http://localhost:5173`.

## Useful Scripts

```bash
npm run dev              # Start API and web app together
npm run dev:api          # Start only the Express API
npm run dev:web          # Start only the Vite app
npm run build            # Build all workspaces
npm run typecheck        # Type-check the repo
npm run lint             # Run workspace lint/type checks
npm test                 # Run workspace unit tests
npm run test:e2e         # Run Playwright tests
npm run check:boundaries # Ensure frontend does not import backend-only code
```

## Testing

For the full local verification pass:

```bash
npm run typecheck
npm run lint
npm test
npm run check:boundaries
npm run build
npm run test:e2e
```

The Playwright suite builds and previews the web app, then mocks API responses
across mobile and desktop viewports.

For a real integration check, configure `apps/api/.env`, enable `pgvector`, start
the app, create a journal entry, write in classic mode or ask Bloom for help,
inspect the Mind Map, save a Note, and generate an entry Reflection.

## Environment Variables

### API

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL or Neon connection string. |
| `OPENAI_API_KEY` | Yes for real AI flows | Used by `memo-grafter`, embeddings, Bloom, notes, and reflections. |
| `API_PORT` | Local only | Local Express port. Defaults to `4000`. |
| `CORS_ORIGIN` | Yes | Allowed web origin, usually `http://localhost:5173` locally. |

### Web

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Yes | URL for the Express API. |

## Memo-Grafter Integration

The API owns all memory operations. The frontend should call API endpoints rather
than importing `memo-grafter` directly.

- `ingestText()` ingests classic journal text and notes without generating an
  assistant response.
- `invoke()` powers conversational Bloom assistance.
- `getActiveNodes()` provides current user-facing themes.
- `getGraphSnapshot()` powers Mind Map and reflection snapshots.
- `graftByRelevance()` is reserved for selective context recall from previous
  entries.

## Deployment

MindBloom is split across services:

- Render runs `apps/api` using the root `render.yaml`.
- Vercel serves the static React/Vite frontend using `vercel.json`.
- Neon hosts PostgreSQL with `pgvector` enabled.

Render needs `DATABASE_URL`, `OPENAI_API_KEY`, and `CORS_ORIGIN`. Render provides
`PORT`; `API_PORT` is only for local development.

Vercel needs `VITE_API_BASE_URL` pointed at the deployed Render API URL.

See [docs/deployment.md](docs/deployment.md) for the focused deployment checklist.
