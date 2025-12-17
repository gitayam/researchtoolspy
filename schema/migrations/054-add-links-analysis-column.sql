-- Migration 054: Add links_analysis column to content_analysis table
-- This stores structured data about all links found in the article body
-- Helps researchers identify sources, references, and related content

-- Add links_analysis column to store array of LinkInfo objects
-- Schema: [{ url, anchor_text[], count, domain, is_external }]
ALTER TABLE content_analysis ADD COLUMN links_analysis TEXT DEFAULT '[]';

-- Update existing rows to have empty array
UPDATE content_analysis SET links_analysis = '[]' WHERE links_analysis IS NULL;

-- Add index for faster queries on link analysis existence
CREATE INDEX IF NOT EXISTS idx_content_analysis_has_links ON content_analysis(
  (CASE WHEN links_analysis != '[]' THEN 1 ELSE 0 END)
);
