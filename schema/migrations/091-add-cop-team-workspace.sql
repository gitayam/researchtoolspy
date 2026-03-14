-- 091-add-cop-team-workspace.sql
-- Adds team_workspace_id to cop_sessions for collaboration workspace browser.
-- Existing sessions will have team_workspace_id = NULL.
-- They must be assigned via COP session settings or a backfill migration.

ALTER TABLE cop_sessions ADD COLUMN team_workspace_id TEXT;
CREATE INDEX IF NOT EXISTS idx_cop_sessions_team_workspace ON cop_sessions(team_workspace_id);
