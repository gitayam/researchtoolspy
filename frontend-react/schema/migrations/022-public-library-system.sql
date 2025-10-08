-- ============================================================================
-- Migration: Public Library System
-- Version: 022
-- Description: Public framework library with voting, ratings, subscriptions
--              Builds on workspace isolation from migration 021
-- ============================================================================

-- Library metadata for published frameworks
CREATE TABLE IF NOT EXISTS library_frameworks (
    id TEXT PRIMARY KEY,
    framework_id TEXT NOT NULL,           -- References framework_sessions.id or ach_analyses.id
    framework_type TEXT NOT NULL,         -- 'cog', 'ach', 'swot', 'pest', etc.

    -- Publishing metadata
    published_by TEXT NOT NULL,           -- user_hash who published
    published_at TEXT NOT NULL,
    unpublished_at TEXT,                  -- NULL if still published
    is_published BOOLEAN DEFAULT TRUE,

    -- Discovery metadata
    title TEXT NOT NULL,
    description TEXT,
    tags TEXT,                            -- JSON array of tags for discovery
    category TEXT,                        -- 'adversary_analysis', 'friendly_analysis', etc.

    -- Engagement metrics
    view_count INTEGER DEFAULT 0,
    fork_count INTEGER DEFAULT 0,
    vote_score INTEGER DEFAULT 0,        -- Net votes (upvotes - downvotes)
    rating_avg REAL DEFAULT 0.0,         -- Average star rating (0-5)
    rating_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,

    -- Version tracking
    version INTEGER DEFAULT 1,
    last_updated TEXT NOT NULL,

    -- Workspace origin
    original_workspace_id TEXT NOT NULL,

    -- Search optimization
    search_text TEXT,                     -- Concatenated searchable content

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE
);

