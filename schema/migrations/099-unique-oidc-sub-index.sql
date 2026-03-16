-- Migration 099: Make oidc_sub unique to prevent duplicate accounts on concurrent OIDC first-logins
-- Drop the non-unique index from migration 096 and replace with a unique one

DROP INDEX IF EXISTS idx_users_oidc_sub;
CREATE UNIQUE INDEX idx_users_oidc_sub ON users(oidc_sub) WHERE oidc_sub IS NOT NULL;
