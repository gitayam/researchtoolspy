-- Migration: Create Evidence Items Table
-- Phase: 2 (Evidence System Migration)
-- Date: 2025-10-01
-- Description: Create evidence_items table for analyzed facts with 5 W's + How framework

CREATE TABLE IF NOT EXISTS evidence_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Core
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  summary TEXT,

  -- Classification
  evidence_type TEXT NOT NULL, -- observation, document_excerpt, statement, event, measurement, artifact
  evidence_level TEXT, -- tactical, operational, strategic

  -- 5 W's + How
  who_involved TEXT, -- JSON array
  what_happened TEXT,
  when_occurred TEXT, -- ISO timestamp or range
  where_occurred TEXT, -- JSON: {lat, lng, address, region}
  why_significant TEXT,
  how_obtained TEXT,

  -- Assessment
  credibility TEXT NOT NULL, -- 1-6
  reliability TEXT NOT NULL, -- A-F
  confidence_level TEXT, -- high, medium, low
  priority TEXT, -- low, normal, high, critical

  -- Relationships
  related_evidence_ids TEXT, -- JSON
  contradicts_evidence_ids TEXT, -- JSON
  corroborates_evidence_ids TEXT, -- JSON

  -- Metadata
  tags TEXT, -- JSON
  keywords TEXT, -- JSON
  sensitivity_level TEXT, -- public, sensitive, classified

  -- Tracking
  status TEXT DEFAULT 'draft', -- draft, verified, archived
  created_by INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  verified_at TEXT,
  verified_by INTEGER,

  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (verified_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_type ON evidence_items(evidence_type);
CREATE INDEX IF NOT EXISTS idx_evidence_items_level ON evidence_items(evidence_level);
CREATE INDEX IF NOT EXISTS idx_evidence_items_status ON evidence_items(status);
CREATE INDEX IF NOT EXISTS idx_evidence_items_created_by ON evidence_items(created_by);
CREATE INDEX IF NOT EXISTS idx_evidence_items_created_at ON evidence_items(created_at);
