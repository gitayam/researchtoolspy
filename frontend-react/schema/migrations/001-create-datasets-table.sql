-- Migration: Create Datasets Table
-- Phase: 1 (Evidence System Migration)
-- Date: 2025-10-01
-- Description: Create datasets table (renamed from evidence) for information sources

CREATE TABLE IF NOT EXISTS datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  source TEXT NOT NULL,
  tags TEXT,
  metadata TEXT,
  created_by INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Additional dataset-specific fields
  source_name TEXT,
  source_url TEXT,
  author TEXT,
  organization TEXT,
  publication_date TEXT,
  access_date TEXT,
  reliability_rating TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_datasets_type ON datasets(type);
CREATE INDEX IF NOT EXISTS idx_datasets_status ON datasets(status);
CREATE INDEX IF NOT EXISTS idx_datasets_created_by ON datasets(created_by);
CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON datasets(created_at);

-- Create framework_datasets table (replaces framework_evidence)
CREATE TABLE IF NOT EXISTS framework_datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id INTEGER NOT NULL,
  dataset_id INTEGER NOT NULL,
  section_key TEXT,
  relevance_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER DEFAULT 1,
  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
  UNIQUE(framework_id, dataset_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_framework_datasets_framework_id ON framework_datasets(framework_id);
CREATE INDEX IF NOT EXISTS idx_framework_datasets_dataset_id ON framework_datasets(dataset_id);
