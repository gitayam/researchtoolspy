-- Migration 096: Add OIDC/SSO columns to users table
-- Supports Authentik OIDC provider for SSO authentication

ALTER TABLE users ADD COLUMN oidc_sub TEXT;
ALTER TABLE users ADD COLUMN oidc_provider TEXT;
ALTER TABLE users ADD COLUMN oidc_email TEXT;

CREATE INDEX idx_users_oidc_sub ON users(oidc_sub);
