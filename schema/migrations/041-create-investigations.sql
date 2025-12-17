-- Migration 041: Create Investigations System
-- Creates the core investigation tables and linking tables for investigation-centric workflow

-- Core investigations table
CREATE TABLE IF NOT EXISTS investigations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'general_topic', -- 'structured_research', 'general_topic', 'rapid_analysis'
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'archived'
  research_question_id TEXT, -- Foreign key to research_questions (optional)
  tags TEXT, -- JSON array of tags
  metadata TEXT, -- JSON object for extensibility
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (research_question_id) REFERENCES research_questions(id)
);

CREATE INDEX IF NOT EXISTS idx_investigations_workspace ON investigations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_investigations_created_by ON investigations(created_by);
CREATE INDEX IF NOT EXISTS idx_investigations_status ON investigations(status);
CREATE INDEX IF NOT EXISTS idx_investigations_type ON investigations(type);

-- Link evidence to investigations (many-to-many)
CREATE TABLE IF NOT EXISTS investigation_evidence (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  evidence_id INTEGER NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  added_by INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id),
  UNIQUE(investigation_id, evidence_id)
);

CREATE INDEX IF NOT EXISTS idx_investigation_evidence_inv ON investigation_evidence(investigation_id);
CREATE INDEX IF NOT EXISTS idx_investigation_evidence_ev ON investigation_evidence(evidence_id);

-- Link actors to investigations (many-to-many)
CREATE TABLE IF NOT EXISTS investigation_actors (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  added_by INTEGER NOT NULL,
  role TEXT, -- 'subject', 'witness', 'expert', 'stakeholder', etc.
  notes TEXT,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id),
  UNIQUE(investigation_id, actor_id)
);

CREATE INDEX IF NOT EXISTS idx_investigation_actors_inv ON investigation_actors(investigation_id);
CREATE INDEX IF NOT EXISTS idx_investigation_actors_actor ON investigation_actors(actor_id);

-- Link sources to investigations (many-to-many)
CREATE TABLE IF NOT EXISTS investigation_sources (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  added_by INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id),
  UNIQUE(investigation_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_investigation_sources_inv ON investigation_sources(investigation_id);
CREATE INDEX IF NOT EXISTS idx_investigation_sources_source ON investigation_sources(source_id);

-- Link events to investigations (many-to-many)
CREATE TABLE IF NOT EXISTS investigation_events (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  added_by INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id),
  UNIQUE(investigation_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_investigation_events_inv ON investigation_events(investigation_id);
CREATE INDEX IF NOT EXISTS idx_investigation_events_event ON investigation_events(event_id);

-- Link framework analyses to investigations
-- This table acts as a registry of which framework analyses belong to which investigation
CREATE TABLE IF NOT EXISTS investigation_frameworks (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  framework_type TEXT NOT NULL, -- 'ach', 'pmesii_pt', 'dime', 'cog', 'swot', etc.
  framework_id TEXT NOT NULL, -- ID in respective framework table (e.g., ach_analyses.id)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_investigation_frameworks_inv ON investigation_frameworks(investigation_id);
CREATE INDEX IF NOT EXISTS idx_investigation_frameworks_type ON investigation_frameworks(framework_type);

-- Investigation activity log for timeline/audit trail
CREATE TABLE IF NOT EXISTS investigation_activity (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL, -- 'created', 'updated', 'evidence_added', 'actor_added', 'framework_added', etc.
  activity_data TEXT, -- JSON object with details
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_investigation_activity_inv ON investigation_activity(investigation_id);
CREATE INDEX IF NOT EXISTS idx_investigation_activity_created ON investigation_activity(created_at);

-- Add investigation_id column to existing tables (for backward compatibility and direct linking)
-- These columns are optional - items can be linked via investigation_* tables OR directly
-- Only adding to tables that currently exist

-- Content analysis
ALTER TABLE content_analysis ADD COLUMN investigation_id TEXT REFERENCES investigations(id);
CREATE INDEX IF NOT EXISTS idx_content_analysis_investigation ON content_analysis(investigation_id);

-- ACH analyses
ALTER TABLE ach_analyses ADD COLUMN investigation_id TEXT REFERENCES investigations(id);
CREATE INDEX IF NOT EXISTS idx_ach_analyses_investigation ON ach_analyses(investigation_id);
