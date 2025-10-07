-- ============================================================================
-- Migration 024: Activity Feed System
-- Description: Track team activity for collaboration and awareness
-- Date: 2025-10-07
-- ============================================================================

-- ============================================================
-- ACTIVITY FEED
-- Workspace-scoped activity log for collaboration
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_feed (
  id TEXT PRIMARY KEY,

  -- Workspace
  workspace_id TEXT NOT NULL,

  -- Actor (who performed the action)
  actor_user_id TEXT NOT NULL,           -- User who performed action
  actor_user_hash TEXT,                  -- Hash for guest users
  actor_nickname TEXT,                   -- Denormalized for fast display

  -- Action
  action_type TEXT NOT NULL,             -- CREATED, UPDATED, DELETED, COMMENTED, VOTED, RATED, SHARED, FORKED, PUBLISHED, CLONED

  -- Target entity
  entity_type TEXT NOT NULL,             -- FRAMEWORK, ENTITY, COMMENT, WORKSPACE, MEMBER
  entity_id TEXT NOT NULL,
  entity_title TEXT,                     -- Denormalized for fast display

  -- Additional context
  details TEXT,                          -- JSON with action-specific details

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Primary query: Recent activity in workspace
CREATE INDEX IF NOT EXISTS idx_activity_feed_workspace
  ON activity_feed(workspace_id, created_at DESC);

-- Query by actor (user's activity history)
CREATE INDEX IF NOT EXISTS idx_activity_feed_actor
  ON activity_feed(actor_user_id, created_at DESC);

-- Query by entity (activity on specific framework/entity)
CREATE INDEX IF NOT EXISTS idx_activity_feed_entity
  ON activity_feed(entity_type, entity_id, created_at DESC);

-- Query by action type (filter by action)
CREATE INDEX IF NOT EXISTS idx_activity_feed_action
  ON activity_feed(action_type, created_at DESC);

-- Composite index for workspace + action type
CREATE INDEX IF NOT EXISTS idx_activity_feed_workspace_action
  ON activity_feed(workspace_id, action_type, created_at DESC);

-- ============================================================
-- GLOBAL ACTIVITY FEED (PUBLIC LIBRARY)
-- Track public library activity (cross-workspace)
-- ============================================================

CREATE TABLE IF NOT EXISTS public_activity_feed (
  id TEXT PRIMARY KEY,

  -- Actor
  actor_user_id TEXT,                    -- Can be NULL for anonymous
  actor_workspace_id TEXT,               -- Actor's workspace (for attribution)
  actor_workspace_name TEXT,             -- Denormalized

  -- Action
  action_type TEXT NOT NULL,             -- PUBLISHED, VOTED, RATED, COMMENTED, CLONED, FORKED

  -- Target (public framework)
  framework_id INTEGER NOT NULL,
  framework_title TEXT,
  framework_type TEXT,

  -- Additional context
  details TEXT,                          -- JSON with action-specific details

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE
);

-- Primary query: Recent public activity
CREATE INDEX IF NOT EXISTS idx_public_activity_feed_created
  ON public_activity_feed(created_at DESC);

-- Query by framework
CREATE INDEX IF NOT EXISTS idx_public_activity_feed_framework
  ON public_activity_feed(framework_id, created_at DESC);

-- Query by action type
CREATE INDEX IF NOT EXISTS idx_public_activity_feed_action
  ON public_activity_feed(action_type, created_at DESC);

-- ============================================================
-- USER ACTIVITY SUMMARY
-- Aggregate statistics for user profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS user_activity_summary (
  user_id TEXT PRIMARY KEY,

  -- Counts
  frameworks_created INTEGER DEFAULT 0,
  frameworks_updated INTEGER DEFAULT 0,
  comments_posted INTEGER DEFAULT 0,
  votes_cast INTEGER DEFAULT 0,
  ratings_given INTEGER DEFAULT 0,
  frameworks_cloned INTEGER DEFAULT 0,
  frameworks_published INTEGER DEFAULT 0,

  -- Reputation (derived from activity + community feedback)
  reputation_score INTEGER DEFAULT 0,

  -- Metadata
  first_activity_at TEXT,
  last_activity_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_activity_summary_reputation
  ON user_activity_summary(reputation_score DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_summary_last_activity
  ON user_activity_summary(last_activity_at DESC);

-- ============================================================
-- WORKSPACE ACTIVITY SUMMARY
-- Aggregate statistics for workspaces
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace_activity_summary (
  workspace_id TEXT PRIMARY KEY,

  -- Counts
  frameworks_created INTEGER DEFAULT 0,
  frameworks_published INTEGER DEFAULT 0,
  total_members INTEGER DEFAULT 0,
  active_members_7d INTEGER DEFAULT 0,     -- Active in last 7 days
  active_members_30d INTEGER DEFAULT 0,    -- Active in last 30 days

  -- Engagement
  total_comments INTEGER DEFAULT 0,
  total_votes_received INTEGER DEFAULT 0,
  total_ratings_received INTEGER DEFAULT 0,
  average_framework_rating REAL DEFAULT 0.0,

  -- Metadata
  last_activity_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_summary_last_activity
  ON workspace_activity_summary(last_activity_at DESC);

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- View: Recent workspace activity (with actor names)
CREATE VIEW IF NOT EXISTS workspace_activity_recent AS
SELECT
  af.*,
  wm.nickname as actor_display_name
FROM activity_feed af
LEFT JOIN workspace_members wm
  ON af.workspace_id = wm.workspace_id
  AND af.actor_user_id = CAST(wm.user_id AS TEXT)
ORDER BY af.created_at DESC;

-- View: User activity timeline (across all workspaces)
CREATE VIEW IF NOT EXISTS user_activity_timeline AS
SELECT
  actor_user_id as user_id,
  action_type,
  entity_type,
  entity_id,
  entity_title,
  workspace_id,
  created_at
FROM activity_feed
WHERE actor_user_id IS NOT NULL
ORDER BY created_at DESC;

-- View: Most active users (last 30 days)
CREATE VIEW IF NOT EXISTS most_active_users_30d AS
SELECT
  actor_user_id as user_id,
  COUNT(*) as activity_count,
  MAX(created_at) as last_activity_at
FROM activity_feed
WHERE created_at >= datetime('now', '-30 days')
  AND actor_user_id IS NOT NULL
GROUP BY actor_user_id
ORDER BY activity_count DESC;

-- View: Most active workspaces (last 30 days)
CREATE VIEW IF NOT EXISTS most_active_workspaces_30d AS
SELECT
  workspace_id,
  COUNT(*) as activity_count,
  COUNT(DISTINCT actor_user_id) as unique_actors,
  MAX(created_at) as last_activity_at
FROM activity_feed
WHERE created_at >= datetime('now', '-30 days')
GROUP BY workspace_id
ORDER BY activity_count DESC;

-- ============================================================
-- ACTIVITY LOGGING HELPERS
-- (Application-level functions, documented here)
-- ============================================================

-- Example: Log framework creation
-- INSERT INTO activity_feed (
--   id, workspace_id, actor_user_id, action_type,
--   entity_type, entity_id, entity_title
-- ) VALUES (
--   'act-123', 'ws-456', 'user-789', 'CREATED',
--   'FRAMEWORK', '999', 'Russian Logistics COG'
-- );

-- Example: Log comment with details
-- INSERT INTO activity_feed (
--   id, workspace_id, actor_user_id, action_type,
--   entity_type, entity_id, entity_title, details
-- ) VALUES (
--   'act-124', 'ws-456', 'user-789', 'COMMENTED',
--   'FRAMEWORK', '999', 'Russian Logistics COG',
--   '{"comment_preview": "Great analysis...", "comment_id": "cmt-123"}'
-- );

-- ============================================================
-- CLEANUP POLICY
-- ============================================================

-- Activity feed retention:
-- - Workspace activity: 90 days (configurable)
-- - Public activity: 30 days (configurable)
-- - Summary tables: Never delete (aggregates only)

-- Example cleanup query (run periodically):
-- DELETE FROM activity_feed
-- WHERE created_at < datetime('now', '-90 days');

-- DELETE FROM public_activity_feed
-- WHERE created_at < datetime('now', '-30 days');

-- ============================================================
-- NOTES
-- ============================================================
-- 1. Activity feed is workspace-scoped for privacy
-- 2. Public activity feed is global (for library discovery)
-- 3. Denormalized fields (entity_title, actor_nickname) for fast display
-- 4. JSON details field for flexible action metadata
-- 5. Summary tables for fast statistics (updated via triggers/jobs)
-- 6. Views provide pre-aggregated common queries
-- 7. Indexes optimized for recency-based queries
-- 8. Periodic cleanup prevents table growth
-- ============================================================
