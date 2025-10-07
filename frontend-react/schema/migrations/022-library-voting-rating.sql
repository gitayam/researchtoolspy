-- ============================================================================
-- Migration 022: Library Voting & Rating System
-- Description: Enable community voting and ratings on public frameworks
-- Date: 2025-10-07
-- ============================================================================

-- ============================================================
-- FRAMEWORK VOTES
-- Community voting system (upvote/downvote)
-- ============================================================

CREATE TABLE IF NOT EXISTS framework_votes (
  id TEXT PRIMARY KEY,

  -- Voting
  framework_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,              -- Can be numeric user_id or hash for guests
  user_hash TEXT,                     -- Hash for guest users
  vote_type TEXT CHECK(vote_type IN ('UPVOTE', 'DOWNVOTE')) NOT NULL,

  -- Metadata
  workspace_id INTEGER NOT NULL DEFAULT 1,
  voted_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  UNIQUE(framework_id, user_id)  -- One vote per user per framework
);

CREATE INDEX IF NOT EXISTS idx_framework_votes_framework ON framework_votes(framework_id);
CREATE INDEX IF NOT EXISTS idx_framework_votes_user ON framework_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_framework_votes_type ON framework_votes(vote_type);

-- Composite index for fast vote counting by type
CREATE INDEX IF NOT EXISTS idx_framework_votes_framework_type
  ON framework_votes(framework_id, vote_type);

-- ============================================================
-- FRAMEWORK RATINGS
-- 5-star rating system with optional reviews
-- ============================================================

CREATE TABLE IF NOT EXISTS framework_ratings (
  id TEXT PRIMARY KEY,

  -- Rating
  framework_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  user_hash TEXT,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5) NOT NULL,

  -- Review (optional)
  review_text TEXT,                   -- Optional detailed review
  review_title TEXT,                  -- Optional review headline

  -- Metadata
  workspace_id INTEGER NOT NULL DEFAULT 1,
  rated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  UNIQUE(framework_id, user_id)  -- One rating per user per framework
);

CREATE INDEX IF NOT EXISTS idx_framework_ratings_framework ON framework_ratings(framework_id);
CREATE INDEX IF NOT EXISTS idx_framework_ratings_user ON framework_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_framework_ratings_rating ON framework_ratings(rating);

-- Composite index for average rating calculations
CREATE INDEX IF NOT EXISTS idx_framework_ratings_framework_rating
  ON framework_ratings(framework_id, rating);

-- ============================================================
-- ENTITY VOTES (for future entity library)
-- Voting system for actors, sources, behaviors, etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS entity_votes (
  id TEXT PRIMARY KEY,

  -- Entity reference
  entity_type TEXT CHECK(entity_type IN ('ACTOR', 'SOURCE', 'EVENT', 'PLACE', 'BEHAVIOR', 'EVIDENCE')) NOT NULL,
  entity_id TEXT NOT NULL,

  -- Voting
  user_id TEXT NOT NULL,
  user_hash TEXT,
  vote_type TEXT CHECK(vote_type IN ('UPVOTE', 'DOWNVOTE')) NOT NULL,

  -- Metadata
  workspace_id INTEGER NOT NULL DEFAULT 1,
  voted_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(entity_type, entity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_votes_entity ON entity_votes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_votes_user ON entity_votes(user_id);

-- ============================================================
-- ENTITY RATINGS (for future entity library)
-- ============================================================

CREATE TABLE IF NOT EXISTS entity_ratings (
  id TEXT PRIMARY KEY,

  -- Entity reference
  entity_type TEXT CHECK(entity_type IN ('ACTOR', 'SOURCE', 'EVENT', 'PLACE', 'BEHAVIOR', 'EVIDENCE')) NOT NULL,
  entity_id TEXT NOT NULL,

  -- Rating
  user_id TEXT NOT NULL,
  user_hash TEXT,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5) NOT NULL,
  review_text TEXT,
  review_title TEXT,

  -- Metadata
  workspace_id INTEGER NOT NULL DEFAULT 1,
  rated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(entity_type, entity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_ratings_entity ON entity_ratings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_ratings_user ON entity_ratings(user_id);

-- ============================================================
-- ENHANCE LIBRARY_ITEMS TABLE
-- Add indexes for efficient library discovery
-- ============================================================

-- Library discovery by popularity
CREATE INDEX IF NOT EXISTS idx_library_items_status_votes
  ON library_items(status, votes DESC)
  WHERE status = 'APPROVED';

CREATE INDEX IF NOT EXISTS idx_library_items_status_stars
  ON library_items(status, stars DESC)
  WHERE status = 'APPROVED';

-- Library discovery by category/tags (for filtering)
CREATE INDEX IF NOT EXISTS idx_library_items_tags ON library_items(tags);
CREATE INDEX IF NOT EXISTS idx_library_items_categories ON library_items(categories);

-- Library discovery by recency
CREATE INDEX IF NOT EXISTS idx_library_items_published
  ON library_items(status, published_at DESC)
  WHERE status = 'APPROVED';

-- ============================================================
-- HELPER VIEWS FOR AGGREGATED STATS
-- ============================================================

-- View: Framework vote counts
CREATE VIEW IF NOT EXISTS framework_vote_counts AS
SELECT
  framework_id,
  SUM(CASE WHEN vote_type = 'UPVOTE' THEN 1 ELSE 0 END) as upvotes,
  SUM(CASE WHEN vote_type = 'DOWNVOTE' THEN 1 ELSE 0 END) as downvotes,
  SUM(CASE WHEN vote_type = 'UPVOTE' THEN 1 ELSE -1 END) as total_score
FROM framework_votes
GROUP BY framework_id;

-- View: Framework rating stats
CREATE VIEW IF NOT EXISTS framework_rating_stats AS
SELECT
  framework_id,
  ROUND(AVG(rating), 2) as average_rating,
  COUNT(*) as total_ratings,
  SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_stars,
  SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_stars,
  SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_stars,
  SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_stars,
  SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
FROM framework_ratings
GROUP BY framework_id;

-- ============================================================
-- NOTES
-- ============================================================
-- 1. Votes are stored per user per framework (UNIQUE constraint)
-- 2. Users can change their vote (UPVOTE → DOWNVOTE via UPSERT)
-- 3. Ratings support optional written reviews
-- 4. Guest users can vote/rate via user_hash
-- 5. Views provide fast aggregated statistics
-- 6. Entity voting/rating prepared for Phase 5 (entity library)
-- ============================================================
