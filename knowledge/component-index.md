# Component and File Index

This is the quick lookup document for locating code. It is organized by folder
and by team ownership.

## Top-Level Files

| Path | What it is used for |
| --- | --- |
| `package.json` | Root npm workspace scripts and workspace package list. |
| `package-lock.json` | Installed dependency lockfile for all workspaces. |
| `tsconfig.json` | Root TypeScript project references. |
| `ARCHITECTURE.md` | Existing architecture summary for runtime, storage, API, and deployment. |
| `README.md` | Setup, stack, commands, storage notes, deployment pointers. |
| `playwright.config.ts` | End-to-end test configuration. |
| `render.yaml` | Render API deployment config. |
| `vercel.json` | Vercel web deployment config. |
| `scripts/check-boundaries.mjs` | Static boundary checks, including no frontend/shared memo-grafter imports. |

## Shared Package

| Path | What it owns |
| --- | --- |
| `packages/shared/src/index.ts` | Shared domain types, API payload types, graph types, Bloom/reflection types, and session/date helpers. |
| `packages/shared/package.json` | Shared package build/typecheck scripts. |
| `packages/shared/tsconfig.json` | TypeScript config for shared package. |

## Web Entry, Routing, and Layout

| Path | What it owns |
| --- | --- |
| `apps/web/src/main.tsx` | React root mounting and top-level providers. |
| `apps/web/src/App.tsx` | Route table for public share, auth, journal, map, notes, calendar, reflect, and settings pages. |
| `apps/web/src/layout/AppLayout.tsx` | Shared app shell for authenticated/demo app routes. |
| `apps/web/src/components/nav/BottomNav.tsx` | Mobile/bottom navigation UI. |
| `apps/web/src/styles.css` | Global styles, Tailwind imports, theme variables, and shared visual rules. |

## Web Pages

| Path | What it owns |
| --- | --- |
| `apps/web/src/pages/TodayPage.tsx` | Main route for the journal workspace. |
| `apps/web/src/pages/MapPage.tsx` | Full map/graph exploration page. |
| `apps/web/src/pages/NotesPage.tsx` | Notes list, editing, filtering, and note interactions. |
| `apps/web/src/pages/CalendarPage.tsx` | Calendar activity display. |
| `apps/web/src/pages/ReflectPage.tsx` | Reflection-oriented page-level experience. |
| `apps/web/src/pages/PublicSharePage.tsx` | Public token-based reflection share display. |
| `apps/web/src/pages/AuthPage.tsx` | Login and register UI. |
| `apps/web/src/pages/SettingsPage.tsx` | Settings controls for calendar/streak preferences. |
| `apps/web/src/pages/TimelinePage.tsx` | Legacy/redirected timeline page. |

## Web Journal and Chat Components

| Path | What it owns |
| --- | --- |
| `apps/web/src/components/journal/JournalWorkspace.tsx` | Main writing workspace, entry sidebar, editor, Bloom panel, map/reflect workspace views, notes from selection, reflection share controls. |
| `apps/web/src/components/chat/ChatInterface.tsx` | Older/general chat interface. |
| `apps/web/src/components/chat/ChatBubble.tsx` | Message bubble rendering. |
| `apps/web/src/components/chat/BloomCTA.tsx` | Call-to-action to generate Bloom. |
| `apps/web/src/components/chat/TopicPills.tsx` | Topic pill rendering. |

## Web Visualization Components

| Path | What it owns |
| --- | --- |
| `apps/web/src/components/map/MapViews.tsx` | Switches/combines map views from graph snapshots. |
| `apps/web/src/components/map/InsightConstellation.tsx` | Constellation graph visualization. |
| `apps/web/src/components/map/ThoughtRiver.tsx` | River-style graph visualization. |
| `apps/web/src/components/map/DriftTerrain.tsx` | Drift terrain visualization. |
| `apps/web/src/components/map/RiverCard.tsx` | Individual river node card. |
| `apps/web/src/components/map/RiverConnector.tsx` | River edge connector display. |
| `apps/web/src/components/map/RiverDetailPanel.tsx` | Selected river node detail panel. |
| `apps/web/src/components/map/RiverMemoryDots.tsx` | Memory markers for river nodes. |
| `apps/web/src/components/map/MapLegend.tsx` | Legend for map views. |
| `apps/web/src/components/map/MapToggle.tsx` | Toggle between map views. |
| `apps/web/src/components/map/types.ts` | Map-specific frontend types. |
| `apps/web/src/components/graph/MindMap.tsx` | Mind-map graph rendering. |
| `apps/web/src/components/bloom/BloomOverlay.tsx` | Bloom overlay presentation. |
| `apps/web/src/components/bloom/BloomCard.tsx` | Individual Bloom card display. |
| `apps/web/src/components/bloom/BloomGraph.tsx` | Bloom graph display. |

## Web Hooks, Lib, Auth, and Theme

