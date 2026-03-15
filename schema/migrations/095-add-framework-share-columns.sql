-- Add share_token and category columns to framework_sessions
-- share_token: URL-safe token for public framework sharing
-- category: classification for library publishing
ALTER TABLE framework_sessions ADD COLUMN share_token TEXT;
ALTER TABLE framework_sessions ADD COLUMN category TEXT;
