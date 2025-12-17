-- Add expiration and permanent save support to content_analysis
-- This enables 7-day auto-deletion for unsaved analyses while preserving saved ones

-- Add expires_at column for automatic cleanup (7 days default)
ALTER TABLE content_analysis ADD COLUMN expires_at TEXT;

-- Add is_saved flag to mark permanently saved analyses
ALTER TABLE content_analysis ADD COLUMN is_saved BOOLEAN DEFAULT FALSE;

-- Add share_token for shareable links (without UNIQUE constraint initially)
ALTER TABLE content_analysis ADD COLUMN share_token TEXT;

-- Add DIME analysis column
ALTER TABLE content_analysis ADD COLUMN dime_analysis TEXT; -- JSON

-- Update existing rows to have expiration (7 days from creation) if not saved
UPDATE content_analysis
SET expires_at = datetime(created_at, '+7 days')
WHERE is_saved = FALSE OR is_saved IS NULL;

-- Create index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_content_analysis_expires
ON content_analysis(expires_at)
WHERE expires_at IS NOT NULL;

-- Create index for share tokens
CREATE INDEX IF NOT EXISTS idx_content_analysis_share_token
ON content_analysis(share_token)
WHERE share_token IS NOT NULL;

-- Add comment
-- Cleanup strategy: Run periodic cleanup to delete expired unsaved content
-- Keep saved content indefinitely (is_saved = TRUE, expires_at = NULL)
