-- Migration: Update Evidence Items Table Schema
-- Phase: Evidence Schema Alignment
-- Date: 2025-10-04
-- Description: Update evidence_items table to match TypeScript types and API expectations

-- Add missing columns for source tracking
ALTER TABLE evidence_items ADD COLUMN source_classification TEXT; -- primary, secondary, tertiary
ALTER TABLE evidence_items ADD COLUMN source_name TEXT;
ALTER TABLE evidence_items ADD COLUMN source_url TEXT;
ALTER TABLE evidence_items ADD COLUMN source_id TEXT; -- Link to Source entity

-- Add category for framework categorization (PMESII, DIME, etc.)
ALTER TABLE evidence_items ADD COLUMN category TEXT;

-- Add updated_by tracking
ALTER TABLE evidence_items ADD COLUMN updated_by INTEGER DEFAULT 1;

-- Create new columns with correct names (to match API expectations)
ALTER TABLE evidence_items ADD COLUMN who TEXT;
ALTER TABLE evidence_items ADD COLUMN what TEXT;
ALTER TABLE evidence_items ADD COLUMN where_location TEXT;
ALTER TABLE evidence_items ADD COLUMN why_purpose TEXT;
ALTER TABLE evidence_items ADD COLUMN how_method TEXT;

-- Copy data from old columns to new columns
UPDATE evidence_items SET who = who_involved WHERE who_involved IS NOT NULL;
UPDATE evidence_items SET what = what_happened WHERE what_happened IS NOT NULL;
UPDATE evidence_items SET where_location = where_occurred WHERE where_occurred IS NOT NULL;
UPDATE evidence_items SET why_purpose = why_significant WHERE why_significant IS NOT NULL;
UPDATE evidence_items SET how_method = how_obtained WHERE how_obtained IS NOT NULL;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_evidence_items_category ON evidence_items(category);
CREATE INDEX IF NOT EXISTS idx_evidence_items_source_classification ON evidence_items(source_classification);
