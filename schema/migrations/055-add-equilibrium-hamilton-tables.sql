-- Migration: Add Equilibrium Analysis and Hamilton Rule tables
-- Date: 2026-01-16
-- Description: Creates tables for equilibrium analysis (longitudinal data)
--              and Hamilton Rule analysis (game theory cooperation)

-- Store equilibrium analyses for longitudinal behavioral data
CREATE TABLE IF NOT EXISTS equilibrium_analyses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  linked_behavior_id TEXT,
  data_source TEXT,           -- JSON: {type, filename, uploaded_at, original_headers, row_count}
  time_series TEXT,           -- JSON array of {timestamp, rate, group?, metadata?}
  variables TEXT,             -- JSON: {time_column, rate_column, group_column?, additional_columns?}
  equilibrium_analysis TEXT,  -- JSON: AI analysis results
  statistics TEXT,            -- JSON: {mean, median, std_deviation, variance, min, max, trend_coefficient}
  workspace_id TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_public INTEGER DEFAULT 0,
  tags TEXT,                  -- JSON array
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Store Hamilton Rule analyses for cooperation/defection predictions
CREATE TABLE IF NOT EXISTS hamilton_rule_analyses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  linked_behavior_id TEXT,
  mode TEXT NOT NULL CHECK(mode IN ('pairwise', 'network')),
  actors TEXT,                -- JSON array of {id, name, type, role?, description?, group?}
  relationships TEXT,         -- JSON array of {id, actor_id, recipient_id, relatedness, benefit, cost, hamilton_score, passes_rule, ...}
  network_analysis TEXT,      -- JSON: network-level stats and predictions
  ai_analysis TEXT,           -- JSON: AI interpretation
  workspace_id TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_public INTEGER DEFAULT 0,
  tags TEXT,                  -- JSON array
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_equilibrium_analyses_workspace
  ON equilibrium_analyses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_equilibrium_analyses_behavior
  ON equilibrium_analyses(linked_behavior_id);
CREATE INDEX IF NOT EXISTS idx_equilibrium_analyses_created_by
  ON equilibrium_analyses(created_by);

CREATE INDEX IF NOT EXISTS idx_hamilton_rule_analyses_workspace
  ON hamilton_rule_analyses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_hamilton_rule_analyses_behavior
  ON hamilton_rule_analyses(linked_behavior_id);
CREATE INDEX IF NOT EXISTS idx_hamilton_rule_analyses_created_by
  ON hamilton_rule_analyses(created_by);
CREATE INDEX IF NOT EXISTS idx_hamilton_rule_analyses_mode
  ON hamilton_rule_analyses(mode);
