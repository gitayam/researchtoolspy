-- Migration 093: Backfill dedicated workspaces for old COP sessions
--
-- Old COP sessions were created with workspace_id = '1' (shared default).
-- This caused entities from different sessions to bleed into each other.
-- New sessions auto-create a dedicated workspace (workspace_id = session ID).
--
-- This migration:
-- 1. Creates a workspace row for each old session that uses workspace_id = '1'
-- 2. Updates the session to use its own ID as workspace_id
-- 3. Reassigns actors in workspace '1' to the most likely COP session
--    (based on created_by matching the session owner)

-- Create dedicated workspaces for each old session
INSERT OR IGNORE INTO workspaces (id, name, description, type, owner_id, is_public, created_at, updated_at)
SELECT
  cs.id,
  'COP: ' || cs.name,
  'Auto-created workspace for COP session ' || cs.id,
  'PERSONAL',
  cs.created_by,
  0,
  cs.created_at,
  cs.created_at
FROM cop_sessions cs
WHERE cs.workspace_id = '1';

-- Update sessions to use their own ID as workspace_id
UPDATE cop_sessions
SET workspace_id = id
WHERE workspace_id = '1';
