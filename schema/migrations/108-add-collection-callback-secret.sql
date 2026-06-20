-- Per-job verification token for the collection callback (backward-compatible rollout).
-- Nullable: existing jobs and not-yet-updated agents simply have/send no token.
ALTER TABLE collection_jobs ADD COLUMN callback_secret TEXT;
