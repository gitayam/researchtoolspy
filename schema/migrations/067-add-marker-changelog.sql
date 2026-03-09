-- Migration 067: Add confidence/rationale to markers and changelog tracking
-- Confidence uses NATO-style assessment levels

-- Add confidence and rationale to markers
ALTER TABLE cop_markers ADD COLUMN confidence TEXT DEFAULT 'POSSIBLE';  -- CONFIRMED/PROBABLE/POSSIBLE/SUSPECTED/DOUBTFUL
ALTER TABLE cop_markers ADD COLUMN rationale TEXT;

-- Changelog for marker changes
CREATE TABLE IF NOT EXISTS cop_marker_changelog (
  id TEXT PRIMARY KEY,
  marker_id TEXT NOT NULL,
  cop_session_id TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'created', 'moved', 'confidence_changed', 'rationale_updated', 'evidence_linked', 'deleted'
  old_value TEXT,  -- JSON of previous state
  new_value TEXT,  -- JSON of new state
  rationale TEXT,  -- Why this change was made
  created_by INTEGER NOT NULL,
  created_by_name TEXT,  -- Human-readable name
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (marker_id) REFERENCES cop_markers(id),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_marker_changelog_marker ON cop_marker_changelog(marker_id);
CREATE INDEX IF NOT EXISTS idx_cop_marker_changelog_session ON cop_marker_changelog(cop_session_id);
