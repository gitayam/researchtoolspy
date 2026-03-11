-- Migration 075: Add SLA tracking to tasks

ALTER TABLE cop_tasks ADD COLUMN sla_hours INTEGER;
ALTER TABLE cop_tasks ADD COLUMN sla_started_at TEXT;
ALTER TABLE cop_tasks ADD COLUMN sla_breached INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cop_tasks_sla ON cop_tasks(sla_breached, sla_started_at);
