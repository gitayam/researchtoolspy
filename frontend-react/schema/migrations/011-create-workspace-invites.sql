-- Migration 011: Workspace Invites and Team Nicknames
-- Adds secure invite link system for investigation teams
-- Date: 2025-10-04

-- ============================================================
-- WORKSPACE INVITES
-- UUID-based invite links for secure team collaboration
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace_invites (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  created_by_id INTEGER NOT NULL,

  -- Invite token (shown in URL)
  invite_token TEXT NOT NULL UNIQUE,

  -- Access control
  default_role TEXT CHECK(default_role IN ('ADMIN', 'EDITOR', 'VIEWER')) NOT NULL DEFAULT 'VIEWER',

  -- Usage limits
  max_uses INTEGER,                       -- NULL = unlimited
  current_uses INTEGER DEFAULT 0,
  expires_at TEXT,                        -- NULL = never expires

  -- Status
  is_active INTEGER DEFAULT 1,

  -- Metadata
  label TEXT,                             -- Optional: "External analysts", "Review team", etc.
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  revoked_by_id INTEGER,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (revoked_by_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_active ON workspace_invites(is_active);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_created_by ON workspace_invites(created_by_id);

-- ============================================================
-- WORKSPACE MEMBERS - Add Nickname Support
-- Workspace-specific display names for team members
-- ============================================================

-- Add nickname column (workspace-specific display name)
ALTER TABLE workspace_members ADD COLUMN nickname TEXT;

-- Add joined_via_invite_id to track invite source
ALTER TABLE workspace_members ADD COLUMN joined_via_invite_id TEXT;

-- Index for nickname lookups
CREATE INDEX IF NOT EXISTS idx_workspace_members_nickname ON workspace_members(nickname);

-- Index for invite tracking
CREATE INDEX IF NOT EXISTS idx_workspace_members_invite ON workspace_members(joined_via_invite_id);

-- ============================================================
-- INVITE USAGE TRACKING
-- Track who joined via which invite for analytics
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace_invite_uses (
  id TEXT PRIMARY KEY,
  invite_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  workspace_member_id TEXT NOT NULL,

  nickname_used TEXT NOT NULL,
  used_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Request metadata
  ip_address TEXT,
  user_agent TEXT,

  FOREIGN KEY (invite_id) REFERENCES workspace_invites(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_member_id) REFERENCES workspace_members(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspace_invite_uses_invite ON workspace_invite_uses(invite_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invite_uses_user ON workspace_invite_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invite_uses_used_at ON workspace_invite_uses(used_at);
