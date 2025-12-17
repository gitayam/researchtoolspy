-- Add public sharing fields to framework_sessions table
-- Migration 012: Enable public/private sharing for frameworks

-- Add public sharing columns
ALTER TABLE framework_sessions ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE framework_sessions ADD COLUMN share_token TEXT;
ALTER TABLE framework_sessions ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE framework_sessions ADD COLUMN clone_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE framework_sessions ADD COLUMN category TEXT; -- Health, Civic, Economic, Social, Environmental, Education

-- Create indexes for public discovery and access
CREATE INDEX IF NOT EXISTS idx_framework_sessions_is_public ON framework_sessions(is_public);
CREATE INDEX IF NOT EXISTS idx_framework_sessions_share_token ON framework_sessions(share_token);
CREATE INDEX IF NOT EXISTS idx_framework_sessions_category ON framework_sessions(category);

-- Create view for public frameworks discovery
CREATE VIEW IF NOT EXISTS public_frameworks AS
SELECT
  id,
  title,
  description,
  framework_type,
  category,
  share_token,
  view_count,
  clone_count,
  created_at,
  updated_at,
  tags
FROM framework_sessions
WHERE is_public = 1;
