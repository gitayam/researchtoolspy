-- ============================================================================
-- Migration 023: Subscriptions & Notifications System
-- Description: Enable users to follow frameworks and receive notifications
-- Date: 2025-10-07
-- ============================================================================

-- ============================================================
-- FRAMEWORK SUBSCRIPTIONS
-- Follow frameworks for updates, comments, forks
-- ============================================================

CREATE TABLE IF NOT EXISTS framework_subscriptions (
  id TEXT PRIMARY KEY,

  -- Subscription
  framework_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  user_hash TEXT,                     -- Support for guest users

  -- Notification preferences (granular control)
  notify_updates INTEGER DEFAULT 1,      -- Framework content updated
  notify_comments INTEGER DEFAULT 1,     -- New comments added
  notify_forks INTEGER DEFAULT 0,        -- Framework forked/cloned
  notify_ratings INTEGER DEFAULT 0,      -- New ratings added

  -- Metadata
  workspace_id INTEGER NOT NULL DEFAULT 1,
  subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_notified_at TEXT,                 -- Prevent notification spam

  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  UNIQUE(framework_id, user_id)  -- One subscription per user per framework
);

CREATE INDEX IF NOT EXISTS idx_framework_subscriptions_framework
  ON framework_subscriptions(framework_id);

CREATE INDEX IF NOT EXISTS idx_framework_subscriptions_user
  ON framework_subscriptions(user_id);

-- Fast lookup for notification generation
CREATE INDEX IF NOT EXISTS idx_framework_subscriptions_notify
  ON framework_subscriptions(framework_id, notify_updates)
  WHERE notify_updates = 1;

-- ============================================================
-- USER NOTIFICATIONS
-- Cross-cutting notification system for all events
-- ============================================================

CREATE TABLE IF NOT EXISTS user_notifications (
  id TEXT PRIMARY KEY,

  -- User
  user_id TEXT NOT NULL,
  user_hash TEXT,                     -- Support for guest users

  -- Notification type
  notification_type TEXT NOT NULL,    -- MENTION, REPLY, SUBSCRIPTION_UPDATE, VOTE, RATE, SHARE, FORK

  -- Source reference
  source_type TEXT NOT NULL,          -- COMMENT, FRAMEWORK, ACTIVITY, ENTITY
  source_id TEXT NOT NULL,

  -- Content
  title TEXT NOT NULL,                -- Brief title (e.g., "New comment on your framework")
  message TEXT NOT NULL,              -- Detailed message
  link_url TEXT,                      -- Deep link to relevant page

  -- State
  read INTEGER DEFAULT 0,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Workspace context (optional)
  workspace_id TEXT
);

-- Fast lookup for user's unread notifications
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON user_notifications(user_id, read, created_at DESC);

-- Fast lookup for all user notifications (read + unread)
CREATE INDEX IF NOT EXISTS idx_user_notifications_user
  ON user_notifications(user_id, created_at DESC);

-- Filtering by notification type
CREATE INDEX IF NOT EXISTS idx_user_notifications_type
  ON user_notifications(notification_type);

-- Workspace-scoped notifications
CREATE INDEX IF NOT EXISTS idx_user_notifications_workspace
  ON user_notifications(workspace_id, created_at DESC);

-- ============================================================
-- ENTITY SUBSCRIPTIONS (for future entity library)
-- Follow actors, sources, behaviors, etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS entity_subscriptions (
  id TEXT PRIMARY KEY,

  -- Entity reference
  entity_type TEXT CHECK(entity_type IN ('ACTOR', 'SOURCE', 'EVENT', 'PLACE', 'BEHAVIOR', 'EVIDENCE')) NOT NULL,
  entity_id TEXT NOT NULL,

  -- Subscription
  user_id TEXT NOT NULL,
  user_hash TEXT,

  -- Notification preferences
  notify_updates INTEGER DEFAULT 1,
  notify_relationships INTEGER DEFAULT 1,  -- New relationships added
  notify_mentions INTEGER DEFAULT 1,       -- Entity mentioned in framework

  -- Metadata
  workspace_id INTEGER NOT NULL DEFAULT 1,
  subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_notified_at TEXT,

  UNIQUE(entity_type, entity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_subscriptions_entity
  ON entity_subscriptions(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_entity_subscriptions_user
  ON entity_subscriptions(user_id);

-- ============================================================
-- NOTIFICATION DELIVERY LOG
-- Track notification delivery for debugging/analytics
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id TEXT PRIMARY KEY,

  notification_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Delivery method
  delivery_method TEXT CHECK(delivery_method IN ('IN_APP', 'EMAIL', 'WEBHOOK')) DEFAULT 'IN_APP',

  -- Status
  status TEXT CHECK(status IN ('PENDING', 'SENT', 'FAILED', 'BOUNCED')) DEFAULT 'PENDING',
  sent_at TEXT,
  error_message TEXT,

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (notification_id) REFERENCES user_notifications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_notification
  ON notification_delivery_log(notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_status
  ON notification_delivery_log(status, created_at DESC);

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- View: User's unread notification count
CREATE VIEW IF NOT EXISTS user_unread_notification_counts AS
SELECT
  user_id,
  COUNT(*) as unread_count,
  MAX(created_at) as latest_notification_at
FROM user_notifications
WHERE read = 0
GROUP BY user_id;

-- View: Framework subscriber counts
CREATE VIEW IF NOT EXISTS framework_subscriber_counts AS
SELECT
  framework_id,
  COUNT(*) as total_subscribers,
  SUM(notify_updates) as notify_updates_count,
  SUM(notify_comments) as notify_comments_count,
  SUM(notify_forks) as notify_forks_count
FROM framework_subscriptions
GROUP BY framework_id;

-- ============================================================
-- TRIGGERS FOR AUTO-SUBSCRIPTION
-- Auto-subscribe users when they interact with frameworks
-- ============================================================

-- Auto-subscribe when user comments on framework
-- (This would be implemented in application logic, not SQL trigger)
-- Reason: Cloudflare D1 has limited trigger support

-- ============================================================
-- CLEANUP POLICY
-- Automatically clean old notifications (application-level)
-- ============================================================

-- Note: Implement in API as periodic cleanup job
-- - Delete notifications older than 30 days (configurable)
-- - Keep unread notifications indefinitely
-- - Archive read notifications to separate table (optional)

-- Example cleanup query (run periodically):
-- DELETE FROM user_notifications
-- WHERE read = 1
--   AND created_at < datetime('now', '-30 days');

-- ============================================================
-- NOTES
-- ============================================================
-- 1. Subscriptions enable "follow" functionality for frameworks
-- 2. Granular notification preferences (update/comment/fork/rating)
-- 3. last_notified_at prevents notification spam
-- 4. Notifications support deep links for quick navigation
-- 5. Delivery log tracks notification success/failure
-- 6. Views provide fast aggregated statistics
-- 7. Auto-subscribe logic implemented in application (not triggers)
-- 8. Periodic cleanup prevents notification table growth
-- ============================================================
