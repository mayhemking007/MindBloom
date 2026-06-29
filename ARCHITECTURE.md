# MindBloom Architecture

## Overview

MindBloom is an npm workspace with three primary packages:

```text
apps/api          Express API, PostgreSQL persistence, AI and memory integration
apps/web          React/Vite application and browser-local demo persistence
packages/shared   Shared request, response, and domain types
```

Authenticated workflows use the API and PostgreSQL. Demo workflows are handled
inside the web application and persist only to localStorage.

```mermaid
flowchart LR
  UI[React web app]
  Demo[Demo localStorage]
  API[Express API]
  DB[(PostgreSQL)]
  MG[memo-grafter]
  OAI[OpenAI]

  UI -->|demo mode| Demo
  UI -->|authenticated mode| API
  API --> DB
  API --> MG
  MG --> DB
  MG --> OAI
```

## Storage Boundaries

### Authenticated Data

The API uses `pg` with the connection string in `DATABASE_URL`. MindBloom app
tables are declared centrally in `apps/api/src/db/schema.ts` and use the
`mindbloom_` prefix:

```text
mindbloom_users
mindbloom_auth_sessions
mindbloom_user_settings
mindbloom_journal_entries
mindbloom_entry_documents
mindbloom_entry_messages
mindbloom_entry_grafts
mindbloom_notes
mindbloom_entry_reflections
mindbloom_reflection_share_links
```

The API initializes missing tables before opening the HTTP listener. App queries
use parameter placeholders (`$1`, `$2`, etc.); table identifiers come from fixed
constants rather than request input.

Memo-grafter uses the same database connection string but owns its internal
`mg_*` graph and memory tables. MindBloom keeps app schema initialization in the
API, while MemoGrafter schema creation is explicit through `npm run memo:init`
and `npm run memo:migrate`.

### Demo Data

Demo mode does not call the authenticated entry, document, note, message,
reflection, or settings endpoints. `apps/web/src/lib/api.ts` routes those calls
to `apps/web/src/lib/demoStore.ts`.

The complete demo state is stored under:

```text
mindbloom:demo:data:v1
```

It includes entries, drafts, messages, notes, grafts, reflections, share-link
metadata, settings, and local map data. It is browser/device-specific and is
deleted when site storage is cleared. Demo Bloom uses a local fallback response,
so demo conversations do not enter PostgreSQL or memo-grafter.

`AuthContext` calls `setApiOwnerKind()` when authentication changes:

```text
login/register  -> authenticated API mode
logout/no user  -> local demo mode
```

## API Structure

```text
apps/api/src/
  app.ts
  server.ts
  config/
    env.ts              Environment validation
    db.ts               pg pool, query helper, transactions, initialization
  db/
    schema.ts           Central MindBloom table definitions and DDL
    migrations/         Migration location
  http/
    cookies.ts
    errors.ts
    middleware/
      requireAuth.ts
      requireOwner.ts
      errorHandler.ts
  memo-grafter/
    memoGrafter.ts      Agent initialization, caching, streaming, shutdown
    mg-schema.ts        Generated MemoGrafter schema reference
    mg.config.ts        MemoGrafter CLI migration and Studio config
  memory/
    prompts.ts
    graphNormalizer.ts
    bloom.ts
    reflection.ts
    entryReflection.ts
    openai.ts
  repositories/         Parameterized PostgreSQL operations
  routes/               HTTP validation and response handling
  schemas/              Zod request schemas
  services/             Auth, entry, memory, and session orchestration
```

### Layer Responsibilities

- **Routes:** HTTP parsing, validation, status codes, SSE events, and responses.
- **Schemas:** reusable Zod validation for request bodies and parameters.
- **Services:** business workflows, owner-scoped operations, row mapping, and
  coordination with memo-grafter.
- **Repositories:** focused parameterized SQL operations.
- **DB:** pool lifecycle, transactions, and the centralized app schema.
- **Memory:** prompts and transformations between memo-grafter data and public
  MindBloom response types.

## Request Flows

### Authenticated Journal Save

