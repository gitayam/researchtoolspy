-- Migration 072: Add task dependencies and subtask support
-- Dependencies block task transitions. Subtasks roll up to parent.

ALTER TABLE cop_tasks ADD COLUMN parent_task_id TEXT;
ALTER TABLE cop_tasks ADD COLUMN depth INTEGER DEFAULT 0;
ALTER TABLE cop_tasks ADD COLUMN position INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS cop_task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  depends_on_task_id TEXT NOT NULL,
  cop_session_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (task_id) REFERENCES cop_tasks(id),
  FOREIGN KEY (depends_on_task_id) REFERENCES cop_tasks(id),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_task_deps_task ON cop_task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_cop_task_deps_depends ON cop_task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_cop_task_deps_session ON cop_task_dependencies(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_tasks_parent ON cop_tasks(parent_task_id);
