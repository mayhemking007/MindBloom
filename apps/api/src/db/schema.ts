export const appTables = {
  users: "mindbloom_users",
  authSessions: "mindbloom_auth_sessions",
  userSettings: "mindbloom_user_settings",
  journalEntries: "mindbloom_journal_entries",
  entryDocuments: "mindbloom_entry_documents",
  entryMessages: "mindbloom_entry_messages",
  entryGrafts: "mindbloom_entry_grafts",
  notes: "mindbloom_notes",
  entryReflections: "mindbloom_entry_reflections",
  reflectionShareLinks: "mindbloom_reflection_share_links",
} as const;

export type AppTableName = (typeof appTables)[keyof typeof appTables];

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: Date;
}

export interface AuthSessionRow {
  token: string;
  user_id: string;
  token_hash: string;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface JournalEntryRow {
  id: string;
  owner_id: string;
  owner_kind: "authenticated" | "demo";
  title: string;
  tags: string[];
  status: "draft" | "completed" | "archived";
  memo_session_id: string;
  allow_future_context: boolean;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface EntryDocumentRow {
  id: string;
  entry_id: string;
  content: string;
  version: number;
  last_ingested_version: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface EntryMessageRow {
  id: string;
  entry_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: Date;
}

export interface EntryGraftRow {
  id: string;
  entry_id: string;
  query: string;
  source_entry_id: string | null;
  source_entry_title: string | null;
  source_entry_created_at: Date | null;
  source_session_id: string | null;
  source_theme_id: string | null;
  theme_label: string;
  similarity: number | null;
  grafted_at: Date;
}

export interface NoteRow {
  id: string;
  owner_id: string;
  owner_kind: "authenticated" | "demo";
  entry_id: string | null;
  title: string;
  body: string;
  source_type: "entry-selection" | "bloom-message" | "reflection-card" | "blank";
  source_message_id: string | null;
  source_reflection_id: string | null;
  source_reflection_card_id: string | null;
  source_selection_start: number | null;
  source_selection_end: number | null;
  source_excerpt: string | null;
  source_path: string | null;
  color: string | null;
  pinned: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EntryReflectionRow {
  id: string;
  entry_id: string;
  cards: unknown;
  graph_snapshot: unknown;
  created_at: Date;
}

export interface ReflectionShareLinkRow {
  id: string;
  reflection_id: string;
  token: string;
  selected_card_ids: string[];
  created_at: Date;
  expires_at: Date | null;
  revoked_at: Date | null;
}

export interface UserSettingsRow {
  owner_id: string;
  owner_kind: "authenticated" | "demo";
  calendar_enabled: boolean;
  calendar_mode: "gentle" | "habit";
  streaks_enabled: boolean;
  updated_at: Date;
}

export const createAppSchemaSql = `
CREATE TABLE IF NOT EXISTS ${appTables.users} (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ${appTables.authSessions} (
  token text PRIMARY KEY,
  user_id text NOT NULL REFERENCES ${appTables.users}(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

ALTER TABLE ${appTables.authSessions}
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

UPDATE ${appTables.authSessions}
SET token_hash = token
WHERE token_hash IS NULL;

ALTER TABLE ${appTables.authSessions}
  ALTER COLUMN token_hash SET NOT NULL;

CREATE TABLE IF NOT EXISTS ${appTables.userSettings} (
  owner_id text NOT NULL,
  owner_kind text NOT NULL CHECK (owner_kind IN ('authenticated', 'demo')),
  calendar_enabled boolean NOT NULL DEFAULT false,
  calendar_mode text NOT NULL DEFAULT 'gentle' CHECK (calendar_mode IN ('gentle', 'habit')),
  streaks_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_kind, owner_id)
);

CREATE TABLE IF NOT EXISTS ${appTables.journalEntries} (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  owner_kind text NOT NULL CHECK (owner_kind IN ('authenticated', 'demo')),
  title text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),
  memo_session_id text NOT NULL UNIQUE,
  allow_future_context boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (owner_kind, owner_id, id)
);

CREATE INDEX IF NOT EXISTS mindbloom_journal_entries_owner_updated_idx
  ON ${appTables.journalEntries} (owner_kind, owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ${appTables.entryDocuments} (
  id text PRIMARY KEY,
  entry_id text NOT NULL REFERENCES ${appTables.journalEntries}(id) ON DELETE CASCADE,
  content text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  last_ingested_version integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id)
);

CREATE TABLE IF NOT EXISTS ${appTables.entryMessages} (
  id text PRIMARY KEY,
  entry_id text NOT NULL REFERENCES ${appTables.journalEntries}(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mindbloom_entry_messages_entry_created_idx
  ON ${appTables.entryMessages} (entry_id, created_at);

CREATE TABLE IF NOT EXISTS ${appTables.entryGrafts} (
  id text PRIMARY KEY,
  entry_id text NOT NULL REFERENCES ${appTables.journalEntries}(id) ON DELETE CASCADE,
  query text NOT NULL,
  source_entry_id text REFERENCES ${appTables.journalEntries}(id) ON DELETE SET NULL,
  source_entry_title text,
  source_entry_created_at timestamptz,
  source_session_id text,
  source_theme_id text,
  theme_label text NOT NULL,
  similarity double precision,
  grafted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mindbloom_entry_grafts_entry_grafted_idx
  ON ${appTables.entryGrafts} (entry_id, grafted_at DESC);

CREATE TABLE IF NOT EXISTS ${appTables.notes} (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  owner_kind text NOT NULL CHECK (owner_kind IN ('authenticated', 'demo')),
  entry_id text REFERENCES ${appTables.journalEntries}(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('entry-selection', 'bloom-message', 'reflection-card', 'blank')),
  source_message_id text,
  source_reflection_id text,
  source_reflection_card_id text,
  source_selection_start integer,
  source_selection_end integer,
  source_excerpt text,
  source_path text,
  color text,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mindbloom_notes_owner_pinned_created_idx
  ON ${appTables.notes} (owner_kind, owner_id, pinned DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS ${appTables.entryReflections} (
  id text PRIMARY KEY,
  entry_id text NOT NULL REFERENCES ${appTables.journalEntries}(id) ON DELETE CASCADE,
  cards jsonb NOT NULL,
  graph_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mindbloom_entry_reflections_entry_created_idx
  ON ${appTables.entryReflections} (entry_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ${appTables.reflectionShareLinks} (
  id text PRIMARY KEY,
  reflection_id text NOT NULL REFERENCES ${appTables.entryReflections}(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  selected_card_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS mindbloom_reflection_share_links_reflection_created_idx
  ON ${appTables.reflectionShareLinks} (reflection_id, created_at DESC);
`;
