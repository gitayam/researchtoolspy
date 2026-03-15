-- Migration 094: Create mom_assessments table
-- MOM (Motive, Opportunity, Means) assessment for actor-event analysis

CREATE TABLE IF NOT EXISTS mom_assessments (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  event_id TEXT,
  scenario_description TEXT NOT NULL,
  motive INTEGER NOT NULL DEFAULT 0,
  opportunity INTEGER NOT NULL DEFAULT 0,
  means INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  assessed_by INTEGER,
  workspace_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mom_assessments_actor ON mom_assessments(actor_id);
CREATE INDEX IF NOT EXISTS idx_mom_assessments_event ON mom_assessments(event_id);
CREATE INDEX IF NOT EXISTS idx_mom_assessments_workspace ON mom_assessments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_mom_assessments_created_by ON mom_assessments(created_by);