-- Indexes for library discovery
CREATE INDEX IF NOT EXISTS idx_library_published
    ON library_frameworks(is_published, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_library_type
    ON library_frameworks(framework_type, is_published);

CREATE INDEX IF NOT EXISTS idx_library_category
    ON library_frameworks(category, is_published);

CREATE INDEX IF NOT EXISTS idx_library_popularity
    ON library_frameworks(vote_score DESC, view_count DESC);

CREATE INDEX IF NOT EXISTS idx_library_search
    ON library_frameworks(search_text);

-- Full-text search index (if supported)
-- CREATE VIRTUAL TABLE library_search USING fts5(title, description, tags, content=library_frameworks);

-- Votes on library frameworks
CREATE TABLE IF NOT EXISTS library_votes (
    id TEXT PRIMARY KEY,
    library_framework_id TEXT NOT NULL,
    user_hash TEXT NOT NULL,
    vote_type TEXT NOT NULL,              -- 'up' or 'down'
    voted_at TEXT DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(library_framework_id, user_hash),
    FOREIGN KEY (library_framework_id) REFERENCES library_frameworks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_library_votes_framework
    ON library_votes(library_framework_id);

CREATE INDEX IF NOT EXISTS idx_library_votes_user
    ON library_votes(user_hash);

-- Star ratings on library frameworks
CREATE TABLE IF NOT EXISTS library_ratings (
    id TEXT PRIMARY KEY,
    library_framework_id TEXT NOT NULL,
    user_hash TEXT NOT NULL,
    rating INTEGER NOT NULL,              -- 1-5 stars
    review_text TEXT,
    rated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(library_framework_id, user_hash),
    FOREIGN KEY (library_framework_id) REFERENCES library_frameworks(id) ON DELETE CASCADE,
    CHECK (rating >= 1 AND rating <= 5)
);

CREATE INDEX IF NOT EXISTS idx_library_ratings_framework
    ON library_ratings(library_framework_id);

CREATE INDEX IF NOT EXISTS idx_library_ratings_user
    ON library_ratings(user_hash);

-- Framework forks tracking
CREATE TABLE IF NOT EXISTS library_forks (
    id TEXT PRIMARY KEY,
    parent_library_framework_id TEXT NOT NULL,  -- Original framework in library
    forked_framework_id TEXT NOT NULL,          -- New framework created by fork
    forked_framework_type TEXT NOT NULL,
    forked_by_user_hash TEXT NOT NULL,
    forked_to_workspace_id TEXT NOT NULL,
    forked_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (parent_library_framework_id) REFERENCES library_frameworks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_library_forks_parent
    ON library_forks(parent_library_framework_id);

CREATE INDEX IF NOT EXISTS idx_library_forks_user
    ON library_forks(forked_by_user_hash);

-- Framework subscriptions (notifications for updates)
CREATE TABLE IF NOT EXISTS library_subscriptions (
    id TEXT PRIMARY KEY,
    library_framework_id TEXT NOT NULL,
    user_hash TEXT NOT NULL,
    subscribed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    notify_on_update BOOLEAN DEFAULT TRUE,
    notify_on_comment BOOLEAN DEFAULT TRUE,
    last_notified_at TEXT,

    UNIQUE(library_framework_id, user_hash),
    FOREIGN KEY (library_framework_id) REFERENCES library_frameworks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_library_subscriptions_framework
    ON library_subscriptions(library_framework_id);

CREATE INDEX IF NOT EXISTS idx_library_subscriptions_user
    ON library_subscriptions(user_hash);

-- Framework views tracking (for analytics)
CREATE TABLE IF NOT EXISTS library_views (
    id TEXT PRIMARY KEY,
    library_framework_id TEXT NOT NULL,
    user_hash TEXT,                       -- NULL for anonymous views
    viewed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,                      -- Track unique sessions
    referrer TEXT,

    FOREIGN KEY (library_framework_id) REFERENCES library_frameworks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_library_views_framework
    ON library_views(library_framework_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_library_views_user
    ON library_views(user_hash);

-- Library collections (curated lists of frameworks)
CREATE TABLE IF NOT EXISTS library_collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by_user_hash TEXT NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS library_collection_items (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    library_framework_id TEXT NOT NULL,
    added_at TEXT DEFAULT CURRENT_TIMESTAMP,
    sort_order INTEGER DEFAULT 0,

    UNIQUE(collection_id, library_framework_id),
    FOREIGN KEY (collection_id) REFERENCES library_collections(id) ON DELETE CASCADE,
    FOREIGN KEY (library_framework_id) REFERENCES library_frameworks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_collection_items_collection
    ON library_collection_items(collection_id, sort_order);

-- Framework tags for categorization
CREATE TABLE IF NOT EXISTS library_tags (
    id TEXT PRIMARY KEY,
    tag_name TEXT NOT NULL UNIQUE,
    tag_category TEXT,                    -- 'domain', 'methodology', 'region', etc.
    usage_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS library_framework_tags (
    id TEXT PRIMARY KEY,
    library_framework_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,

    UNIQUE(library_framework_id, tag_id),
    FOREIGN KEY (library_framework_id) REFERENCES library_frameworks(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES library_tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_framework_tags_framework
    ON library_framework_tags(library_framework_id);

CREATE INDEX IF NOT EXISTS idx_framework_tags_tag
    ON library_framework_tags(tag_id);

-- ============================================================================
-- Triggers for automated metric updates
-- ============================================================================

-- Update vote_score when vote added/updated
CREATE TRIGGER IF NOT EXISTS update_vote_score_on_vote
AFTER INSERT ON library_votes
BEGIN
    UPDATE library_frameworks
    SET vote_score = (
        SELECT SUM(CASE WHEN vote_type = 'up' THEN 1 ELSE -1 END)
        FROM library_votes
        WHERE library_framework_id = NEW.library_framework_id
    )
    WHERE id = NEW.library_framework_id;
END;

-- Update rating average when rating added/updated
CREATE TRIGGER IF NOT EXISTS update_rating_avg_on_rating
AFTER INSERT ON library_ratings
BEGIN
    UPDATE library_frameworks
    SET
        rating_avg = (
            SELECT AVG(rating)
            FROM library_ratings
            WHERE library_framework_id = NEW.library_framework_id
        ),
        rating_count = (
            SELECT COUNT(*)
            FROM library_ratings
            WHERE library_framework_id = NEW.library_framework_id
        )
    WHERE id = NEW.library_framework_id;
END;

-- Update fork count when fork created
CREATE TRIGGER IF NOT EXISTS update_fork_count_on_fork
AFTER INSERT ON library_forks
BEGIN
    UPDATE library_frameworks
    SET fork_count = fork_count + 1
    WHERE id = NEW.parent_library_framework_id;
END;

-- ============================================================================
-- Sample Data (for testing)
-- ============================================================================

-- Example tags
-- INSERT INTO library_tags (id, tag_name, tag_category) VALUES
--     ('tag-001', 'adversary-analysis', 'domain'),
--     ('tag-002', 'friendly-cog', 'domain'),
--     ('tag-003', 'logistics', 'functional-area'),
--     ('tag-004', 'c2-infrastructure', 'functional-area'),
--     ('tag-005', 'information-operations', 'functional-area');

-- ============================================================================
-- Cleanup (for rollback)
-- ============================================================================

-- DROP TRIGGER IF EXISTS update_fork_count_on_fork;
-- DROP TRIGGER IF EXISTS update_rating_avg_on_rating;
-- DROP TRIGGER IF EXISTS update_vote_score_on_vote;
-- DROP TABLE IF EXISTS library_framework_tags;
-- DROP TABLE IF EXISTS library_tags;
-- DROP TABLE IF EXISTS library_collection_items;
-- DROP TABLE IF EXISTS library_collections;
-- DROP TABLE IF EXISTS library_views;
-- DROP TABLE IF EXISTS library_subscriptions;
-- DROP TABLE IF EXISTS library_forks;
-- DROP TABLE IF EXISTS library_ratings;
-- DROP TABLE IF EXISTS library_votes;
-- DROP TABLE IF EXISTS library_frameworks;

-- ============================================================================
-- Migration Notes
-- ============================================================================
-- 1. Builds on migration 021 workspace isolation
-- 2. framework_sessions already has: published_to_library, library_published_at, fork_parent_id
-- 3. Voting: Simple up/down votes, score = upvotes - downvotes
-- 4. Ratings: 1-5 stars with optional review text
-- 5. Forks: Track lineage from library framework to user's workspace
-- 6. Subscriptions: Notify users of updates to frameworks they follow
-- 7. Views: Track popularity for trending algorithms
-- 8. Collections: Curated lists like "Best COG Templates 2025"
-- 9. Tags: Hierarchical tagging for discovery
-- 10. Triggers: Auto-update aggregated metrics for performance
-- ============================================================================
