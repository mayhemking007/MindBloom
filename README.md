# MindBloom

MindBloom is a TypeScript example app for `memo-grafter`. It will pair an Express API with a React frontend and PostgreSQL/pgvector storage.

## Workspace

- `apps/api`: Express API for `memo-grafter`, model calls, and graph endpoints.
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

## Deployment Shape

- Render: deploys `apps/api` through the root `render.yaml`.
- Vercel: deploys the Vite app using `vercel.json`.
- Neon: provides the PostgreSQL database; set `DATABASE_URL` to the Neon pooled connection string and enable `pgvector`.