| Path | What it owns |
| --- | --- |
| `apps/web/src/lib/api.ts` | Browser API client and demo-mode routing layer. |
| `apps/web/src/lib/demoStore.ts` | LocalStorage-backed demo implementation of app data. |
| `apps/web/src/lib/bloomStore.ts` | Browser-local saved Bloom persistence. |
| `apps/web/src/lib/chatStorage.ts` | Browser-local chat session persistence. |
| `apps/web/src/lib/dateUtils.ts` | Date formatting and recent date helpers. |
| `apps/web/src/lib/mapLayout.ts` | Constellation layout calculations. |
| `apps/web/src/lib/riverLayout.ts` | Thought river layout and connection selection. |
| `apps/web/src/lib/topicColors.ts` | Topic color ramps and CSS class lookup. |
| `apps/web/src/lib/topicSummary.ts` | Topic summary formatting. |
| `apps/web/src/auth/AuthContext.tsx` | Current auth state, login/logout/register actions, owner mode switching. |
| `apps/web/src/theme/ThemeContext.tsx` | Theme mode state and persistence. |
| `apps/web/src/components/theme/ThemeToggle.tsx` | Theme toggle UI. |
| `apps/web/src/hooks/useBloom.ts` | Bloom generation hook. |
| `apps/web/src/hooks/useChat.ts` | Chat send/load hook. |
| `apps/web/src/hooks/useReflection.ts` | Weekly reflection generation hook. |
| `apps/web/src/hooks/useSavedBlooms.ts` | Saved Bloom loading hook. |
| `apps/web/src/hooks/useSnapshot.ts` | Graph snapshot loading hook. |

## API Entry, Config, and HTTP

| Path | What it owns |
| --- | --- |
| `apps/api/src/app.ts` | Express app creation, middleware, health/today session routes, router mounting. |
| `apps/api/src/server.ts` | DB initialization, HTTP startup, dev seeding, graceful shutdown. |
| `apps/api/src/config/env.ts` | Environment variable validation. |
| `apps/api/src/config/db.ts` | Postgres pool, query helper, transaction helper, app schema initialization. |
| `apps/api/src/http/cookies.ts` | Cookie parsing helpers. |
| `apps/api/src/http/errors.ts` | `ApiError` and error utilities. |
| `apps/api/src/http/middleware/errorHandler.ts` | Express not-found and error handling. |
| `apps/api/src/http/middleware/requireAuth.ts` | Auth middleware. |
| `apps/api/src/http/middleware/requireOwner.ts` | Owner-scope resolution and owned-entry checks. |

## API Routes

| Path | What it owns |
| --- | --- |
| `apps/api/src/routes/auth.routes.ts` | Register, login, logout, current user. |
| `apps/api/src/routes/entries.routes.ts` | Entry CRUD, documents, ingestion, messages, streaming Bloom messages, entry grafts, entry reflections. |
| `apps/api/src/routes/notes.routes.ts` | Note CRUD. |
| `apps/api/src/routes/settings.routes.ts` | Settings and calendar activity. |
| `apps/api/src/routes/share.routes.ts` | Authenticated share-link management and public share token reads. |
| `apps/api/src/routes/bloom.routes.ts` | Session Bloom generation. |
| `apps/api/src/routes/chat.routes.ts` | Legacy/general chat endpoint. |
| `apps/api/src/routes/snapshot.routes.ts` | Graph snapshot reads. |
| `apps/api/src/routes/recall.routes.ts` | Recall/memory search. |
| `apps/api/src/routes/reflect.routes.ts` | Weekly/multi-session reflection generation. |

## API Services, Repositories, DB, and Memory

| Path | What it owns |
| --- | --- |
| `apps/api/src/services/auth.service.ts` | User creation, authentication, password/session hashing, session lookup/revocation, dev seed users. |
| `apps/api/src/services/entries.service.ts` | Main app data store for entries, documents, messages, grafts, notes, reflections, share links, settings, calendar activity. |
| `apps/api/src/services/memory.service.ts` | Memory workflow service helpers if used by routes. |
| `apps/api/src/services/session.service.ts` | Session/date helper wrappers. |
| `apps/api/src/repositories/*.ts` | Focused SQL operations by domain. |
| `apps/api/src/db/schema.ts` | MindBloom table names, row interfaces, and table creation SQL. |
| `apps/api/src/memory/*.ts` | Prompt construction, AI parsing/fallbacks, graph normalization, reflection/Bloom logic. |
| `apps/api/src/memo-grafter/*.ts` | memo-grafter agent lifecycle, config, schema reference, OpenAI adapters. |

## Tests

| Path | What it covers |
| --- | --- |
| `apps/api/tests/*.test.ts` | API route and adapter tests. |
| `apps/api/tests/setup.ts` | API test environment defaults and DB initialization. |
| `apps/web/src/**/*.test.tsx` | Web component/page/lib tests. |
| `apps/web/src/test/setup.ts` | jsdom test setup and authenticated API-mode default. |
| `e2e/mobile-smoke.spec.ts` | Playwright smoke coverage. |