```mermaid
sequenceDiagram
  participant Web
  participant API
  participant PG as PostgreSQL
  participant MG as memo-grafter

  Web->>API: PUT /api/entries/:id/document
  API->>PG: Upsert document and version
  Web->>API: POST /api/entries/:id/ingest
  API->>PG: Read current document/version
  API->>MG: ingestText(content, replace: true)
  MG->>PG: Update memory graph
  API->>PG: Mark last ingested version
  API-->>Web: Document and active themes
```

Documents track `version` and `lastIngestedVersion`. Unchanged content is not
re-ingested. `replace: true` prevents autosave from creating duplicate semantic
sources for the same entry.

### Bloom Message

The web app saves and ingests the latest draft, then opens the entry message SSE
endpoint. The API stores the user message, builds context from the current draft,
tags, selected text, and graft labels, streams memo-grafter output, and stores the
completed assistant message.

### Brought-In Context

1. The user enters a semantic query in the Bloom sidebar.
2. The API selects eligible previous entries owned by that user.
3. Each source agent runs `graftByRelevance()` with the configured similarity and
   graph-expansion options.
4. Matching nodes are ingested into the current entry agent.
5. Graft provenance is stored in `mindbloom_entry_grafts`.
6. Later Bloom requests include graft theme labels as background context.

This brings forward semantic themes, not the full verbatim text of old entries.

## Authentication and Ownership

Authentication uses an HTTP-only `mindbloom_session` cookie. Passwords and
session secrets are salted and hashed. Raw session secrets are not stored in the
database.

`requireOwner.ts` resolves the authenticated user from the cookie. Owner checks
are applied before reading or mutating entries, notes, reflections, and share
links.

Unauthenticated browser workflows do not use the database-backed owner path;
they are intercepted by the frontend demo store.

## Memo-Grafter Lifecycle

`apps/api/src/memo-grafter/memoGrafter.ts` imports from the installed
`memo-grafter` package and creates one cached agent per entry/session ID.
`agent.initialize()` verifies that MemoGrafter's `mg_*` schema has already been
migrated; it does not create those tables at runtime.

Configuration includes:

- OpenAI chat and embedding adapters
- intent-based drift detection
- graph expansion limits
- recent-message and recall budgets
- streaming adapter replacement during Bloom responses

Agents and the PostgreSQL pool are closed during graceful API shutdown.

MemoGrafter operational commands are exposed from the workspace root:

```bash
npm run memo:init
npm run memo:migrate
npm run memo:studio
```

`memo:studio` starts MemoGrafter's local graph inspection UI for the configured
database.

## Testing

### API

API tests initialize the app schema and use `DATABASE_URL` from
`apps/api/.env`. They fall back to
`postgres://test:test@localhost:5432/mindbloom_test` when no URL is provided.
Use a disposable database because tests clear MindBloom tables.

API test files run sequentially to avoid cross-file database cleanup races.
Memo-grafter and OpenAI are mocked where external calls are not under test.

### Web

Web tests use jsdom and mocked fetch responses. The test setup selects
authenticated API mode so existing component tests exercise their network mocks.
Demo persistence is implemented behind the same API wrapper and uses localStorage
at runtime.

### End-to-End

Playwright covers mobile and desktop workflows. The repository boundary check
prevents frontend code from importing backend-only modules.

## Runtime and Deployment

- `server.ts` initializes the DB schema, seeds development users outside
  production, starts HTTP, and handles graceful shutdown.
- `API_PORT` is used locally; hosting providers may provide `PORT`.
- An occupied port is reported as a concise `EADDRINUSE` startup message.
- Render hosts the API, Vercel serves the web build, and Neon can host PostgreSQL
  with `pgvector`.

Environment variables:

| Variable | Process | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | API | App and memo-grafter PostgreSQL connection |
| `OPENAI_API_KEY` | API | LLM and embedding operations |
| `MEMO_GRAFTER_EMBEDDING_MODEL` | API/CLI | Optional Studio embedding model override |
| `API_PORT` | API | Local API port, default `4000` |
| `PORT` | API | Hosting-provider port override |
| `CORS_ORIGIN` | API | Allowed web origin |
| `VITE_API_BASE_URL` | Web | Deployed or local API URL |
