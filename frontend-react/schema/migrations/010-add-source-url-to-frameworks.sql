-- Add source_url column to framework_sessions table
-- Stores the URL that was scraped to populate the analysis

ALTER TABLE framework_sessions ADD COLUMN source_url TEXT;

-- Add index for lookups by source URL
CREATE INDEX IF NOT EXISTS idx_framework_sessions_source_url
ON framework_sessions(source_url);
