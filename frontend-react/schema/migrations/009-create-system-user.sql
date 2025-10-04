-- Migration: Create System User
-- Phase: System Initialization
-- Date: 2025-10-04
-- Description: Create a system user (id=1) for foreign key constraints in evidence_items and other tables

-- Create system user if it doesn't already exist
INSERT OR IGNORE INTO users (
  id,
  username,
  email,
  full_name,
  hashed_password,
  is_active,
  is_verified,
  role
) VALUES (
  1,
  'system',
  'system@researchtoolspy.local',
  'System User',
  'N/A',
  1,
  1,
  'admin'
);
