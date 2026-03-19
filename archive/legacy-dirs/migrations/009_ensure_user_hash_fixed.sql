-- Final migration to ensure user_hash column exists
-- and is indexed for performance.

-- account_hash already exists in prod, only user_hash is missing.
ALTER TABLE users ADD COLUMN user_hash TEXT;

-- Create Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_hash ON users(user_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account_hash ON users(account_hash);
