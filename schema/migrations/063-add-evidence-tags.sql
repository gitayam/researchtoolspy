-- Migration 063: Evidence tagging system for COP clue taxonomy
-- Supports structured tagging of evidence items (e.g., architecture/Building style, language_text/Script type).

CREATE TABLE IF NOT EXISTS cop_evidence_tags (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL,
  tag_category TEXT NOT NULL,
  tag_value TEXT NOT NULL,
  confidence INTEGER DEFAULT 100,
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
