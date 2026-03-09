-- Migration 066: Add COP task board for investigative actions
-- Tasks can be linked to personas, markers, or hypotheses

CREATE TABLE IF NOT EXISTS cop_tasks (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',  -- 'todo', 'in_progress', 'done', 'blocked'
  priority TEXT DEFAULT 'medium',  -- 'low', 'medium', 'high', 'critical'
  task_type TEXT DEFAULT 'general',  -- 'pimeyes', 'geoguessr', 'forensic', 'osint', 'reverse_image', 'social_media', 'general'
  assigned_to TEXT,  -- collaborator name or handle
  linked_persona_id TEXT,  -- FK to cop_personas (optional)
  linked_marker_id TEXT,  -- FK to cop_markers (optional)
  linked_hypothesis_id TEXT,  -- FK to cop_hypotheses (optional)
  due_date TEXT,
  completed_at TEXT,
  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_tasks_session ON cop_tasks(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_tasks_status ON cop_tasks(status);
CREATE INDEX IF NOT EXISTS idx_cop_tasks_assigned ON cop_tasks(assigned_to);
