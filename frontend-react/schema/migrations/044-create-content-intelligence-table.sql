-- Migration: 044
-- Create content_intelligence table (fixed table name)
-- Created: 2025-10-13
-- Reason: API endpoints expect 'content_intelligence' but original migration created 'content_analysis'

-- Create content_intelligence table with proper schema
CREATE TABLE IF NOT EXISTS content_intelligence (
    id TEXT PRIMARY KEY, -- UUID as TEXT
    user_id INTEGER,
    user_hash TEXT, -- For guest mode
    workspace_id INTEGER, -- For multi-tenant isolation

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
    main_content TEXT, -- Full cleaned text
    summary TEXT, -- AI-generated summary
    word_count INTEGER,

    -- Word Analysis (stored as JSON strings for D1 compatibility)
    word_frequency TEXT, -- JSON string: {"word": count}
    top_10_words TEXT, -- JSON string: [{"word": "...", "count": 10}]
    top_10_phrases TEXT, -- JSON string: [{"phrase": "...", "count": 5}]

    -- Entity Extraction (stored as JSON strings)
    key_entities TEXT, -- JSON string: [{"text": "...", "type": "PERSON|ORG|LOC|..."}]

    -- Sentiment Analysis (migration 030)
    sentiment_overall REAL, -- -1.0 to +1.0
    sentiment_score REAL, -- 0.0 to 1.0 (magnitude)
    sentiment_confidence REAL, -- 0.0 to 1.0
    sentiment_emotions TEXT, -- JSON: {"joy": 0.7, "anger": 0.1, ...}
    controversial_claims TEXT, -- JSON: [{sentence, sentiment}]
    sentiment_insights TEXT, -- JSON: [key insights]

    -- Keyphrases (migration 031)
    keyphrases TEXT, -- JSON: [{phrase, score, category, relevance}]

    -- Topic Modeling (migration 032)
    topics TEXT, -- JSON: [{name, coherence, coverage, keywords}]

    -- Claims Analysis (migration 033)
    claims TEXT, -- JSON: [{claim_text, type, confidence, evidence}]

    -- Archive/Bypass Links
    archive_urls TEXT, -- JSON: {"wayback": "...", "archive_is": "..."}
    bypass_urls TEXT, -- JSON: {"12ft": "...", "outline": "..."}

    -- Social Media Specific
    social_metadata TEXT, -- JSON: platform-specific data
    image_urls TEXT, -- JSON: [urls]
    video_urls TEXT, -- JSON: [urls]

    -- Processing metadata
    processing_mode TEXT, -- quick, full, forensic
    processing_duration_ms INTEGER,
    gpt_model_used TEXT, -- e.g., gpt-4o-mini
    analysis_version INTEGER DEFAULT 1,

    -- Sharing (migration 038)
    is_public BOOLEAN DEFAULT 0,
    public_token TEXT UNIQUE, -- URL-safe token for public access
    public_share_count INTEGER DEFAULT 0,

    -- Expiration (migration 034)
    expires_at TEXT, -- ISO 8601 datetime, NULL = never expires

    -- Progressive Loading (migration 043)
    loading_status TEXT DEFAULT 'pending', -- pending, processing, complete, error
    loading_progress INTEGER DEFAULT 0, -- 0-100%
    loading_error TEXT,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_accessed_at TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_intelligence_user ON content_intelligence(user_id);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_hash ON content_intelligence(user_hash);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_workspace ON content_intelligence(workspace_id);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_url ON content_intelligence(url);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_content_hash ON content_intelligence(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_domain ON content_intelligence(domain);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_social ON content_intelligence(is_social_media);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_public ON content_intelligence(is_public);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_public_token ON content_intelligence(public_token);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_expires ON content_intelligence(expires_at);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_status ON content_intelligence(loading_status);
CREATE INDEX IF NOT EXISTS idx_content_intelligence_created ON content_intelligence(created_at DESC);

-- Create update trigger
CREATE TRIGGER IF NOT EXISTS update_content_intelligence_timestamp
AFTER UPDATE ON content_intelligence
BEGIN
    UPDATE content_intelligence SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Create access tracking trigger
CREATE TRIGGER IF NOT EXISTS track_content_intelligence_access
AFTER UPDATE OF last_accessed_at ON content_intelligence
BEGIN
    UPDATE content_intelligence SET last_accessed_at = datetime('now') WHERE id = NEW.id;
END;
