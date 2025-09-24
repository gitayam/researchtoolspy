-- Cloudflare D1 Database Schema for ResearchToolsPy
-- Compatible with SQLite at the edge
-- Version: 1.0.0
-- Date: 2024-01-24

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

-- Users table: Core user management
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    hashed_password TEXT NOT NULL,
    account_hash TEXT UNIQUE, -- For anonymous hash-based auth
    is_active INTEGER DEFAULT 1 NOT NULL,
    is_verified INTEGER DEFAULT 0 NOT NULL,
    role TEXT DEFAULT 'researcher' NOT NULL CHECK(role IN ('admin', 'analyst', 'researcher', 'viewer')),
    organization TEXT,
    department TEXT,
    bio TEXT,
    preferences TEXT DEFAULT '{}', -- JSON preferences
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL
);

-- Indexes for users table
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_account_hash ON users(account_hash);
CREATE INDEX idx_users_role ON users(role);

-- API Keys table: For programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    scopes TEXT DEFAULT '[]' NOT NULL, -- JSON array of scopes
    last_used_at TEXT,
    usage_count INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for api_keys table
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);

-- Authentication logs table: Security audit trail
CREATE TABLE IF NOT EXISTS auth_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    account_hash TEXT,
    success INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    session_token TEXT,
    error_message TEXT,
    login_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for auth_logs table
CREATE INDEX idx_auth_logs_user_id ON auth_logs(user_id);
CREATE INDEX idx_auth_logs_account_hash ON auth_logs(account_hash);
CREATE INDEX idx_auth_logs_login_at ON auth_logs(login_at);

-- ============================================
-- FRAMEWORK SESSIONS
-- ============================================

-- Framework sessions table: Store analysis framework data
CREATE TABLE IF NOT EXISTS framework_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    framework_type TEXT NOT NULL CHECK(framework_type IN (
        'swot', 'cog', 'pmesii_pt', 'dotmlpf', 'ach',
        'deception_detection', 'behavioral_analysis', 'starbursting',
        'causeway', 'dime', 'pest', 'vrio', 'stakeholder',
        'trend', 'surveillance', 'fundamental_flow'
    )),
    status TEXT DEFAULT 'draft' NOT NULL CHECK(status IN ('draft', 'in_progress', 'completed', 'archived')),
    user_id INTEGER NOT NULL,
    data TEXT DEFAULT '{}' NOT NULL, -- JSON framework data
    config TEXT, -- JSON configuration
    tags TEXT, -- JSON array of tags
    version INTEGER DEFAULT 1 NOT NULL,
    ai_suggestions TEXT, -- JSON AI-generated suggestions
    ai_analysis_count INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for framework_sessions table
CREATE INDEX idx_framework_sessions_user_id ON framework_sessions(user_id);
CREATE INDEX idx_framework_sessions_framework_type ON framework_sessions(framework_type);
CREATE INDEX idx_framework_sessions_status ON framework_sessions(status);
CREATE INDEX idx_framework_sessions_created_at ON framework_sessions(created_at);

-- Framework templates table: Reusable framework templates
CREATE TABLE IF NOT EXISTS framework_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    framework_type TEXT NOT NULL CHECK(framework_type IN (
        'swot', 'cog', 'pmesii_pt', 'dotmlpf', 'ach',
        'deception_detection', 'behavioral_analysis', 'starbursting',
        'causeway', 'dime', 'pest', 'vrio', 'stakeholder',
        'trend', 'surveillance', 'fundamental_flow'
    )),
    template_data TEXT NOT NULL, -- JSON template data
    is_public INTEGER DEFAULT 0 NOT NULL,
    is_system INTEGER DEFAULT 0 NOT NULL,
    created_by_id INTEGER NOT NULL,
    usage_count INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for framework_templates table
CREATE INDEX idx_framework_templates_framework_type ON framework_templates(framework_type);
CREATE INDEX idx_framework_templates_created_by_id ON framework_templates(created_by_id);
CREATE INDEX idx_framework_templates_is_public ON framework_templates(is_public);

