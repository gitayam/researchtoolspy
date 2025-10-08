-- ============================================================================
-- Migration 025: Content Intelligence Workspace Isolation
-- Description: Add workspace_id to content tables for multi-tenancy
-- Date: 2025-10-08
-- Priority: CRITICAL (Phase 1)
-- ============================================================================

-- ============================================================
-- ADD WORKSPACE ISOLATION TO CONTENT_ANALYSIS
-- ============================================================

-- Add workspace_id column (nullable first for migration)
ALTER TABLE content_analysis ADD COLUMN workspace_id TEXT;

-- Create index for workspace filtering (critical for performance)
CREATE INDEX IF NOT EXISTS idx_content_analysis_workspace ON content_analysis(workspace_id);

-- Create composite index for user + workspace queries
CREATE INDEX IF NOT EXISTS idx_content_analysis_user_workspace
  ON content_analysis(user_id, workspace_id);

-- Migrate existing data to default workspace
-- Assumes workspace ID "1" exists (default personal workspace)
UPDATE content_analysis
SET workspace_id = '1'
WHERE workspace_id IS NULL;

-- Future: Make workspace_id NOT NULL after migration complete
-- ALTER TABLE content_analysis ALTER COLUMN workspace_id SET NOT NULL;

-- ============================================================
-- ADD WORKSPACE ISOLATION TO SAVED_LINKS
-- ============================================================

-- Add workspace_id column
ALTER TABLE saved_links ADD COLUMN workspace_id TEXT;

-- Create index for workspace filtering
CREATE INDEX IF NOT EXISTS idx_saved_links_workspace ON saved_links(workspace_id);

-- Create composite index for user + workspace queries
CREATE INDEX IF NOT EXISTS idx_saved_links_user_workspace
  ON saved_links(user_id, workspace_id);

-- Migrate existing data to default workspace
UPDATE saved_links
SET workspace_id = '1'
WHERE workspace_id IS NULL;

-- ============================================================
-- ADD CONTENT HASH FOR DEDUPLICATION
-- ============================================================

-- Add content_hash column to content_analysis (if not exists)
-- Already exists in schema, but ensure index exists
CREATE INDEX IF NOT EXISTS idx_content_analysis_hash
  ON content_analysis(content_hash);

-- Create composite index for hash + workspace (dedupe per workspace)
CREATE INDEX IF NOT EXISTS idx_content_analysis_hash_workspace
  ON content_analysis(content_hash, workspace_id);

-- ============================================================
-- ADD BOOKMARK HASH SUPPORT FOR NON-AUTHENTICATED USERS
-- ============================================================

-- Add bookmark_hash column to content_analysis
ALTER TABLE content_analysis ADD COLUMN bookmark_hash TEXT;

-- Add bookmark_hash column to saved_links
ALTER TABLE saved_links ADD COLUMN bookmark_hash TEXT;

-- Create indexes for bookmark hash lookup
CREATE INDEX IF NOT EXISTS idx_content_analysis_bookmark
  ON content_analysis(bookmark_hash);
CREATE INDEX IF NOT EXISTS idx_saved_links_bookmark
  ON saved_links(bookmark_hash);

-- ============================================================
-- ADD CONTENT METADATA FOR TRACKING
-- ============================================================

-- Add access tracking to content_analysis
ALTER TABLE content_analysis ADD COLUMN access_count INTEGER DEFAULT 1;
ALTER TABLE content_analysis ADD COLUMN last_accessed_at TEXT DEFAULT (datetime('now'));

-- Add re-analysis tracking
ALTER TABLE content_analysis ADD COLUMN re_analyzed_count INTEGER DEFAULT 0;
ALTER TABLE content_analysis ADD COLUMN last_re_analyzed_at TEXT;

-- Create trigger to update access tracking
CREATE TRIGGER IF NOT EXISTS update_content_access_timestamp
AFTER UPDATE ON content_analysis
WHEN NEW.access_count > OLD.access_count
BEGIN
    UPDATE content_analysis
    SET last_accessed_at = datetime('now')
    WHERE id = NEW.id;
END;

-- ============================================================
-- NOTES
-- ============================================================
-- 1. workspace_id is nullable during migration, will be made NOT NULL later
-- 2. bookmark_hash allows non-authenticated users to access their content
-- 3. Content deduplication uses hash + workspace_id (same content, different workspaces = separate storage)
-- 4. Access tracking enables usage analytics and cache eviction policies
-- ============================================================
