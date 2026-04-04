-- Migration 101: Standalone Survey Drops system
-- Creates survey_drops + survey_responses tables, migrates data from cop_intake_forms + cop_submissions

CREATE TABLE IF NOT EXISTS survey_drops (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  form_schema TEXT DEFAULT '[]',
  share_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft',
  access_level TEXT DEFAULT 'public',
  password_hash TEXT,
  allowed_countries TEXT DEFAULT '[]',
  rate_limit_per_hour INTEGER DEFAULT 0,
  custom_slug TEXT,
  expires_at TEXT,
  theme_color TEXT,
  logo_url TEXT,
  success_message TEXT,
  redirect_url TEXT,
  auto_tag_category TEXT,
  require_location INTEGER DEFAULT 0,
  require_contact INTEGER DEFAULT 0,
  submission_count INTEGER DEFAULT 0,
  cop_session_id TEXT,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_drops_token ON survey_drops(share_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_drops_slug ON survey_drops(custom_slug) WHERE custom_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_drops_creator ON survey_drops(created_by);
CREATE INDEX IF NOT EXISTS idx_survey_drops_status ON survey_drops(status);
CREATE INDEX IF NOT EXISTS idx_survey_drops_cop ON survey_drops(cop_session_id) WHERE cop_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL,
  form_data TEXT DEFAULT '{}',
  submitter_name TEXT,
  submitter_contact TEXT,
  lat REAL,
  lon REAL,
  submitter_country TEXT,
  submitter_city TEXT,
  submitter_ip_hash TEXT,
  content_hash TEXT,
  status TEXT DEFAULT 'pending',
  triaged_by INTEGER,
  rejection_reason TEXT,
  cop_session_id TEXT,
  linked_evidence_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  FOREIGN KEY (survey_id) REFERENCES survey_drops(id),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_status ON survey_responses(status);
CREATE INDEX IF NOT EXISTS idx_survey_responses_rate ON survey_responses(survey_id, submitter_ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_survey_responses_dedup ON survey_responses(survey_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_survey_responses_cop ON survey_responses(cop_session_id) WHERE cop_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_responses_country ON survey_responses(submitter_country);

-- Migrate existing data from old COP intake tables

INSERT OR IGNORE INTO survey_drops (
  id, title, description, form_schema, share_token, status,
  access_level, password_hash, allowed_countries, rate_limit_per_hour,
  custom_slug, expires_at, theme_color, logo_url, success_message, redirect_url,
  auto_tag_category, require_location, require_contact, submission_count,
  cop_session_id, workspace_id, created_by, created_at, updated_at
)
SELECT
  id, title, description, form_schema, share_token, status,
  COALESCE(access_level, 'public'), password_hash,
  COALESCE(allowed_countries, '[]'), COALESCE(rate_limit_per_hour, 0),
  custom_slug, expires_at, theme_color, logo_url, success_message, redirect_url,
  auto_tag_category, require_location, require_contact, submission_count,
  cop_session_id, workspace_id, created_by, created_at, updated_at
FROM cop_intake_forms;

INSERT OR IGNORE INTO survey_responses (
  id, survey_id, form_data, submitter_name, submitter_contact,
  lat, lon, submitter_country, submitter_city, submitter_ip_hash, content_hash,
  status, triaged_by, rejection_reason, cop_session_id,
  linked_evidence_id, created_at, updated_at
)
SELECT
  id, intake_form_id, form_data, submitter_name, submitter_contact,
  lat, lon, submitter_country, submitter_city, submitter_ip_hash, content_hash,
  status, triaged_by, rejection_reason, cop_session_id,
  linked_evidence_id, created_at, updated_at
FROM cop_submissions;
