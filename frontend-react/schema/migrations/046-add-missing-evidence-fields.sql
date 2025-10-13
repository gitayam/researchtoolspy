-- Migration 046: Add Missing Fields to Evidence Table
-- Date: 2025-10-13
-- Issue: ACH API expects 'date' and 'credibility_score' fields that don't exist
-- This adds the missing fields to match ACH expectations

-- Add date field for evidence timestamp
ALTER TABLE evidence ADD COLUMN date TEXT;

-- Add credibility_score for evidence assessment (1-6 scale)
ALTER TABLE evidence ADD COLUMN credibility_score TEXT;

-- Add reliability field for source reliability (A-F scale)
ALTER TABLE evidence ADD COLUMN reliability TEXT;

-- Create index for date-based queries
CREATE INDEX IF NOT EXISTS idx_evidence_date ON evidence(date);

-- Create index for credibility filtering
CREATE INDEX IF NOT EXISTS idx_evidence_credibility ON evidence(credibility_score);
