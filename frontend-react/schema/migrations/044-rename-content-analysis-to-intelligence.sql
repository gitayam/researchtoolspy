-- Migration: 044
-- Rename content_analysis table to content_intelligence
-- Created: 2025-10-13
-- Reason: API endpoints expect 'content_intelligence' but table is named 'content_analysis'

-- SQLite doesn't support ALTER TABLE RENAME, so we need to:
-- 1. Create new table with correct name
-- 2. Copy data
-- 3. Drop old table
-- 4. Recreate indexes and triggers

-- Create content_intelligence table with same schema as content_analysis
CREATE TABLE IF NOT EXISTS content_intelligence (
    id TEXT PRIMARY KEY, -- Changed to TEXT for UUID compatibility
    user_id INTEGER,
    user_hash TEXT, -- For guest mode
    saved_link_id INTEGER,

    -- Source
    url TEXT NOT NULL UNIQUE,
    url_normalized TEXT,
    content_hash TEXT, -- SHA-256 of content

    -- Metadata
    title TEXT,
    description TEXT,
    author TEXT,
    publish_date TEXT,
    domain TEXT,
    is_social_media BOOLEAN DEFAULT FALSE,
    social_platform TEXT,

    -- Content
    main_content TEXT, -- Full cleaned text (renamed from extracted_text)
    summary TEXT, -- AI-generated summary
    word_count INTEGER,

    -- Word Analysis (stored as JSON strings for D1 compatibility)
    word_frequency TEXT, -- JSON string: {"word": count}
    top_10_words TEXT, -- JSON string: [{"word": "...", "count": 10}]
    top_10_phrases TEXT, -- JSON string: [{"phrase": "...", "count": 5}]

    -- Entity Extraction (stored as JSON strings)
    key_entities TEXT, -- JSON string: [{"text": "...", "type": "PERSON|ORG|LOC|..."}]

    -- Sentiment Analysis (added in migration 030)
    sentiment_overall REAL, -- -1.0 to +1.0
    sentiment_score REAL, -- 0.0 to 1.0 (magnitude)
    sentiment_confidence REAL, -- 0.0 to 1.0
    sentiment_emotions TEXT, -- JSON: {"joy": 0.7, "anger": 0.1, ...}
    controversial_claims TEXT, -- JSON: [{sentence, sentiment}]
    sentiment_insights TEXT, -- JSON: [key insights]

    -- Keyphrases (added in migration 031)
    keyphrases TEXT, -- JSON: [{phrase, score, category, relevance}]

    -- Topic Modeling (added in migration 032)
    topics TEXT, -- JSON: [{name, coherence, coverage, keywords}]

    -- Claims Analysis (added in migration 033)
    claims TEXT, -- JSON: [{claim_text, type, confidence, evidence}]

    -- Archive/Bypass Links
    archive_urls TEXT, -- JSON: {"wayback": "...", "archive_is": "..."}
    bypass_urls TEXT, -- JSON: {"12ft": "...", "outline": "..."}

    -- Social Media Specific
    social_metadata TEXT, -- JSON: platform-specific data

    -- Processing metadata
    processing_mode TEXT, -- quick, full, forensic
    processing_duration_ms INTEGER,
    gpt_model_used TEXT, -- e.g., gpt-4o-mini
    analysis_version INTEGER DEFAULT 1,

    -- Sharing (added in migration 038)
    is_public BOOLEAN DEFAULT 0,
    public_token TEXT UNIQUE, -- URL-safe token for public access
    public_share_count INTEGER DEFAULT 0,

    -- Expiration (added in migration 034)
    expires_at TEXT, -- ISO 8601 datetime, NULL = never expires

    -- Progressive Loading (added in migration 043)
    loading_status TEXT DEFAULT 'pending', -- pending, processing, complete, error
    loading_progress INTEGER DEFAULT 0, -- 0-100%
    loading_error TEXT,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_accessed_at TEXT
);

-- Copy data from content_analysis if it exists
INSERT INTO content_intelligence (
    id, user_id, url, url_normalized, content_hash,
    title, author, publish_date, domain, is_social_media, social_platform,
    main_content, summary, word_count,
    word_frequency, key_entities,
    archive_urls, bypass_urls,
    processing_mode, processing_duration_ms, gpt_model_used,
    created_at, updated_at
)
SELECT
    CAST(id AS TEXT), -- Convert INTEGER id to TEXT UUID format
    user_id, url, url_normalized, content_hash,
    title, author, publish_date, domain, is_social_media, social_platform,
    extracted_text, summary, word_count,
    word_frequency, entities,
    archive_urls, bypass_urls,
    processing_mode, processing_duration_ms, gpt_model_used,
    created_at, updated_at
FROM content_analysis
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='content_analysis');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_content_intelligence_user ON content_intelligence(user_id);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_hash ON content_intelligence(user_hash);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_url ON content_intelligence(url);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_content_hash ON content_intelligence(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_domain ON content_intelligence(domain);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_social ON content_intelligence(is_social_media);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_public ON content_intelligence(is_public);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_public_token ON content_intelligence(public_token);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_expires ON content_intelligence(expires_at);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_status ON content_intelligence(loading_status);

-- Create update trigger
CREATE TRIGGER IF NOT EXISTS update_content_intelligence_timestamp
AFTER UPDATE ON content_intelligence
BEGIN
    UPDATE content_intelligence SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Drop old table (be careful - this is destructive)
-- Only drop if the new table has data
-- DROP TABLE IF EXISTS content_analysis;

-- Note: Manually verify data migration before dropping old table
-- Run: SELECT COUNT(*) FROM content_intelligence;
-- Compare with: SELECT COUNT(*) FROM content_analysis;
