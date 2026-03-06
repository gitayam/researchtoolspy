-- Migration 059: Add workspace fields to cop_sessions
-- Supports multi-panel workspace layout and investigation linking

ALTER TABLE cop_sessions ADD COLUMN panel_layout TEXT DEFAULT '{}';
ALTER TABLE cop_sessions ADD COLUMN workspace_mode TEXT DEFAULT 'progress';
ALTER TABLE cop_sessions ADD COLUMN investigation_id TEXT;

-- Index for investigation lookup
CREATE INDEX IF NOT EXISTS idx_cop_sessions_investigation_id ON cop_sessions(investigation_id);
