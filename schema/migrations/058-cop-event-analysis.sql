-- Migration: COP Event Analysis support
-- Date: 2026-03-05
-- Description: Adds event fields to cop_sessions, creates RFI and share tables

-- Event fields on cop_sessions
ALTER TABLE cop_sessions ADD COLUMN event_type TEXT;
ALTER TABLE cop_sessions ADD COLUMN event_description TEXT;
ALTER TABLE cop_sessions ADD COLUMN event_facts TEXT DEFAULT '[]';
ALTER TABLE cop_sessions ADD COLUMN content_analyses TEXT DEFAULT '[]';

-- RFI (Request for Information) table
CREATE TABLE IF NOT EXISTS cop_rfis (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL,
    question TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    created_by INTEGER NOT NULL DEFAULT 1,
    assigned_to INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_cop_rfis_session ON cop_rfis(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_rfis_status ON cop_rfis(status);

-- RFI answers
CREATE TABLE IF NOT EXISTS cop_rfi_answers (
    id TEXT PRIMARY KEY,
    rfi_id TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    source_url TEXT,
    source_description TEXT,
    is_accepted INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL DEFAULT 1,
    responder_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (rfi_id) REFERENCES cop_rfis(id)
);
CREATE INDEX IF NOT EXISTS idx_cop_rfi_answers_rfi ON cop_rfi_answers(rfi_id);

-- COP share links
CREATE TABLE IF NOT EXISTS cop_shares (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL,
    share_token TEXT NOT NULL UNIQUE,
    visible_panels TEXT NOT NULL DEFAULT '["map","event"]',
    allow_rfi_answers INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    view_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_cop_shares_token ON cop_shares(share_token);
