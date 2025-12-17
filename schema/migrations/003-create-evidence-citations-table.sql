-- Migration: Create Evidence Citations Table
-- Phase: 2 (Evidence System Migration)
-- Date: 2025-10-01
-- Description: Create evidence_citations and framework_evidence tables for linking

-- Citations: Links evidence to datasets with context
CREATE TABLE IF NOT EXISTS evidence_citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evidence_id INTEGER NOT NULL,
  dataset_id INTEGER NOT NULL,
  page_number TEXT,
  quote TEXT,
  context TEXT,
  citation_format TEXT, -- APA, MLA, Chicago
  url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_citations_evidence_id ON evidence_citations(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_citations_dataset_id ON evidence_citations(dataset_id);

-- Framework Evidence Linking: Links evidence items to frameworks
CREATE TABLE IF NOT EXISTS framework_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id INTEGER NOT NULL,
  evidence_id INTEGER NOT NULL,
  section_key TEXT,
  relevance_note TEXT,
  weight REAL DEFAULT 1.0, -- How important this evidence is
  supports INTEGER DEFAULT 1, -- 1=supports, 0=contradicts
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER DEFAULT 1,
  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE,
  UNIQUE(framework_id, evidence_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_framework_evidence_framework_id ON framework_evidence(framework_id);
CREATE INDEX IF NOT EXISTS idx_framework_evidence_evidence_id ON framework_evidence(evidence_id);
