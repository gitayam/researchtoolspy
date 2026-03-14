-- Migration 090: Global alert feed state for COP workspaces
-- Stores local alert state (dismissed/actioned/linked) per REDSIGHT incident

ALTER TABLE cop_sessions ADD COLUMN global_alerts_enabled INTEGER DEFAULT 0;
ALTER TABLE cop_sessions ADD COLUMN global_alerts_region TEXT;

CREATE TABLE IF NOT EXISTS cop_alert_state (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  workspace_id TEXT,
  redsight_incident_id TEXT NOT NULL,
  status TEXT DEFAULT 'new',  -- new, dismissed, action, analysis
  linked_rfi_id TEXT,
  linked_task_id TEXT,
  notes TEXT,
  severity TEXT,
  incident_type TEXT,
  location_name TEXT,
  summary TEXT,
  actioned_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id),
  FOREIGN KEY (linked_rfi_id) REFERENCES cop_rfis(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_alert_state_session ON cop_alert_state(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_alert_state_incident ON cop_alert_state(redsight_incident_id);
CREATE INDEX IF NOT EXISTS idx_cop_alert_state_status ON cop_alert_state(cop_session_id, status);
