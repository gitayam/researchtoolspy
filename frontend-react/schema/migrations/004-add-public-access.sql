-- Migration: Add Public Access Support
-- Phase: 4A (Preparation)
-- Date: 2025-10-01
-- Description: Add is_public flags and guest session tracking for public access feature

-- Add is_public flag to datasets table
ALTER TABLE datasets ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE datasets ADD COLUMN shared_by_user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_datasets_public ON datasets(is_public);

-- Add is_public flag to evidence_items table
ALTER TABLE evidence_items ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE evidence_items ADD COLUMN shared_by_user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_evidence_public ON evidence_items(is_public);

-- Add is_public flag to framework_sessions table (for sharing completed analyses)
ALTER TABLE framework_sessions ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE framework_sessions ADD COLUMN shared_publicly_at TEXT;
CREATE INDEX IF NOT EXISTS idx_framework_sessions_public ON framework_sessions(is_public);

-- Create guest_sessions table for tracking anonymous users
CREATE TABLE IF NOT EXISTS guest_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  last_activity TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  framework_data TEXT, -- JSON of temporary framework work
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_session_id ON guest_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_expires_at ON guest_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_last_activity ON guest_sessions(last_activity);

-- Add rate limiting table for guest users
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL, -- IP address or session_id
  identifier_type TEXT NOT NULL, -- 'ip' or 'session'
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TEXT NOT NULL DEFAULT (datetime('now')),
  window_end TEXT NOT NULL,
  blocked_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier, identifier_type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_end);

-- Add guest conversion tracking
CREATE TABLE IF NOT EXISTS guest_conversions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_session_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  converted_at TEXT NOT NULL DEFAULT (datetime('now')),
  framework_count INTEGER NOT NULL DEFAULT 0,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  dataset_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_guest_conversions_guest_session ON guest_conversions(guest_session_id);
CREATE INDEX IF NOT EXISTS idx_guest_conversions_user ON guest_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_guest_conversions_date ON guest_conversions(converted_at);
