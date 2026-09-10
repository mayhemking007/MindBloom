# Testing Guide

This document covers automated and manual testing for MindBloom, including
environment-variable behavior.

## Test Commands

| Command | What it runs |
| --- | --- |
| `npm test` | Workspace tests for packages that define a test script. |
| `npm run test:api` | API Vitest tests. |
| `npm run test:web` | Web Vitest tests. |
| `npm run test:e2e` | Playwright end-to-end tests. |
| `npm run typecheck` | TypeScript project typecheck. |
| `npm run check:boundaries` | Static architectural boundary checks. |

## API Tests

API tests live in `apps/api/tests`.

| File | Covers |
| --- | --- |
| `setup.ts` | Sets test env vars, validates safe test DB, initializes DB, seeds dev users. |
| `auth.routes.test.ts` | Register/login/logout/current-user auth behavior. |
| `entries.routes.test.ts` | Entry CRUD, documents, ingestion, messages, grafts/reflections-related entry behavior. |
| `notes.routes.test.ts` | Notes CRUD and ownership behavior. |
| `settings.routes.test.ts` | Settings and calendar activity routes. |
| `share.routes.test.ts` | Reflection share-link creation/list/revoke/public token behavior. |
| `routes.test.ts` | Broader route coverage for health/session/memory-style endpoints. |
| `openAiAdapters.test.ts` | OpenAI adapter behavior. |

### API Test Environment Variables

API tests do use environment variables. `apps/api/tests/setup.ts` sets:

| Variable | Behavior in tests |
| --- | --- |
| `NODE_ENV` | Forced to `test`. |
| `DATABASE_URL` | Set from `MINDBLOOM_TEST_DATABASE_URL`, or defaults to `postgres://postgres:postgres@localhost:5432/mindbloom_test`. |
| `OPENAI_API_KEY` | Defaults to `test-openai-key` if not already set. |
| `CORS_ORIGIN` | Defaults to `http://localhost:5173` if not already set. |

Safety rule: setup reads the database name from `DATABASE_URL` and refuses to
run unless the name includes `test`. If using a custom DB, set
`MINDBLOOM_TEST_DATABASE_URL` to a disposable database whose name includes
`test`.

API tests require a reachable Postgres database. External OpenAI/memo-grafter
behavior is mocked where appropriate.

## Web Unit and Component Tests

Web tests live next to frontend code under `apps/web/src`.

| File | Covers |
| --- | --- |
| `App.test.tsx` | App route-level behavior. |
| `pages/authPage.test.tsx` | Login/register UI behavior. |
| `pages/archivePages.test.tsx` | Archive/notes/timeline-style page behavior. |
| `pages/settingsCalendarPages.test.tsx` | Settings and calendar page behavior. |
| `components/journal/JournalWorkspace.test.tsx` | Main workspace interactions. |
| `components/chat/ChatInterface.test.tsx` | Chat UI behavior. |
| `components/map/MapViews.test.tsx` | Map view rendering behavior. |
| `components/graph/emptyGraphs.test.tsx` | Empty graph rendering. |
| `lib/*.test.ts` | Layout, storage, and formatting helper behavior. |

### Web Test Environment Variables

Web unit tests generally do not require real `.env` values or a running API.
They run in jsdom and use mocks. `apps/web/src/test/setup.ts`:

- Installs jest-dom matchers.
- Mocks `window.scrollTo`.
- Mocks `Element.prototype.scrollIntoView`.
- Mocks `ResizeObserver`.
- Calls `setApiOwnerKind("authenticated")` before each test so components use
  network-style API paths that tests can mock.
- Cleans up React Testing Library state after each test.

`VITE_API_BASE_URL` is not required for normal web unit tests because fetches
are mocked or behavior is local to the test.

## E2E Tests

E2E tests live in `e2e`. Current coverage includes:

- `mobile-smoke.spec.ts`: smoke coverage for mobile-oriented behavior.

Playwright configuration is in `playwright.config.ts`. E2E tests may require a
running dev server depending on the configured web server behavior. If they
exercise authenticated API behavior, the API env vars and test/dev database must
be available.

## Manual Test Flows

### Demo Journal Flow

1. Start the web app.
2. Visit the app without logging in.
3. Create a new entry.
4. Type and save journal text.
5. Switch between editor/map/reflect views.
6. Create a note from selected text.
7. Refresh the page and confirm data persists locally.
8. Clear site storage and confirm demo data disappears.

Expected storage: browser localStorage only.

### Authenticated Journal Flow

1. Start API and web with valid `.env` files.
2. Register or log in.
3. Create an entry.
4. Save document text.
5. Trigger or wait for ingest.
6. Confirm topic pills/map data appear.
7. Refresh and confirm data loads from the API.

Expected storage: PostgreSQL app tables and memo-grafter graph tables.

### Bloom Message Flow

1. Open an entry with some writing.
2. Open the Bloom panel.
3. Send a message.
4. Confirm the user message appears immediately.
5. Confirm assistant text streams and then finalizes.
6. Confirm topic pills update.
7. Refresh and confirm message history persists.

Check error behavior by temporarily making the API unavailable or forcing a
mocked stream error in tests.

### Notes Flow

1. Create a blank note from the Notes page.
2. Create a note from selected journal text.
3. Pin/unpin and edit a note.
4. Delete a note.
5. Confirm list grouping and calendar activity update.

### Reflection and Share Flow

1. Create an entry with document text and/or Bloom messages.
2. Generate an entry reflection.
3. Select cards to share.
4. Create a share link while authenticated.
5. Open `/share/:token` in a logged-out/private browser.
6. Revoke the link and confirm public access fails.

### Map and Visual Flow

1. Create or load an entry with topics.
2. Open the map page.
3. Switch map modes.
4. Select nodes and inspect detail panels.
5. Resize to mobile width and confirm layout remains usable.

### Settings and Calendar Flow

1. Toggle calendar visibility.
2. Switch between gentle and habit modes.
3. Toggle streak behavior.
4. Create entries/notes/reflections.
5. Confirm calendar activity reflects user data and settings.

## Boundary and Type Checks

Run these before larger merges:

- `npm run typecheck`
- `npm run check:boundaries`
- `npm test`

Boundary checks catch architectural leaks such as frontend imports of
`memo-grafter`.

## Things To Be Careful About

- API tests clear or mutate MindBloom tables; use only disposable test DBs.
- Web tests default to authenticated mode, so remember to explicitly set demo
  mode in tests that cover `demoStore`.
- Model calls should be mocked in tests unless the test intentionally covers an
  adapter boundary.
- E2E tests can fail from missing services/env, not only from app regressions.