-- Framework exports table: Track exported documents
CREATE TABLE IF NOT EXISTS framework_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    export_type TEXT NOT NULL, -- pdf, docx, xlsx, pptx, json
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    exported_by_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (session_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (exported_by_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for framework_exports table
CREATE INDEX idx_framework_exports_session_id ON framework_exports(session_id);
CREATE INDEX idx_framework_exports_exported_by_id ON framework_exports(exported_by_id);

-- ============================================
-- RESEARCH TOOLS & PROCESSING
-- ============================================

-- Processed URLs table: Store analyzed web content
CREATE TABLE IF NOT EXISTS processed_urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    url_hash TEXT NOT NULL UNIQUE,
    title TEXT,
    description TEXT,
    author TEXT,
    domain TEXT NOT NULL,
    content_type TEXT,
    language TEXT,
    word_count INTEGER,
    status_code INTEGER,
    response_time REAL,
    archived_url TEXT,
    wayback_url TEXT,
    additional_metadata TEXT, -- JSON metadata
    reliability_score REAL,
    domain_reputation TEXT CHECK(domain_reputation IN ('trusted', 'neutral', 'suspicious', 'malicious')),
    processing_status TEXT DEFAULT 'completed' NOT NULL,
    error_message TEXT,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for processed_urls table
CREATE INDEX idx_processed_urls_url_hash ON processed_urls(url_hash);
CREATE INDEX idx_processed_urls_domain ON processed_urls(domain);
CREATE INDEX idx_processed_urls_user_id ON processed_urls(user_id);
CREATE INDEX idx_processed_urls_domain_created ON processed_urls(domain, created_at);

-- Citations table: Academic and source citations
CREATE TABLE IF NOT EXISTS citations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    authors TEXT, -- JSON array of authors
    publication_date TEXT,
    source_type TEXT NOT NULL, -- article, book, website, report, etc.
    source_name TEXT,
    url TEXT,
    doi TEXT,
    isbn TEXT,
    pmid TEXT,
    apa_citation TEXT,
    mla_citation TEXT,
    chicago_citation TEXT,
    bibtex_citation TEXT,
    citation_data TEXT, -- JSON citation metadata
    tags TEXT, -- JSON array of tags
    notes TEXT,
    reliability_rating INTEGER CHECK(reliability_rating >= 1 AND reliability_rating <= 5),
    relevance_rating INTEGER CHECK(relevance_rating >= 1 AND relevance_rating <= 5),
    user_id INTEGER NOT NULL,
    processed_url_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_url_id) REFERENCES processed_urls(id) ON DELETE SET NULL
);

-- Indexes for citations table
CREATE INDEX idx_citations_user_id ON citations(user_id);
CREATE INDEX idx_citations_doi ON citations(doi);
CREATE INDEX idx_citations_source_type ON citations(source_type);
CREATE INDEX idx_citations_source_type_date ON citations(source_type, publication_date);

-- Research jobs table: Async job processing
CREATE TABLE IF NOT EXISTS research_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL CHECK(job_type IN (
        'url_processing', 'web_scraping', 'document_processing',
        'social_media_analysis', 'osint_collection', 'data_conversion'
    )),
    job_name TEXT,
    status TEXT DEFAULT 'pending' NOT NULL CHECK(status IN (
        'pending', 'in_progress', 'completed', 'failed', 'cancelled'
    )),
    input_data TEXT, -- JSON input parameters
    result_data TEXT, -- JSON results
    error_message TEXT,
    retry_count INTEGER DEFAULT 0 NOT NULL,
    max_retries INTEGER DEFAULT 3 NOT NULL,
    progress_percentage INTEGER DEFAULT 0 NOT NULL,
    current_step TEXT,
    started_at TEXT,
    completed_at TEXT,
    estimated_completion TEXT,
    user_id INTEGER NOT NULL,
    related_urls TEXT, -- JSON array of URL IDs
    related_citations TEXT, -- JSON array of citation IDs
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for research_jobs table
CREATE INDEX idx_research_jobs_user_id ON research_jobs(user_id);
CREATE INDEX idx_research_jobs_status ON research_jobs(status);
CREATE INDEX idx_research_jobs_job_type ON research_jobs(job_type);
CREATE INDEX idx_research_jobs_status_type ON research_jobs(status, job_type);
CREATE INDEX idx_research_jobs_user_status ON research_jobs(user_id, status);

-- ============================================
-- COLLABORATION & SHARING
-- ============================================

