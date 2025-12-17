-- Migration 006: Social Media Intelligence System
-- Comprehensive social media scraping and analysis
-- Date: October 3, 2025

-- ============================================================
-- SOCIAL MEDIA PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS social_media_profiles (
  id TEXT PRIMARY KEY,

  -- Platform
  platform TEXT CHECK(platform IN ('INSTAGRAM', 'YOUTUBE', 'TWITTER', 'TIKTOK', 'FACEBOOK', 'LINKEDIN')) NOT NULL,

  -- Profile Info
  username TEXT NOT NULL,
  display_name TEXT,
  profile_url TEXT NOT NULL,
  bio TEXT,
  profile_pic_url TEXT,

  -- Metrics
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  verified INTEGER DEFAULT 0,

  -- Platform-specific data (JSON)
  platform_data TEXT, -- JSON: platform-specific fields

  -- Categorization
  tags TEXT, -- JSON array
  category TEXT,

  -- Tracking
  workspace_id TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_scraped_at TEXT,

  -- Status
  is_active INTEGER DEFAULT 1,
  scrape_frequency TEXT DEFAULT 'MANUAL', -- MANUAL, HOURLY, DAILY, WEEKLY

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE(platform, username)
);

CREATE INDEX IF NOT EXISTS idx_sm_profiles_platform ON social_media_profiles(platform);
CREATE INDEX IF NOT EXISTS idx_sm_profiles_username ON social_media_profiles(username);
CREATE INDEX IF NOT EXISTS idx_sm_profiles_workspace ON social_media_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sm_profiles_created_by ON social_media_profiles(created_by);

-- ============================================================
-- SOCIAL MEDIA POSTS
-- ============================================================

CREATE TABLE IF NOT EXISTS social_media_posts (
  id TEXT PRIMARY KEY,

  -- Profile relationship
  profile_id TEXT NOT NULL,

  -- Post metadata
  platform TEXT CHECK(platform IN ('INSTAGRAM', 'YOUTUBE', 'TWITTER', 'TIKTOK', 'FACEBOOK', 'LINKEDIN')) NOT NULL,
  post_url TEXT NOT NULL,
  post_id TEXT NOT NULL, -- Platform-specific post ID
  post_type TEXT, -- photo, video, reel, story, tweet, etc.

  -- Content
  caption TEXT,
  content TEXT, -- Full text content
  media_urls TEXT, -- JSON array of media URLs
  thumbnail_url TEXT,

  -- Engagement metrics
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,

  -- Temporal
  posted_at TEXT,
  scraped_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Platform-specific data
  platform_data TEXT, -- JSON: hashtags, mentions, location, etc.

  -- Analysis
  sentiment_score REAL, -- -1 to 1
  topics TEXT, -- JSON array of detected topics
  entities TEXT, -- JSON array of named entities

  -- Media download
  media_downloaded INTEGER DEFAULT 0,
  media_local_path TEXT,

  -- Metadata
  workspace_id TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (profile_id) REFERENCES social_media_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE(platform, post_id)
);

CREATE INDEX IF NOT EXISTS idx_sm_posts_profile ON social_media_posts(profile_id);
CREATE INDEX IF NOT EXISTS idx_sm_posts_platform ON social_media_posts(platform);
CREATE INDEX IF NOT EXISTS idx_sm_posts_posted_at ON social_media_posts(posted_at);
CREATE INDEX IF NOT EXISTS idx_sm_posts_workspace ON social_media_posts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sm_posts_sentiment ON social_media_posts(sentiment_score);

-- ============================================================
-- SOCIAL MEDIA SCRAPING JOBS
-- ============================================================

