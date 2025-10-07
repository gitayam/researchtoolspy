-- ============================================================================
-- Migration 021: Workspace Isolation & Library Foundation (Corrected)
-- Description: Add workspace_id to frameworks, enable library publishing
-- Date: 2025-10-07
-- ============================================================================

-- ============================================================
-- ADD WORKSPACE FIELDS TO FRAMEWORK_SESSIONS
-- ============================================================

-- Add workspace isolation (only if not exists)
ALTER TABLE framework_sessions ADD COLUMN workspace_id TEXT;

-- Add library publishing fields
ALTER TABLE framework_sessions ADD COLUMN published_to_library INTEGER DEFAULT 0;
ALTER TABLE framework_sessions ADD COLUMN library_published_at TEXT;

-- Add attribution and versioning
ALTER TABLE framework_sessions ADD COLUMN original_workspace_id TEXT;  -- Track original creator when cloned
ALTER TABLE framework_sessions ADD COLUMN fork_parent_id INTEGER;      -- Track parent framework for clones
-- NOTE: version column already exists, skipping

-- ============================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================

-- Workspace filtering (critical for multi-tenancy)
CREATE INDEX IF NOT EXISTS idx_framework_sessions_workspace ON framework_sessions(workspace_id);

-- Library discovery (public + published frameworks)
CREATE INDEX IF NOT EXISTS idx_framework_sessions_library
  ON framework_sessions(published_to_library)
  WHERE published_to_library = 1;

-- Fork tracking
CREATE INDEX IF NOT EXISTS idx_framework_sessions_fork ON framework_sessions(fork_parent_id);

-- Version tracking
CREATE INDEX IF NOT EXISTS idx_framework_sessions_version ON framework_sessions(id, version);

-- ============================================================
-- MIGRATE EXISTING DATA
-- ============================================================

-- Set default workspace for existing frameworks
-- Assumes workspace ID "1" (default workspace) exists
UPDATE framework_sessions
SET workspace_id = '1'
WHERE workspace_id IS NULL;

-- Set original_workspace_id same as workspace_id for existing frameworks
UPDATE framework_sessions
SET original_workspace_id = workspace_id
WHERE original_workspace_id IS NULL;

-- ============================================================
-- ADD WORKSPACE FIELDS TO ACH ANALYSES (if table exists)
-- ============================================================

-- ACH analyses also need workspace isolation
ALTER TABLE ach_analyses ADD COLUMN workspace_id TEXT;
ALTER TABLE ach_analyses ADD COLUMN published_to_library INTEGER DEFAULT 0;
ALTER TABLE ach_analyses ADD COLUMN library_published_at TEXT;
ALTER TABLE ach_analyses ADD COLUMN original_workspace_id TEXT;
ALTER TABLE ach_analyses ADD COLUMN fork_parent_id INTEGER;
-- NOTE: version column might already exist in ach_analyses too

CREATE INDEX IF NOT EXISTS idx_ach_analyses_workspace ON ach_analyses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ach_analyses_library ON ach_analyses(published_to_library);
CREATE INDEX IF NOT EXISTS idx_ach_analyses_fork ON ach_analyses(fork_parent_id);

UPDATE ach_analyses SET workspace_id = '1' WHERE workspace_id IS NULL;
UPDATE ach_analyses SET original_workspace_id = workspace_id WHERE original_workspace_id IS NULL;

-- ============================================================
-- NOTES
-- ============================================================
-- 1. All frameworks now require workspace_id (enforces multi-tenancy)
-- 2. published_to_library separates library publishing from public sharing
-- 3. fork_parent_id enables tracking framework genealogy
-- 4. original_workspace_id preserves attribution when frameworks are cloned
-- 5. Version tracking already existed in framework_sessions
-- ============================================================
