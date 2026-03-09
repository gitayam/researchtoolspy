-- Migration 062: Persona tracking for COP sessions
-- Tracks social media personas (handles/aliases) across platforms and links between them.

CREATE TABLE IF NOT EXISTS cop_personas (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  handle TEXT,
  profile_url TEXT,
  status TEXT DEFAULT 'active',
  linked_actor_id TEXT,
  notes TEXT,
  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cop_persona_links (
  id TEXT PRIMARY KEY,
  persona_a_id TEXT NOT NULL REFERENCES cop_personas(id),
  persona_b_id TEXT NOT NULL REFERENCES cop_personas(id),
  link_type TEXT DEFAULT 'alias',
  confidence INTEGER DEFAULT 50,
  evidence_id TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
