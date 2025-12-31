-- Migration: Create Framework Entities Table
-- Phase: 3 (Entity Integration)
-- Date: 2025-12-31
-- Description: Create framework_entities table for linking any entity type to frameworks
-- Supports: actors, sources, events (in addition to existing evidence_items via framework_evidence)

-- Framework Entity Linking: Links any entity type to frameworks
CREATE TABLE IF NOT EXISTS framework_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'actor', 'source', 'event'
  entity_id TEXT NOT NULL,
  relevance_note TEXT,
  role TEXT, -- e.g., 'subject', 'deceiver', 'target', 'source', 'witness'
  confidence REAL DEFAULT 1.0, -- How confident we are in this link (0-1)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER DEFAULT 1,
  UNIQUE(framework_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_framework_entities_framework_id ON framework_entities(framework_id);
CREATE INDEX IF NOT EXISTS idx_framework_entities_entity_type ON framework_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_framework_entities_entity_id ON framework_entities(entity_id);
