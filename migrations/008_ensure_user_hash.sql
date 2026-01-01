-- Migration to ensure user_hash and account_hash columns exist
-- and are indexed for performance.

-- Add user_hash column if it doesn't exist (SQLite doesn't support IF NOT EXISTS for columns in generic ALTER TABLE)
-- We use a workaround or just try to add it. Since D1 migrations are sequential, we assume if this runs, it's needed.
-- However, for safety in re-runs, we can stick to creating indexes which are safe.

-- Note: In SQLite/D1, adding a column that might exist is tricky without checking pragma.
-- But we can create the indexes. If the columns are missing, this will fail, alerting us.
-- The schema/d1-schema.sql already has them, so this is for existing deployments.

-- Try to add columns (will fail if exists, but that's okay in manual run, but for migration system it might error)
-- Ideally, we'd use a more robust migration tool. For now, let's assume this migration 
-- is specifically to 'finalize' the hash auth schema.

-- We will just ensure the indexes exist, which implies the columns must exist.
-- If columns are missing, we should add them. 
-- Since we can't do conditional logic easily in pure SQL files for D1 without stored procs (limited support),
-- We will rely on the fact that if this is a new deploy, schema.sql is used.
-- If it's an update, we assume standard D1 migration flow.

-- Attempt to add columns. If they exist, this might error in some SQLite versions/tools, 
-- but D1 `migrations apply` usually handles simple statements. 
-- SAFEST STRATEGY: Create a migration that adds them if we are sure they might be missing.
-- Given `007` was `hash_based_settings`, likely `users` table needs updates.

ALTER TABLE users ADD COLUMN user_hash TEXT;
ALTER TABLE users ADD COLUMN account_hash TEXT;

-- Create Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_hash ON users(user_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account_hash ON users(account_hash);
