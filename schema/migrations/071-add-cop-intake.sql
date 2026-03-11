-- Migration 071: Add COP intake forms and submissions for crowdsource ingestion
-- Intake forms are JSON-schema-driven structured submission URLs.
-- Submissions flow through a triage queue before promotion to evidence/tasks.

CREATE TABLE IF NOT EXISTS cop_intake_forms (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  form_schema TEXT DEFAULT '[]',
  share_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft',  -- 'draft', 'active', 'closed'
  auto_tag_category TEXT,
  require_location INTEGER DEFAULT 0,
  require_contact INTEGER DEFAULT 0,
  submission_count INTEGER DEFAULT 0,

  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_intake_forms_session ON cop_intake_forms(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_intake_forms_token ON cop_intake_forms(share_token);
CREATE INDEX IF NOT EXISTS idx_cop_intake_forms_status ON cop_intake_forms(status);

CREATE TABLE IF NOT EXISTS cop_submissions (
  id TEXT PRIMARY KEY,
  intake_form_id TEXT NOT NULL,
  cop_session_id TEXT NOT NULL,
  form_data TEXT DEFAULT '{}',
  submitter_name TEXT,
  submitter_contact TEXT,
  lat REAL,
  lon REAL,
  status TEXT DEFAULT 'pending',  -- 'pending', 'triaged', 'accepted', 'rejected'
  triaged_by INTEGER,
  rejection_reason TEXT,
  linked_evidence_id TEXT,
  linked_task_id TEXT,

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (intake_form_id) REFERENCES cop_intake_forms(id),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_submissions_form ON cop_submissions(intake_form_id);
CREATE INDEX IF NOT EXISTS idx_cop_submissions_session ON cop_submissions(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_submissions_status ON cop_submissions(status);
