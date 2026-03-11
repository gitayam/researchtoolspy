-- Migration 076: Add COP asset tracking for people, sources, infrastructure, digital resources
-- Single table with type-specific JSON details column.

CREATE TABLE IF NOT EXISTS cop_assets (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  asset_type TEXT NOT NULL,  -- 'human', 'source', 'infrastructure', 'digital'
  name TEXT NOT NULL,
  status TEXT DEFAULT 'available',  -- 'available', 'deployed', 'degraded', 'offline', 'compromised', 'exhausted'
  details TEXT DEFAULT '{}',
  assigned_to_task_id TEXT,
  location TEXT,
  lat REAL,
  lon REAL,
  sensitivity TEXT DEFAULT 'unclassified',  -- 'unclassified', 'internal', 'restricted'
  last_checked_at TEXT,
  notes TEXT,

  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_assets_session ON cop_assets(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_assets_type ON cop_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_cop_assets_status ON cop_assets(status);
CREATE INDEX IF NOT EXISTS idx_cop_assets_task ON cop_assets(assigned_to_task_id);

CREATE TABLE IF NOT EXISTS cop_asset_log (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  cop_session_id TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (asset_id) REFERENCES cop_assets(id),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_asset_log_asset ON cop_asset_log(asset_id);
CREATE INDEX IF NOT EXISTS idx_cop_asset_log_session ON cop_asset_log(cop_session_id);
