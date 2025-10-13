-- Add processing_status for progressive loading
-- Migration: 043
-- Created: 2025-10-13

-- Add processing_status column to content_analysis table
ALTER TABLE content_analysis ADD COLUMN processing_status TEXT DEFAULT 'complete';

-- Status values:
-- - 'processing': Analysis in progress, results being generated
-- - 'complete': All analyses complete
-- - 'error': Analysis failed

-- Update existing records to 'complete' status
UPDATE content_analysis SET processing_status = 'complete' WHERE processing_status IS NULL;
