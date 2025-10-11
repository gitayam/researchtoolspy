-- Add sharing support to content_analysis table
-- Migration: 038
-- Created: 2025-10-11

-- Add share_token and is_public fields
ALTER TABLE content_analysis ADD COLUMN share_token TEXT;
ALTER TABLE content_analysis ADD COLUMN is_public INTEGER DEFAULT 0;
ALTER TABLE content_analysis ADD COLUMN view_count INTEGER DEFAULT 0;

-- Create index for share token lookups
CREATE INDEX idx_content_analysis_share_token ON content_analysis(share_token);
