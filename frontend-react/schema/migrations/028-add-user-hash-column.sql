-- ============================================================================
-- Migration 028: Add user_hash column to users table
-- Description: Support hash-based authentication for anonymous users
-- Date: 2025-10-08
-- ============================================================================

-- Add user_hash column to users table for anonymous/guest users
ALTER TABLE users ADD COLUMN user_hash TEXT UNIQUE;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_users_user_hash ON users(user_hash);

-- Make username and email nullable for hash-based users
-- Note: In SQLite, we cannot directly modify columns, so we need to recreate the table
-- However, for D1 compatibility, we'll work with the existing structure

-- ============================================================
-- NOTES
-- ============================================================
-- 1. user_hash allows anonymous users to maintain persistent workspaces
-- 2. Hash-based users won't have username/email/password requirements
-- 3. The unique constraint ensures each hash maps to one user
-- ============================================================