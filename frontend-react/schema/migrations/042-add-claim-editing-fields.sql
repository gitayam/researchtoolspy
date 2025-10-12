-- Add fields for user-edited claim text and method scores
-- Migration 042: Enhance Claims Editing System

ALTER TABLE claim_adjustments ADD COLUMN adjusted_claim_text TEXT;
ALTER TABLE claim_adjustments ADD COLUMN adjusted_methods TEXT; -- JSON of edited 6 detection method scores and reasoning
