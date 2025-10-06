-- Add public sharing fields to ACH analyses
-- Migration 013: Enable public/private sharing for ACH analyses

-- Add public sharing columns
ALTER TABLE ach_analyses ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ach_analyses ADD COLUMN share_token TEXT;
ALTER TABLE ach_analyses ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ach_analyses ADD COLUMN clone_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ach_analyses ADD COLUMN domain TEXT; -- intelligence, security, business, research, medical, legal
ALTER TABLE ach_analyses ADD COLUMN tags TEXT; -- JSON array of tags for discovery
ALTER TABLE ach_analyses ADD COLUMN shared_publicly_at DATETIME;

-- Create indexes for public discovery and access
CREATE INDEX IF NOT EXISTS idx_ach_analyses_is_public ON ach_analyses(is_public);
CREATE INDEX IF NOT EXISTS idx_ach_analyses_share_token ON ach_analyses(share_token);
CREATE INDEX IF NOT EXISTS idx_ach_analyses_domain ON ach_analyses(domain);

-- Create view for public ACH analyses discovery
CREATE VIEW IF NOT EXISTS public_ach_analyses AS
SELECT
  id,
  title,
  description,
  question,
  analyst,
  organization,
  domain,
  tags,
  share_token,
  view_count,
  clone_count,
  created_at,
  updated_at,
  shared_publicly_at
FROM ach_analyses
WHERE is_public = 1;

-- Collaboration tables for team analysis
CREATE TABLE IF NOT EXISTS ach_collaborators (
  id TEXT PRIMARY KEY,
  ach_analysis_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('viewer', 'scorer', 'editor', 'owner')),
  invited_by TEXT,
  invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME,
  FOREIGN KEY (ach_analysis_id) REFERENCES ach_analyses(id) ON DELETE CASCADE,
  UNIQUE(ach_analysis_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ach_collaborators_analysis_id ON ach_collaborators(ach_analysis_id);
CREATE INDEX IF NOT EXISTS idx_ach_collaborators_user_id ON ach_collaborators(user_id);
