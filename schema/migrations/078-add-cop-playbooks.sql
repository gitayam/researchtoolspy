-- Migration 078: Add COP playbook engine tables
-- Playbooks contain rules that react to cop_events.
-- Rules: when (event match) -> if (conditions) -> then (actions).

CREATE TABLE IF NOT EXISTS cop_playbooks (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',  -- 'active', 'paused', 'draft'
  source TEXT DEFAULT 'custom',  -- 'custom', 'template'
  template_id TEXT,
  execution_count INTEGER DEFAULT 0,
  last_triggered_at TEXT,
  last_processed_event_id TEXT,  -- Cursor for polling cop_events

  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_playbooks_session ON cop_playbooks(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_playbooks_status ON cop_playbooks(status);

CREATE TABLE IF NOT EXISTS cop_playbook_rules (
  id TEXT PRIMARY KEY,
  playbook_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  trigger_event TEXT NOT NULL,
  trigger_filter TEXT DEFAULT '{}',
  conditions TEXT DEFAULT '[]',
  actions TEXT DEFAULT '[]',
  cooldown_seconds INTEGER DEFAULT 0,
  last_fired_at TEXT,
  fire_count INTEGER DEFAULT 0,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (playbook_id) REFERENCES cop_playbooks(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_playbook_rules_playbook ON cop_playbook_rules(playbook_id);
CREATE INDEX IF NOT EXISTS idx_cop_playbook_rules_trigger ON cop_playbook_rules(trigger_event);

CREATE TABLE IF NOT EXISTS cop_playbook_log (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  playbook_id TEXT NOT NULL,
  cop_session_id TEXT NOT NULL,
  trigger_event_id TEXT,
  actions_taken TEXT DEFAULT '[]',
  status TEXT DEFAULT 'success',  -- 'success', 'partial', 'failed'
  error_message TEXT,
  duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (rule_id) REFERENCES cop_playbook_rules(id),
  FOREIGN KEY (playbook_id) REFERENCES cop_playbooks(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_playbook_log_playbook ON cop_playbook_log(playbook_id);
CREATE INDEX IF NOT EXISTS idx_cop_playbook_log_session ON cop_playbook_log(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_playbook_log_rule ON cop_playbook_log(rule_id);
