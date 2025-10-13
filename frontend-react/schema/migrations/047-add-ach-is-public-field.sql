-- Migration 047: Add is_public Field to ACH Analyses
-- Date: 2025-10-13
-- Issue: ACH API expects 'is_public' field for workspace isolation
-- This adds the missing field to ach_analyses table
-- Note: workspace_id and original_workspace_id already exist

-- Add is_public field for public sharing
ALTER TABLE ach_analyses ADD COLUMN is_public INTEGER DEFAULT 0;

-- Create index for public analyses queries
CREATE INDEX IF NOT EXISTS idx_ach_is_public ON ach_analyses(is_public);

-- Create index for workspace queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_ach_workspace ON ach_analyses(workspace_id);
