-- Migration 084: COP timeline entries for investigative events
-- Stores real-world events the analyst is tracking (distinct from cop_activity audit trail
-- and cop_events automation bus). Supports manual entry and URL/AI extraction.

CREATE TABLE IF NOT EXISTS cop_timeline_entries (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  workspace_id TEXT,
  event_date TEXT NOT NULL,          -- ISO date or datetime of the real-world event
  title TEXT NOT NULL,               -- Short description
  description TEXT,                  -- Longer detail / context
  category TEXT DEFAULT 'event',     -- event, meeting, communication, financial, legal, travel, publication
  source_type TEXT DEFAULT 'manual', -- manual, url_extract
  source_url TEXT,                   -- URL if extracted from article
  source_title TEXT,                 -- Title of source article
  importance TEXT DEFAULT 'normal',  -- low, normal, high, critical
  created_by INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_timeline_session ON cop_timeline_entries(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_timeline_date ON cop_timeline_entries(event_date);
CREATE INDEX IF NOT EXISTS idx_cop_timeline_session_date ON cop_timeline_entries(cop_session_id, event_date);
