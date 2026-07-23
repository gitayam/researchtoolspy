-- Restore the framework sharing counters expected by public view and clone APIs.
-- Rollback:
--   ALTER TABLE framework_sessions DROP COLUMN clone_count;
--   ALTER TABLE framework_sessions DROP COLUMN view_count;

ALTER TABLE framework_sessions
  ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE framework_sessions
  ADD COLUMN clone_count INTEGER NOT NULL DEFAULT 0;
