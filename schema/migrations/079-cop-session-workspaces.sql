-- Migration 079: Create dedicated workspaces for existing COP sessions
-- Previously all COP sessions shared workspace_id "1", causing entity
-- cross-contamination between sessions. This creates a unique workspace
-- per session and updates the session's workspace_id.

-- Create workspace for cop-0b2c7e49-cf9 (Event Monitor - Iran)
INSERT OR IGNORE INTO workspaces (id, name, description, type, owner_id, is_public, created_at, updated_at)
VALUES ('cop-0b2c7e49-cf9', 'COP: Event Monitor - Iran', 'Workspace for COP session cop-0b2c7e49-cf9', 'PERSONAL', 1, 0, '2026-03-12T00:00:00.000Z', '2026-03-12T00:00:00.000Z');

-- Create workspace for cop-2b1e9887-34c (Quick Brief - iran)
INSERT OR IGNORE INTO workspaces (id, name, description, type, owner_id, is_public, created_at, updated_at)
VALUES ('cop-2b1e9887-34c', 'COP: Quick Brief - iran', 'Workspace for COP session cop-2b1e9887-34c', 'PERSONAL', 1, 0, '2026-03-12T00:00:00.000Z', '2026-03-12T00:00:00.000Z');

-- Update COP sessions to use their dedicated workspaces
UPDATE cop_sessions SET workspace_id = 'cop-0b2c7e49-cf9' WHERE id = 'cop-0b2c7e49-cf9' AND workspace_id = '1';
UPDATE cop_sessions SET workspace_id = 'cop-2b1e9887-34c' WHERE id = 'cop-2b1e9887-34c' AND workspace_id = '1';
