-- Migration 073: Add COP task templates for reusable workflow blueprints

CREATE TABLE IF NOT EXISTS cop_task_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT DEFAULT 'universal',
  tasks_json TEXT DEFAULT '[]',

  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cop_task_templates_type ON cop_task_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_cop_task_templates_workspace ON cop_task_templates(workspace_id);
