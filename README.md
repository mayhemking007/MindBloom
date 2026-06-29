# MindBloom

MindBloom is a journal-first writing app built with TypeScript and
`memo-grafter`. It supports classic journaling, Bloom writing assistance, notes,
mind maps, brought-in context, reflections, and shareable reflection cards.

## Stack

- React 19 and Vite
- Express and TypeScript
- PostgreSQL/Neon with `pgvector`
- `memo-grafter` and OpenAI
- Vitest and Playwright

## Storage

- **Authenticated users:** app data and memo-grafter memory are stored in
  PostgreSQL through `DATABASE_URL`.
- **Demo users:** data stays in browser localStorage and is not written to the
  application database.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the system design and technical
details.

## Local Setup

Requirements: Node.js 20+, npm, PostgreSQL with `pgvector`, and an OpenAI API
key.

```bash
npm install
```

Create the environment files:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

Configure `apps/api/.env`:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mindbloom
OPENAI_API_KEY=sk-...
API_PORT=4000
CORS_ORIGIN=http://localhost:5173
```

Configure `apps/web/.env`:

```env
VITE_API_BASE_URL=http://localhost:4000
```

Enable `pgvector`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Initialize and migrate MemoGrafter's managed memory schema:

```bash
npm run memo:init
npm run memo:migrate
```

Start both applications:

```bash
npm run dev
```

Web: `http://localhost:5173`  
API: `http://localhost:4000`

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run check:boundaries
npm run memo:init
npm run memo:migrate
npm run memo:studio
```

API tests use the configured PostgreSQL database and clear shared test tables.
Use a disposable database when running them.

## Deployment

- Render: Express API via `render.yaml`
- Vercel: React/Vite app via `vercel.json`
- Neon: PostgreSQL with `pgvector`
- MemoGrafter: run `npm run memo:migrate` for the target database before the
  API handles traffic. Runtime startup verifies the `mg_*` schema but does not
  create it.

See [docs/deployment.md](docs/deployment.md) for deployment configuration.
