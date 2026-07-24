-- Composite indexes for the workspace-scoped hot paths identified by the
-- 2026-07-23 D1 index audit.
--
-- This migration is intentionally additive. Replacing the older single-column
-- indexes is a separately gated step after production D1 insights confirm the
-- new plans are being selected.
--
-- Rollback:
--   DROP INDEX idx_cop_collaborators_session_user;
--   DROP INDEX idx_workspace_members_user_workspace;
--   DROP INDEX idx_cop_sessions_owner_status_updated;
--   DROP INDEX idx_cop_sessions_workspace_status_owner_updated;
--   DROP INDEX idx_workspaces_owner_created;
--   DROP INDEX idx_framework_sessions_workspace_updated;
--   DROP INDEX idx_framework_sessions_workspace_type_updated;
--   DROP INDEX idx_evidence_items_workspace_created;
--   DROP INDEX idx_evidence_items_workspace_status_created;
--   DROP INDEX idx_actors_workspace_created;
--   DROP INDEX idx_actors_workspace_type_created;
--   DROP INDEX idx_sources_workspace_created;
--   DROP INDEX idx_sources_workspace_type_created;
--   DROP INDEX idx_events_workspace_date;
--   DROP INDEX idx_events_workspace_type_date;
--   DROP INDEX idx_places_workspace_created;
--   DROP INDEX idx_places_workspace_type_created;
--   DROP INDEX idx_behaviors_workspace_created;
--   DROP INDEX idx_behaviors_workspace_type_created;
--   DROP INDEX idx_relationships_workspace_created;
--   DROP INDEX idx_relationships_workspace_type_created;
--   DROP INDEX idx_cop_activity_session_created;
--   DROP INDEX idx_cop_tasks_session_status;
--   DROP INDEX idx_cop_tasks_session_assigned;

-- Authorization probes. These are covering indexes for SELECT 1 / workspace_id
-- lookups, so access checks do not fetch unrelated rows from the base table.
CREATE INDEX IF NOT EXISTS idx_cop_collaborators_session_user
  ON cop_collaborators(cop_session_id, user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_workspace
  ON workspace_members(user_id, workspace_id);

-- Session and workspace list paths.
CREATE INDEX IF NOT EXISTS idx_cop_sessions_owner_status_updated
  ON cop_sessions(created_by, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cop_sessions_workspace_status_owner_updated
  ON cop_sessions(workspace_id, status, created_by, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_created
  ON workspaces(owner_id, created_at DESC);

-- Framework and evidence lists.
CREATE INDEX IF NOT EXISTS idx_framework_sessions_workspace_updated
  ON framework_sessions(workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_framework_sessions_workspace_type_updated
  ON framework_sessions(workspace_id, framework_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_items_workspace_created
  ON evidence_items(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_items_workspace_status_created
  ON evidence_items(workspace_id, status, created_at DESC);

-- Entity lists. The first index serves the unfiltered recency query; the
-- second avoids filtering a whole workspace when the endpoint's type filter
-- is present.
CREATE INDEX IF NOT EXISTS idx_actors_workspace_created
  ON actors(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_actors_workspace_type_created
  ON actors(workspace_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sources_workspace_created
  ON sources(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sources_workspace_type_created
  ON sources(workspace_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_workspace_date
  ON events(workspace_id, date_start DESC);

CREATE INDEX IF NOT EXISTS idx_events_workspace_type_date
  ON events(workspace_id, event_type, date_start DESC);

CREATE INDEX IF NOT EXISTS idx_places_workspace_created
  ON places(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_places_workspace_type_created
  ON places(workspace_id, place_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_behaviors_workspace_created
  ON behaviors(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_behaviors_workspace_type_created
  ON behaviors(workspace_id, behavior_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_relationships_workspace_created
  ON relationships(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_relationships_workspace_type_created
  ON relationships(workspace_id, relationship_type, created_at DESC);

-- COP activity and task filters.
CREATE INDEX IF NOT EXISTS idx_cop_activity_session_created
  ON cop_activity(cop_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cop_tasks_session_status
  ON cop_tasks(cop_session_id, status);

CREATE INDEX IF NOT EXISTS idx_cop_tasks_session_assigned
  ON cop_tasks(cop_session_id, assigned_to);
