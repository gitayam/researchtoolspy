-- Cloudflare D1 Database Schema for ResearchToolsPy
-- Generated from SQLAlchemy models
-- Date: 2025-09-30

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  full_name TEXT,
  hashed_password TEXT,
  user_hash TEXT UNIQUE,  -- For anonymous/hash-based users
  account_hash TEXT UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_verified INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'researcher',
  organization TEXT,
  department TEXT,
  bio TEXT,
  preferences TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_hash ON users(user_hash);
CREATE INDEX IF NOT EXISTS idx_users_account_hash ON users(account_hash);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  scopes TEXT NOT NULL DEFAULT '[]', -- JSON array
  last_used_at TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);

-- Framework Sessions table
CREATE TABLE IF NOT EXISTS framework_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  framework_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  data TEXT NOT NULL DEFAULT '{}', -- JSON
  config TEXT, -- JSON
  tags TEXT, -- JSON array
  version INTEGER NOT NULL DEFAULT 1,
  ai_suggestions TEXT, -- JSON
  ai_analysis_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_framework_sessions_user_id ON framework_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_framework_sessions_framework_type ON framework_sessions(framework_type);
CREATE INDEX IF NOT EXISTS idx_framework_sessions_status ON framework_sessions(status);

-- Framework Templates table
CREATE TABLE IF NOT EXISTS framework_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  framework_type TEXT NOT NULL,
  template_data TEXT NOT NULL, -- JSON
  is_public INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_framework_templates_created_by_id ON framework_templates(created_by_id);
CREATE INDEX IF NOT EXISTS idx_framework_templates_framework_type ON framework_templates(framework_type);

-- Framework Exports table
CREATE TABLE IF NOT EXISTS framework_exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  exported_by_id INTEGER NOT NULL,
  export_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (exported_by_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_framework_exports_session_id ON framework_exports(session_id);
CREATE INDEX IF NOT EXISTS idx_framework_exports_exported_by_id ON framework_exports(exported_by_id);

-- Auth Logs table
CREATE TABLE IF NOT EXISTS auth_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  metadata TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_action ON auth_logs(action);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at);

-- Research Tools Results table
CREATE TABLE IF NOT EXISTS research_tool_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tool_type TEXT NOT NULL,
  input_data TEXT NOT NULL, -- JSON
  output_data TEXT, -- JSON
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_research_tool_results_user_id ON research_tool_results(user_id);
CREATE INDEX IF NOT EXISTS idx_research_tool_results_tool_type ON research_tool_results(tool_type);
CREATE INDEX IF NOT EXISTS idx_research_tool_results_status ON research_tool_results(status);

-- Evidence table
CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  tags TEXT NOT NULL DEFAULT '[]', -- JSON array
  source TEXT NOT NULL DEFAULT '{}', -- JSON object
  metadata TEXT NOT NULL DEFAULT '{}', -- JSON object
  sats_evaluation TEXT, -- JSON object (optional)
  frameworks TEXT NOT NULL DEFAULT '[]', -- JSON array of framework associations
  attachments TEXT NOT NULL DEFAULT '[]', -- JSON array of attachments
  created_by TEXT NOT NULL DEFAULT 'anonymous',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  key_points TEXT NOT NULL DEFAULT '[]', -- JSON array
  contradictions TEXT NOT NULL DEFAULT '[]', -- JSON array
  corroborations TEXT NOT NULL DEFAULT '[]', -- JSON array
  implications TEXT NOT NULL DEFAULT '[]', -- JSON array
  version INTEGER NOT NULL DEFAULT 1,
  previous_versions TEXT NOT NULL DEFAULT '[]' -- JSON array of previous version IDs
);

CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence(type);
CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence(status);
CREATE INDEX IF NOT EXISTS idx_evidence_created_by ON evidence(created_by);
CREATE INDEX IF NOT EXISTS idx_evidence_created_at ON evidence(created_at);
CREATE INDEX IF NOT EXISTS idx_evidence_updated_at ON evidence(updated_at);

-- Evidence Collections table
CREATE TABLE IF NOT EXISTS evidence_collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  evidence_ids TEXT NOT NULL DEFAULT '[]', -- JSON array
  tags TEXT NOT NULL DEFAULT '[]', -- JSON array
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  shared_with TEXT NOT NULL DEFAULT '[]' -- JSON array of user IDs
);

CREATE INDEX IF NOT EXISTS idx_evidence_collections_created_by ON evidence_collections(created_by);
CREATE INDEX IF NOT EXISTS idx_evidence_collections_created_at ON evidence_collections(created_at);
