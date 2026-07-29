-- Remove the two content_analysis indexes proven redundant by the 2026-07-28
-- post-0004 observation pass.
--
-- Each replacement has the same leading column, so SQLite can use it for both
-- the original single-column predicate and the workspace-qualified predicate:
--   idx_content_analysis_hash_workspace(content_hash, workspace_id)
--   idx_content_analysis_user_workspace(user_id, workspace_id)
--
-- Rollback:
--   CREATE INDEX idx_content_analysis_hash
--     ON content_analysis(content_hash);
--   CREATE INDEX idx_content_analysis_user
--     ON content_analysis(user_id);

DROP INDEX IF EXISTS idx_content_analysis_hash;
DROP INDEX IF EXISTS idx_content_analysis_user;
