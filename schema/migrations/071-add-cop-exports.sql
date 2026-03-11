-- Migration 071: Add COP export history for tracking generated files

CREATE TABLE IF NOT EXISTS cop_exports (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  format TEXT NOT NULL,  -- 'geojson', 'kml', 'cot', 'stix', 'csv'
  scope TEXT DEFAULT 'full',  -- 'full', 'layers', 'entities', 'evidence', 'tasks'
  filters_json TEXT DEFAULT '{}',
  file_url TEXT,
  file_size_bytes INTEGER,
  status TEXT DEFAULT 'pending',  -- 'pending', 'generating', 'completed', 'failed'
  error_message TEXT,

  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_exports_session ON cop_exports(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_exports_status ON cop_exports(status);
