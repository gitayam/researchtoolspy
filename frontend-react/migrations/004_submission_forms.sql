-- Phase 3A: Research Data Capture Forms System
-- Anonymous evidence submission with hash-based URLs

-- Submission Forms (researcher-created intake forms)
CREATE TABLE IF NOT EXISTS submission_forms (
  id TEXT PRIMARY KEY,
  hash_id TEXT UNIQUE NOT NULL,           -- 8-char hash for public URL
  creator_workspace_id TEXT,

  -- Form Details
  form_name TEXT NOT NULL,
  form_description TEXT,

  -- Routing - where submissions go
  target_investigation_ids TEXT,          -- JSON array
  target_research_question_ids TEXT,      -- JSON array

  -- Field Configuration
  enabled_fields TEXT NOT NULL,           -- JSON array of field names
  require_url INTEGER DEFAULT 1,
  require_content_type INTEGER DEFAULT 1,
  allow_anonymous INTEGER DEFAULT 1,
  auto_archive INTEGER DEFAULT 1,

  -- Privacy & Security
  collect_submitter_info INTEGER DEFAULT 0,
  require_submission_password INTEGER DEFAULT 0,
  submission_password_hash TEXT,

  -- Status
  is_active INTEGER DEFAULT 1,
  submission_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX idx_submission_forms_hash ON submission_forms(hash_id);
CREATE INDEX idx_submission_forms_active ON submission_forms(is_active);
CREATE INDEX idx_submission_forms_creator ON submission_forms(creator_workspace_id);

-- Form Submissions (raw submissions before processing)
CREATE TABLE IF NOT EXISTS form_submissions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,

  -- Core Submitted Data
  source_url TEXT,
  archived_url TEXT,
  content_type TEXT,                      -- article, video, social_post, document, image, other
  content_description TEXT,
  login_required INTEGER DEFAULT 0,
  keywords TEXT,                          -- JSON array
  submitter_comments TEXT,

  -- Auto-extracted Metadata
  metadata TEXT,                          -- JSON: {title, description, author, date, etc}

  -- Optional Submitter Info
  submitter_contact TEXT,
  submitter_name TEXT,

  -- Processing Status
  status TEXT DEFAULT 'pending',          -- pending, processing, completed, rejected
  processed_at TEXT,
  evidence_id TEXT,                       -- Links to research_evidence after processing
  rejection_reason TEXT,

  -- Privacy (only stored if collect_submitter_info=1)
  submitter_ip TEXT,
  user_agent TEXT,

  submitted_at TEXT NOT NULL,

  FOREIGN KEY (form_id) REFERENCES submission_forms(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES research_evidence(id)
);

CREATE INDEX idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_status ON form_submissions(status);
CREATE INDEX idx_form_submissions_evidence ON form_submissions(evidence_id);
CREATE INDEX idx_form_submissions_date ON form_submissions(submitted_at);

-- Insert sample form for testing
INSERT INTO submission_forms (
  id,
  hash_id,
  creator_workspace_id,
  form_name,
  form_description,
  target_investigation_ids,
  target_research_question_ids,
  enabled_fields,
  require_url,
  require_content_type,
  allow_anonymous,
  auto_archive,
  collect_submitter_info,
  is_active,
  created_at,
  updated_at
) VALUES (
  'form-sample-001',
  'demo2024',
  '1',
  'Demo Evidence Submission',
  'Submit evidence for research investigations. All submissions are reviewed before being added to the evidence collection.',
  '[]',
  '[]',
  '["source_url","content_type","content_description","keywords","submitter_comments"]',
  1,
  1,
  1,
  1,
  0,
  1,
  datetime('now'),
  datetime('now')
);
