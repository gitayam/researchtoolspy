-- Migration 085: Add cross-panel linking columns to cop_timeline_entries
-- Enables: system auto-generation, dedup, and entity linking

ALTER TABLE cop_timeline_entries ADD COLUMN entity_type TEXT;
ALTER TABLE cop_timeline_entries ADD COLUMN entity_id TEXT;
ALTER TABLE cop_timeline_entries ADD COLUMN action TEXT;

CREATE INDEX IF NOT EXISTS idx_cop_timeline_dedup
  ON cop_timeline_entries(cop_session_id, entity_type, entity_id, action);