CREATE TABLE IF NOT EXISTS social_media_jobs (
  id TEXT PRIMARY KEY,

  -- Job type
  job_type TEXT CHECK(job_type IN ('PROFILE_SCRAPE', 'POST_SCRAPE', 'MEDIA_DOWNLOAD', 'SEARCH', 'MONITOR')) NOT NULL,
  platform TEXT CHECK(platform IN ('INSTAGRAM', 'YOUTUBE', 'TWITTER', 'TIKTOK', 'FACEBOOK', 'LINKEDIN')) NOT NULL,

  -- Target
  target_url TEXT,
  target_username TEXT,
  search_query TEXT,

  -- Configuration (JSON)
  config TEXT, -- JSON: {max_posts: 50, download_media: true, etc.}

  -- Status
  status TEXT CHECK(status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')) DEFAULT 'PENDING',
  progress INTEGER DEFAULT 0, -- 0-100

  -- Results
  items_found INTEGER DEFAULT 0,
  items_processed INTEGER DEFAULT 0,
  error_message TEXT,

  -- Timing
  started_at TEXT,
  completed_at TEXT,

  -- Ownership
  workspace_id TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sm_jobs_status ON social_media_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sm_jobs_platform ON social_media_jobs(platform);
CREATE INDEX IF NOT EXISTS idx_sm_jobs_workspace ON social_media_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sm_jobs_created_at ON social_media_jobs(created_at);

-- ============================================================
-- SOCIAL MEDIA ANALYTICS
-- ============================================================

CREATE TABLE IF NOT EXISTS social_media_analytics (
  id TEXT PRIMARY KEY,

  -- Target
  profile_id TEXT,

  -- Time period
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,

  -- Aggregated metrics
  total_posts INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_comments INTEGER DEFAULT 0,
  total_shares INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,

  -- Calculated metrics
  avg_engagement_rate REAL DEFAULT 0.0,
  follower_growth INTEGER DEFAULT 0,
  top_post_id TEXT,

  -- Content analysis
  top_hashtags TEXT, -- JSON array
  top_topics TEXT, -- JSON array
  sentiment_distribution TEXT, -- JSON: {positive: 0.7, neutral: 0.2, negative: 0.1}

  -- Temporal patterns
  best_posting_times TEXT, -- JSON array of hour ranges
  posting_frequency TEXT, -- JSON: daily distribution

  -- Metadata
  workspace_id TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (profile_id) REFERENCES social_media_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sm_analytics_profile ON social_media_analytics(profile_id);
CREATE INDEX IF NOT EXISTS idx_sm_analytics_period ON social_media_analytics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_sm_analytics_workspace ON social_media_analytics(workspace_id);

-- ============================================================
-- SOCIAL MEDIA MONITORS
-- ============================================================

CREATE TABLE IF NOT EXISTS social_media_monitors (
  id TEXT PRIMARY KEY,

  -- Monitor configuration
  name TEXT NOT NULL,
  description TEXT,
  platform TEXT CHECK(platform IN ('INSTAGRAM', 'YOUTUBE', 'TWITTER', 'TIKTOK', 'FACEBOOK', 'LINKEDIN')) NOT NULL,

  -- Target
  monitor_type TEXT CHECK(monitor_type IN ('PROFILE', 'HASHTAG', 'KEYWORD', 'LOCATION')) NOT NULL,
  target TEXT NOT NULL, -- username, hashtag, keyword, or location

  -- Settings
  frequency TEXT DEFAULT 'DAILY', -- HOURLY, DAILY, WEEKLY
  max_items INTEGER DEFAULT 100,
  download_media INTEGER DEFAULT 0,

  -- Filters (JSON)
  filters TEXT, -- JSON: {min_likes: 10, verified_only: true, etc.}

  -- Notifications
  notify_on_new INTEGER DEFAULT 0,
  notification_settings TEXT, -- JSON

  -- Status
  is_active INTEGER DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT,

  -- Ownership
  workspace_id TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sm_monitors_platform ON social_media_monitors(platform);
CREATE INDEX IF NOT EXISTS idx_sm_monitors_active ON social_media_monitors(is_active);
CREATE INDEX IF NOT EXISTS idx_sm_monitors_workspace ON social_media_monitors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sm_monitors_next_run ON social_media_monitors(next_run_at);

-- ============================================================
-- LINK EVIDENCE TO SOCIAL MEDIA
-- ============================================================

-- Link evidence items to social media posts
CREATE TABLE IF NOT EXISTS evidence_social_media (
  evidence_id INTEGER NOT NULL,
  post_id TEXT NOT NULL,
  relevance TEXT,
  PRIMARY KEY (evidence_id, post_id),
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES social_media_posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_sm_evidence ON evidence_social_media(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_sm_post ON evidence_social_media(post_id);
