-- Migration 060: COP collaboration tables
-- Adds collaborators and activity tracking for COP workspace collaboration

CREATE TABLE IF NOT EXISTS cop_collaborators (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  user_id INTEGER,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  invite_token TEXT UNIQUE,
  invited_by INTEGER,
  invited_at TEXT DEFAULT (datetime('now')),
  accepted_at TEXT,
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_collaborators_session ON cop_collaborators(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_collaborators_user ON cop_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_cop_collaborators_token ON cop_collaborators(invite_token);

CREATE TABLE IF NOT EXISTS cop_activity (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_activity_session ON cop_activity(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_activity_time ON cop_activity(created_at);
