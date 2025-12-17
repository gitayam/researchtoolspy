-- ============================================================================
-- Migration: Create Comments System
-- Version: 020
-- Description: Threaded comments for COG, ACH, and other framework entities
--              with @mentions, resolve/unresolve workflow, and collaboration
-- ============================================================================

-- Comments table for threaded discussions on framework entities
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,

    -- Entity reference (what this comment is about)
    entity_type TEXT NOT NULL,  -- 'cog_analysis', 'cog', 'capability', 'requirement', 'vulnerability', 'ach_analysis', 'hypothesis', 'evidence', etc.
    entity_id TEXT NOT NULL,     -- ID of the entity being commented on

    -- Threading support
    parent_comment_id TEXT,       -- NULL for top-level comments, references comments.id for replies
    thread_root_id TEXT,          -- Root comment of this thread (for efficient querying)
    depth INTEGER DEFAULT 0,      -- Nesting depth (0 = root, 1 = first reply, etc.)

    -- Comment content
    content TEXT NOT NULL,        -- Markdown-supported comment text
    content_html TEXT,            -- Rendered HTML (cached for performance)

    -- User and metadata
    user_id TEXT NOT NULL,        -- User who created the comment
    user_hash TEXT,               -- Optional hash-based user identifier
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    edited BOOLEAN DEFAULT FALSE, -- Whether comment has been edited

    -- Mentions (@username references)
    mentioned_users TEXT,         -- JSON array of user IDs mentioned in comment

    -- Workflow status
    status TEXT DEFAULT 'open',   -- 'open', 'resolved', 'deleted'
    resolved_at DATETIME,         -- When comment was marked resolved
    resolved_by TEXT,             -- User ID who resolved the comment

    -- Metadata
    workspace_id INTEGER DEFAULT 1,
    reactions TEXT,               -- JSON object with reaction counts (👍, ❤️, etc.)

    -- Constraints
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (thread_root_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_comments_entity
    ON comments(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_comments_thread
    ON comments(thread_root_id);

CREATE INDEX IF NOT EXISTS idx_comments_parent
    ON comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_comments_user
    ON comments(user_id);

CREATE INDEX IF NOT EXISTS idx_comments_status
    ON comments(status);

CREATE INDEX IF NOT EXISTS idx_comments_created
    ON comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_workspace
    ON comments(workspace_id);

-- Composite index for common query pattern (entity + status + created date)
CREATE INDEX IF NOT EXISTS idx_comments_entity_status_created
    ON comments(entity_type, entity_id, status, created_at DESC);

-- Comment mentions table (for efficient @mention queries)
CREATE TABLE IF NOT EXISTS comment_mentions (
    id TEXT PRIMARY KEY,
    comment_id TEXT NOT NULL,
    mentioned_user_id TEXT NOT NULL,
    mentioned_user_hash TEXT,
    mentioned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read BOOLEAN DEFAULT FALSE,
    read_at DATETIME,
    workspace_id INTEGER DEFAULT 1,

    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comment_mentions_user
    ON comment_mentions(mentioned_user_id);

CREATE INDEX IF NOT EXISTS idx_comment_mentions_unread
    ON comment_mentions(mentioned_user_id, read);

CREATE INDEX IF NOT EXISTS idx_comment_mentions_comment
    ON comment_mentions(comment_id);

-- Comment notifications table (for collaboration features)
CREATE TABLE IF NOT EXISTS comment_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_hash TEXT,
    comment_id TEXT NOT NULL,
    notification_type TEXT NOT NULL, -- 'mention', 'reply', 'resolve', 'reaction'
    read BOOLEAN DEFAULT FALSE,
    read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    workspace_id INTEGER DEFAULT 1,

    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comment_notifications_user
    ON comment_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_comment_notifications_unread
    ON comment_notifications(user_id, read);

CREATE INDEX IF NOT EXISTS idx_comment_notifications_created
    ON comment_notifications(created_at DESC);

-- ============================================================================
-- Sample Data (for development/testing)
-- ============================================================================

-- Example: Comment on a COG analysis
-- INSERT INTO comments (id, entity_type, entity_id, content, user_id, user_hash)
-- VALUES (
--     'comment-001',
--     'cog_analysis',
--     'cog-123',
--     'Great analysis! The identified COG makes sense given the adversary''s reliance on logistics.',
--     'user-001',
--     'hash-abc123'
-- );

-- Example: Reply to a comment (threaded)
-- INSERT INTO comments (id, entity_type, entity_id, parent_comment_id, thread_root_id, depth, content, user_id)
-- VALUES (
--     'comment-002',
--     'cog_analysis',
--     'cog-123',
--     'comment-001',
--     'comment-001',
--     1,
--     'Agreed! We should also consider their C2 infrastructure as a secondary COG.',
--     'user-002'
-- );

-- Example: Comment with @mention
-- INSERT INTO comments (id, entity_type, entity_id, content, user_id, mentioned_users)
-- VALUES (
--     'comment-003',
--     'vulnerability',
--     'vuln-456',
--     '@analyst1 Can you verify this vulnerability assessment? The risk seems underestimated.',
--     'user-003',
--     '["analyst1"]'
-- );

-- ============================================================================
-- Cleanup (for rollback)
-- ============================================================================

-- DROP TABLE IF EXISTS comment_notifications;
-- DROP TABLE IF EXISTS comment_mentions;
-- DROP TABLE IF EXISTS comments;

-- ============================================================================
-- Migration Notes
-- ============================================================================
-- 1. Threading: Comments can nest up to reasonable depth (recommend max 5 levels in UI)
-- 2. Soft Delete: Use status='deleted' instead of hard delete to preserve thread structure
-- 3. Mentions: Parse @username patterns in content, store in mentioned_users JSON
-- 4. Reactions: Store as JSON object like {"thumbs_up": 5, "heart": 2}
-- 5. Performance: Composite index on entity_type + entity_id + status for main queries
-- 6. Notifications: Separate table for scalability (can be purged periodically)
-- 7. Workspace: Multi-tenancy support via workspace_id
-- 8. HTML Cache: Store rendered markdown as HTML for faster display
-- ============================================================================
