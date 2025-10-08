-- ============================================================================
-- Migration 023: Notifications and Activity Feed System
-- ============================================================================
-- Purpose: Enable user notifications for framework events and team activity tracking
-- Created: 2025-10-07
-- Dependencies: workspace_members, framework_sessions, library_frameworks
-- ============================================================================

-- ============================================================================
-- 1. USER NOTIFICATIONS TABLE
-- ============================================================================
-- Stores all user notifications with delivery tracking
CREATE TABLE IF NOT EXISTS user_notifications (
    id TEXT PRIMARY KEY,
    user_hash TEXT NOT NULL,
    workspace_id TEXT,
    notification_type TEXT NOT NULL, -- 'framework_update', 'comment', 'mention', 'fork', 'vote', 'rating', 'invite', 'share'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT, -- URL to navigate when notification clicked
    entity_type TEXT, -- 'framework', 'comment', 'library_item', etc.
    entity_id TEXT,
    actor_hash TEXT, -- Who triggered this notification
    actor_name TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TEXT NOT NULL,
    read_at TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON user_notifications(user_hash, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON user_notifications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON user_notifications(workspace_id, created_at DESC);

-- ============================================================================
-- 2. SUBSCRIPTION PREFERENCES TABLE
-- ============================================================================
-- User preferences for what notifications they want to receive
CREATE TABLE IF NOT EXISTS subscription_preferences (
    id TEXT PRIMARY KEY,
    user_hash TEXT NOT NULL,
    workspace_id TEXT,
    entity_type TEXT NOT NULL, -- 'framework', 'library_item', 'workspace', 'user'
    entity_id TEXT NOT NULL,
    notify_on_update BOOLEAN DEFAULT TRUE,
    notify_on_comment BOOLEAN DEFAULT TRUE,
    notify_on_mention BOOLEAN DEFAULT TRUE,
    notify_on_fork BOOLEAN DEFAULT FALSE,
    notify_on_vote BOOLEAN DEFAULT FALSE,
    notify_on_rating BOOLEAN DEFAULT FALSE,
    subscribed_at TEXT NOT NULL,
    UNIQUE(user_hash, entity_type, entity_id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscription_prefs ON subscription_preferences(user_hash, entity_type, entity_id);

-- ============================================================================
-- 3. ACTIVITY FEED TABLE
-- ============================================================================
-- Tracks all workspace activities for team awareness
CREATE TABLE IF NOT EXISTS activity_feed (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_hash TEXT NOT NULL,
    user_name TEXT,
    activity_type TEXT NOT NULL, -- 'create', 'update', 'delete', 'comment', 'vote', 'fork', 'publish', 'share', 'invite'
    entity_type TEXT NOT NULL, -- 'framework', 'library_item', 'comment', 'evidence', 'entity'
    entity_id TEXT,
    entity_title TEXT,
    action_summary TEXT NOT NULL, -- Human readable: "John created COG Analysis"
    metadata TEXT, -- JSON with additional details
    created_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activity_feed(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_feed(user_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_feed(entity_type, entity_id);

-- ============================================================================
-- 4. FRAMEWORK VIEW ANALYTICS TABLE
-- ============================================================================
-- Track framework views for analytics
CREATE TABLE IF NOT EXISTS framework_views (
    id TEXT PRIMARY KEY,
    framework_id TEXT NOT NULL,
    framework_type TEXT NOT NULL,
    user_hash TEXT,
    workspace_id TEXT,
    viewed_at TEXT NOT NULL,
    view_duration_seconds INTEGER DEFAULT 0,
    FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_views_framework ON framework_views(framework_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_views_user ON framework_views(user_hash, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_views_workspace ON framework_views(workspace_id, viewed_at DESC);

-- ============================================================================
-- 5. FRAMEWORK ANALYTICS AGGREGATES TABLE
-- ============================================================================
-- Pre-computed analytics for dashboards
CREATE TABLE IF NOT EXISTS framework_analytics (
    framework_id TEXT PRIMARY KEY,
    total_views INTEGER DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    total_forks INTEGER DEFAULT 0,
    total_votes INTEGER DEFAULT 0,
    avg_rating REAL DEFAULT 0.0,
    last_viewed_at TEXT,
    last_commented_at TEXT,
    last_updated_at TEXT NOT NULL,
    FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE
);

-- ============================================================================
-- 6. WORKSPACE ACTIVITY SUMMARY TABLE
-- ============================================================================
-- Daily/weekly activity summaries per workspace
CREATE TABLE IF NOT EXISTS workspace_activity_summary (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    summary_date TEXT NOT NULL, -- YYYY-MM-DD
    total_activities INTEGER DEFAULT 0,
    frameworks_created INTEGER DEFAULT 0,
    frameworks_updated INTEGER DEFAULT 0,
    comments_added INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    top_contributors TEXT, -- JSON array of user hashes
    UNIQUE(workspace_id, summary_date),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_summary_workspace ON workspace_activity_summary(workspace_id, summary_date DESC);

-- ============================================================================
-- 7. TRIGGERS FOR AUTO-UPDATING ANALYTICS
-- ============================================================================

-- Trigger: Update framework view count
CREATE TRIGGER IF NOT EXISTS update_framework_view_count
AFTER INSERT ON framework_views
BEGIN
    INSERT INTO framework_analytics (framework_id, total_views, unique_viewers, last_viewed_at, last_updated_at)
    VALUES (
        NEW.framework_id,
        1,
        1,
        NEW.viewed_at,
        datetime('now')
    )
    ON CONFLICT(framework_id) DO UPDATE SET
        total_views = total_views + 1,
        unique_viewers = (
            SELECT COUNT(DISTINCT user_hash)
            FROM framework_views
            WHERE framework_id = NEW.framework_id
        ),
        last_viewed_at = NEW.viewed_at,
        last_updated_at = datetime('now');
END;

-- Trigger: Update framework comment count
CREATE TRIGGER IF NOT EXISTS update_framework_comment_count
AFTER INSERT ON comments
BEGIN
    INSERT INTO framework_analytics (framework_id, total_comments, last_commented_at, last_updated_at)
    VALUES (
        NEW.entity_id,
        1,
        NEW.created_at,
        datetime('now')
    )
    ON CONFLICT(framework_id) DO UPDATE SET
        total_comments = total_comments + 1,
        last_commented_at = NEW.created_at,
        last_updated_at = datetime('now')
    WHERE NEW.entity_type IN ('cog_analysis', 'framework');
END;

-- ============================================================================
-- 8. SAMPLE DATA FOR TESTING
-- ============================================================================

-- Sample notification types and their templates
-- INSERT INTO user_notifications (id, user_hash, notification_type, title, message, action_url, created_at)
-- VALUES (
--     'notif-sample-1',
--     'user123',
--     'framework_update',
--     'Framework Updated',
--     'John Doe updated "Enemy COG Analysis"',
--     '/dashboard/frameworks/cog/abc123',
--     datetime('now')
-- );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables Created: 6
-- Indexes Created: 10
-- Triggers Created: 2
-- Estimated Rows: 1000s (notifications), 100s (activity), 10s (analytics)
-- ============================================================================
