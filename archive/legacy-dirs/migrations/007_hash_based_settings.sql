-- Migration: Hash-Based Settings System
-- Description: Add support for hash-based user settings without traditional authentication

-- User settings table - stores all user preferences keyed by hash
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_hash TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('display', 'ai', 'notifications', 'workspace')),
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_hash, category, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_user_settings_hash ON user_settings(user_hash);
CREATE INDEX IF NOT EXISTS idx_user_settings_category ON user_settings(user_hash, category);

-- Update workspaces table to use hash instead of user_id
-- First, add the new column if it doesn't exist
ALTER TABLE workspaces ADD COLUMN user_hash TEXT;

-- Create index for hash-based lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_user_hash ON workspaces(user_hash);

-- Data export history table - track exports for audit
CREATE TABLE IF NOT EXISTS data_exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  export_id TEXT UNIQUE NOT NULL,
  user_hash TEXT NOT NULL,
  export_type TEXT NOT NULL CHECK(export_type IN ('full', 'workspace', 'settings')),
  workspace_id INTEGER,
  file_size INTEGER,
  item_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  downloaded_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_data_exports_hash ON data_exports(user_hash);
CREATE INDEX IF NOT EXISTS idx_data_exports_id ON data_exports(export_id);

-- Hash authentication table - track hash creation and usage
CREATE TABLE IF NOT EXISTS hash_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP,
  login_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_hash_accounts_hash ON hash_accounts(account_hash);
CREATE INDEX IF NOT EXISTS idx_hash_accounts_active ON hash_accounts(is_active);

-- Settings change log - audit trail for settings changes
CREATE TABLE IF NOT EXISTS settings_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_hash TEXT NOT NULL,
  category TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_settings_audit_hash ON settings_audit_log(user_hash);
CREATE INDEX IF NOT EXISTS idx_settings_audit_date ON settings_audit_log(changed_at);
