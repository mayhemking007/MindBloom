# MindBloom

MindBloom is a TypeScript example app for `memo-grafter` and a journal-first writing product. It helps people journal, capture ideas, and brainstorm through classic writing, an optional Bloom assistant, notes, mind maps, and shareable reflection cards.

## Workspace

- `apps/api`: Express API for `memo-grafter`, OpenAI calls, journal entries, notes, reflections, and graph endpoints.
- `apps/web`: React/Vite frontend.
- `packages/shared`: shared types and utilities used by both apps.

## Local Setup

1. Copy `apps/api/.env.example` to `apps/api/.env`.
2. Copy `apps/web/.env.example` to `apps/web/.env`.
3. Point `DATABASE_URL` at your local Postgres or Neon database and add your `OPENAI_API_KEY` in `apps/api/.env`.
4. Point `VITE_API_BASE_URL` at the API URL in `apps/web/.env`.
5. Enable pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

6. Install dependencies:

```bash
npm install
```

7. Start both apps:

```bash
npm run dev
```

The API defaults to `http://localhost:4000` and the web app defaults to `http://localhost:5173`.

## Testing

The default test suite uses mocks and does not require a real OpenAI key, Postgres, or pgvector.

```bash
npm run typecheck
npm run lint
npm test
npm run check:boundaries
npm run build
npm run test:e2e
```

The Playwright suite builds and previews the web app, then mocks API responses across mobile and desktop viewports.

For a real integration check, configure `apps/api/.env`, enable pgvector, start the app, create a journal entry, write in classic mode or ask Bloom for help, inspect the Mind Map, save a Note, and generate an entry Reflection.

## Memo-Grafter Usage

- `ingestText()` ingests classic journal text and notes without generating an assistant response.
- `invoke()` powers conversational Bloom assistance.
- `getActiveNodes()` provides current user-facing themes.
- `getGraphSnapshot()` powers Mind Map and reflection snapshots.
- `graftByRelevance()` will support selective brought-in context from previous entries.

## Deployment Shape

- Render: deploys `apps/api` through the root `render.yaml`.
- Vercel: deploys the Vite app using `vercel.json`.
- Neon: provides the PostgreSQL database; set `DATABASE_URL` to the Neon pooled connection string and enable `pgvector`.
