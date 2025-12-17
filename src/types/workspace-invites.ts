/**
 * Workspace Invites Types
 * For investigation team collaboration via secure invite links
 */

export interface WorkspaceInvite {
  id: string
  workspace_id: string
  created_by_id: number
  invite_token: string
  invite_url: string

  // Access control
  default_role: 'ADMIN' | 'EDITOR' | 'VIEWER'

  // Usage limits
  max_uses: number | null
  current_uses: number
  expires_at: string | null

  // Status
  is_active: boolean

  // Metadata
  label: string | null
  created_at: string
  revoked_at: string | null
  revoked_by_id: number | null

  // Creator info (when fetched with join)
  created_by?: {
    id: number
    username: string
    nickname: string
  }
}

export interface CreateWorkspaceInviteRequest {
  default_role: 'ADMIN' | 'EDITOR' | 'VIEWER'
  max_uses?: number | null
  expires_in_hours?: number | null
  label?: string | null
}

export interface WorkspaceInviteInfo {
  workspace: {
    id: string
    name: string
    type: 'PERSONAL' | 'TEAM' | 'PUBLIC'
    owner_nickname: string
  }
  invite: {
    default_role: 'ADMIN' | 'EDITOR' | 'VIEWER'
    expires_at: string | null
    label: string | null
    is_valid: boolean
    uses_remaining: number | null
    is_expired?: boolean
    is_max_uses_reached?: boolean
  }
}

export interface AcceptInviteRequest {
  nickname: string
}

export interface AcceptInviteResponse {
  workspace_id: string
  member_id: string
  role: 'ADMIN' | 'EDITOR' | 'VIEWER'
  nickname: string
  joined_at: string
}

export interface WorkspaceInviteUse {
  id: string
  invite_id: string
  user_id: number
  workspace_member_id: string
  nickname_used: string
  used_at: string
  ip_address: string | null
  user_agent: string | null
}

// Extended workspace member with nickname
export interface WorkspaceMemberWithNickname {
  id: string
  workspace_id: string
  user_id: number
  role: 'ADMIN' | 'EDITOR' | 'VIEWER'
  nickname: string | null
  joined_via_invite_id: string | null
  joined_at: string

  // User info (when fetched with join)
  username?: string
  full_name?: string
  email?: string
}
