-- Migration 070: Add COP event bus for automation
-- Events are machine-readable structured data emitted by every COP mutation.
-- The playbook engine (Phase 6) will consume these events.
-- Separate from cop_activity (human-readable UI feed).

CREATE TABLE IF NOT EXISTS cop_events (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload TEXT DEFAULT '{}',
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_events_session ON cop_events(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_events_type ON cop_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cop_events_session_type ON cop_events(cop_session_id, event_type);
CREATE INDEX IF NOT EXISTS idx_cop_events_created ON cop_events(created_at);
