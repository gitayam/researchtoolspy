-- Content Intelligence & Link Library Schema
-- Migration: 014
-- Created: 2025-10-06

-- Saved Links Library
CREATE TABLE IF NOT EXISTS saved_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    note TEXT,
    tags TEXT, -- JSON array of tags
    reminder_date TEXT, -- ISO 8601 datetime

    -- Quick metadata (populated on save, full analysis optional)
    domain TEXT,
    is_social_media BOOLEAN DEFAULT FALSE,
    social_platform TEXT, -- twitter, facebook, instagram, linkedin, etc.

    -- Processing status
    is_processed BOOLEAN DEFAULT FALSE,
    analysis_id INTEGER, -- FK to content_analysis table

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    accessed_at TEXT, -- Last time link was opened/analyzed

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_saved_links_user ON saved_links(user_id);
CREATE INDEX idx_saved_links_domain ON saved_links(domain);
CREATE INDEX idx_saved_links_reminder ON saved_links(reminder_date);
CREATE INDEX idx_saved_links_social ON saved_links(is_social_media);

-- Full Content Analysis Results
CREATE TABLE IF NOT EXISTS content_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    saved_link_id INTEGER, -- Optional FK to saved_links

    -- Source
    url TEXT NOT NULL,
    url_normalized TEXT,
    content_hash TEXT, -- SHA-256 of content

    -- Metadata
    title TEXT,
    author TEXT,
    publish_date TEXT,
    domain TEXT,
    is_social_media BOOLEAN DEFAULT FALSE,
    social_platform TEXT,

    -- Content
    extracted_text TEXT, -- Full cleaned text
    summary TEXT, -- AI-generated summary (250 words)
    word_count INTEGER,

    -- Word Analysis (stored as JSON)
    word_frequency JSON, -- {"phrase": count, ...}
    top_phrases JSON, -- Top 10 2-10 word phrases

    -- Entity Extraction (stored as JSON)
    entities JSON, -- {"people": [...], "organizations": [...], "locations": [...]}

    -- Archive/Bypass Links
    archive_urls JSON, -- {"wayback": "...", "archive_is": "...", "screenshot": "..."}
    bypass_urls JSON, -- {"12ft": "...", "outline": "...", "googlecache": "..."}

    -- Processing metadata
    processing_mode TEXT, -- quick, full, forensic
    processing_duration_ms INTEGER,
    gpt_model_used TEXT, -- e.g., gpt-5-mini

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (saved_link_id) REFERENCES saved_links(id) ON DELETE SET NULL
);

CREATE INDEX idx_content_analysis_user ON content_analysis(user_id);
CREATE INDEX idx_content_analysis_url ON content_analysis(url);
CREATE INDEX idx_content_analysis_hash ON content_analysis(content_hash);
CREATE INDEX idx_content_analysis_link ON content_analysis(saved_link_id);

-- Q&A History (questions asked against content)
CREATE TABLE IF NOT EXISTS content_qa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_analysis_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,

    -- Question & Answer
    question TEXT NOT NULL,
    answer TEXT,
    confidence_score REAL, -- 0.0 to 1.0

    -- Source excerpts that supported the answer
    source_excerpts JSON, -- [{"text": "...", "paragraph": 3, "relevance": 0.95}, ...]

    -- Flags
    has_complete_answer BOOLEAN DEFAULT TRUE,
    missing_data_notes TEXT, -- What information was missing to fully answer

    -- Method used
    search_method TEXT, -- semantic, regex, hybrid

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (content_analysis_id) REFERENCES content_analysis(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_content_qa_analysis ON content_qa(content_analysis_id);
CREATE INDEX idx_content_qa_user ON content_qa(user_id);

-- Starbursting Sessions (link to existing framework sessions)
CREATE TABLE IF NOT EXISTS starbursting_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL, -- FK to framework_sessions
    content_analysis_id INTEGER NOT NULL, -- Source of content

    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (session_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (content_analysis_id) REFERENCES content_analysis(id) ON DELETE CASCADE
);

CREATE INDEX idx_starbursting_sources_session ON starbursting_sources(session_id);
CREATE INDEX idx_starbursting_sources_analysis ON starbursting_sources(content_analysis_id);

-- Update trigger for updated_at
CREATE TRIGGER update_saved_links_timestamp
AFTER UPDATE ON saved_links
BEGIN
    UPDATE saved_links SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_content_analysis_timestamp
AFTER UPDATE ON content_analysis
BEGIN
    UPDATE content_analysis SET updated_at = datetime('now') WHERE id = NEW.id;
END;
