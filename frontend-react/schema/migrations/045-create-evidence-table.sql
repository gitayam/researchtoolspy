-- Migration 045: Create Evidence Table
-- Date: 2025-10-13
-- Issue: API endpoints query 'evidence' table but only 'evidence_items' exists
-- This creates the evidence table with the schema expected by /api/evidence.ts

CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Core fields
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',

  -- JSON fields (stored as TEXT)
  tags TEXT, -- JSON array
  source TEXT, -- JSON object: {type, name, url, credibility, reliability}
  metadata TEXT, -- JSON object
  sats_evaluation TEXT, -- JSON object for SATS assessment
  frameworks TEXT, -- JSON array of related frameworks
  attachments TEXT, -- JSON array of attachments
  key_points TEXT, -- JSON array
  contradictions TEXT, -- JSON array
  corroborations TEXT, -- JSON array
  implications TEXT, -- JSON array
  previous_versions TEXT, -- JSON array for version history

  -- Versioning
  version INTEGER DEFAULT 1,

  -- Tracking
  created_by INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER,

  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence(type);
CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence(status);
CREATE INDEX IF NOT EXISTS idx_evidence_created_by ON evidence(created_by);
CREATE INDEX IF NOT EXISTS idx_evidence_created_at ON evidence(created_at);
CREATE INDEX IF NOT EXISTS idx_evidence_updated_at ON evidence(updated_at);