-- Shared sessions table: Framework session sharing
CREATE TABLE IF NOT EXISTS shared_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    shared_by_id INTEGER NOT NULL,
    shared_with_id INTEGER,
    share_token TEXT UNIQUE,
    permission TEXT DEFAULT 'view' NOT NULL CHECK(permission IN ('view', 'comment', 'edit')),
    expires_at TEXT,
    accessed_count INTEGER DEFAULT 0 NOT NULL,
    last_accessed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (session_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for shared_sessions table
CREATE INDEX idx_shared_sessions_session_id ON shared_sessions(session_id);
CREATE INDEX idx_shared_sessions_share_token ON shared_sessions(share_token);
CREATE INDEX idx_shared_sessions_shared_with_id ON shared_sessions(shared_with_id);

-- Session comments table: Collaborative annotations
CREATE TABLE IF NOT EXISTS session_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    parent_comment_id INTEGER,
    comment_text TEXT NOT NULL,
    attachment_data TEXT, -- JSON attachment metadata
    is_resolved INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (session_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES session_comments(id) ON DELETE CASCADE
);

-- Indexes for session_comments table
CREATE INDEX idx_session_comments_session_id ON session_comments(session_id);
CREATE INDEX idx_session_comments_user_id ON session_comments(user_id);
CREATE INDEX idx_session_comments_parent_comment_id ON session_comments(parent_comment_id);

-- ============================================
-- ANALYTICS & METRICS
-- ============================================

-- Usage metrics table: Track platform usage
CREATE TABLE IF NOT EXISTS usage_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    metric_type TEXT NOT NULL,
    metric_value TEXT NOT NULL, -- JSON value
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for usage_metrics table
CREATE INDEX idx_usage_metrics_user_id ON usage_metrics(user_id);
CREATE INDEX idx_usage_metrics_metric_type ON usage_metrics(metric_type);
CREATE INDEX idx_usage_metrics_created_at ON usage_metrics(created_at);

-- Feature usage table: Track feature adoption
CREATE TABLE IF NOT EXISTS feature_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    feature_name TEXT NOT NULL,
    feature_category TEXT NOT NULL,
    usage_count INTEGER DEFAULT 1 NOT NULL,
    last_used_at TEXT DEFAULT (datetime('now')) NOT NULL,
    first_used_at TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, feature_name)
);

-- Indexes for feature_usage table
CREATE INDEX idx_feature_usage_user_id ON feature_usage(user_id);
CREATE INDEX idx_feature_usage_feature_name ON feature_usage(feature_name);

-- ============================================
-- SYSTEM & CONFIGURATION
-- ============================================

-- System settings table: Global configuration
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    is_public INTEGER DEFAULT 0 NOT NULL,
    updated_by_id INTEGER,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Migration history table: Track schema migrations
CREATE TABLE IF NOT EXISTS migration_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL UNIQUE,
    description TEXT,
    applied_at TEXT DEFAULT (datetime('now')) NOT NULL,
    execution_time_ms INTEGER
);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_users_timestamp
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER update_api_keys_timestamp
AFTER UPDATE ON api_keys
BEGIN
    UPDATE api_keys SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER update_framework_sessions_timestamp
AFTER UPDATE ON framework_sessions
BEGIN
    UPDATE framework_sessions SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER update_framework_templates_timestamp
AFTER UPDATE ON framework_templates
BEGIN
    UPDATE framework_templates SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER update_processed_urls_timestamp
AFTER UPDATE ON processed_urls
BEGIN
    UPDATE processed_urls SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER update_citations_timestamp
AFTER UPDATE ON citations
BEGIN
    UPDATE citations SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER update_research_jobs_timestamp
AFTER UPDATE ON research_jobs
BEGIN
    UPDATE research_jobs SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER update_session_comments_timestamp
AFTER UPDATE ON session_comments
BEGIN
    UPDATE session_comments SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default system settings
INSERT OR IGNORE INTO system_settings (key, value, description, is_public) VALUES
    ('platform_version', '2.0.0', 'Current platform version', 1),
    ('maintenance_mode', 'false', 'Platform maintenance mode', 1),
    ('ai_enabled', 'true', 'AI features enabled', 1),
    ('max_file_size_mb', '100', 'Maximum file upload size in MB', 1),
    ('session_timeout_hours', '24', 'Session timeout in hours', 1),
    ('rate_limit_requests', '100', 'API rate limit requests per minute', 1);

-- Record initial migration
INSERT INTO migration_history (version, description) VALUES
    ('1.0.0', 'Initial D1 database schema for ResearchToolsPy');