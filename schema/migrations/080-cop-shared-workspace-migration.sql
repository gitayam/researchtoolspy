-- Migration 080: Create dedicated workspaces for COP sessions sharing workspace f5478f35-1340-49e5-b3bb-c39f17b4197d
-- Same fix as 079 but for 4 sessions that were created with an explicit workspace UUID
-- instead of the default "1". They still cross-contaminate each other's entities.

-- Create dedicated workspace for cop-acccd999-110 (Loss of U.S. KC-135)
INSERT OR IGNORE INTO workspaces (id, name, description, type, owner_id, is_public, created_at, updated_at)
VALUES ('cop-acccd999-110', 'COP: Loss of U.S. KC-135', 'Workspace for COP session cop-acccd999-110', 'PERSONAL', 1, 0, '2026-03-12T00:00:00.000Z', '2026-03-12T00:00:00.000Z');

-- Create dedicated workspace for cop-a76d9b77-980 (debug test)
INSERT OR IGNORE INTO workspaces (id, name, description, type, owner_id, is_public, created_at, updated_at)
VALUES ('cop-a76d9b77-980', 'COP: debug test', 'Workspace for COP session cop-a76d9b77-980', 'PERSONAL', 1, 0, '2026-03-12T00:00:00.000Z', '2026-03-12T00:00:00.000Z');

-- Create dedicated workspace for cop-77893f12-485 (Iran Attacks)
INSERT OR IGNORE INTO workspaces (id, name, description, type, owner_id, is_public, created_at, updated_at)
VALUES ('cop-77893f12-485', 'COP: Iran Attacks', 'Workspace for COP session cop-77893f12-485', 'PERSONAL', 1, 0, '2026-03-12T00:00:00.000Z', '2026-03-12T00:00:00.000Z');

-- Create dedicated workspace for cop-5b827fff-15d (test workspace)
INSERT OR IGNORE INTO workspaces (id, name, description, type, owner_id, is_public, created_at, updated_at)
VALUES ('cop-5b827fff-15d', 'COP: test workspace', 'Workspace for COP session cop-5b827fff-15d', 'PERSONAL', 1, 0, '2026-03-12T00:00:00.000Z', '2026-03-12T00:00:00.000Z');

-- Update sessions to use their dedicated workspaces
UPDATE cop_sessions SET workspace_id = 'cop-acccd999-110' WHERE id = 'cop-acccd999-110' AND workspace_id = 'f5478f35-1340-49e5-b3bb-c39f17b4197d';
UPDATE cop_sessions SET workspace_id = 'cop-a76d9b77-980' WHERE id = 'cop-a76d9b77-980' AND workspace_id = 'f5478f35-1340-49e5-b3bb-c39f17b4197d';
UPDATE cop_sessions SET workspace_id = 'cop-77893f12-485' WHERE id = 'cop-77893f12-485' AND workspace_id = 'f5478f35-1340-49e5-b3bb-c39f17b4197d';
UPDATE cop_sessions SET workspace_id = 'cop-5b827fff-15d' WHERE id = 'cop-5b827fff-15d' AND workspace_id = 'f5478f35-1340-49e5-b3bb-c39f17b4197d';

-- Migrate evidence_items for the active session (cop-acccd999-110) to its new workspace
UPDATE evidence_items SET workspace_id = 'cop-acccd999-110' WHERE workspace_id = 'f5478f35-1340-49e5-b3bb-c39f17b4197d';
