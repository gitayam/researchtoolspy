/**
 * Shared Workspace Authorization Helpers
 *
 * Central workspace access logic used by all entity endpoints.
 * Handles default workspace, COP session workspaces, ownership,
 * membership roles, and public workspace fallback.
 */

/**
 * Check if a user has access to a workspace.
 *
 * Access rules (checked in order):
 * 1. Default workspace "1" → auto-grant for all authenticated users
 * 2. COP session workspaces (cop-*) → grant if session exists
 * 3. Workspace owner → full access
 * 4. Workspace member → role-gated access
 * 5. Public workspace → read-only (VIEWER) access
 *
 * Used by: actors, sources, events, places, behaviors, relationships, credibility
 */
export async function checkWorkspaceAccess(
  workspaceId: string,
  userId: number,
  env: { DB: D1Database },
  requiredRole?: 'ADMIN' | 'EDITOR' | 'VIEWER'
): Promise<boolean> {
  // Default workspace "1" — auto-grant for all authenticated users
  if (workspaceId === '1') return true

  // COP session workspaces — verify user owns or collaborates on the session
  if (workspaceId.startsWith('cop-')) {
    const session = await env.DB.prepare(
      'SELECT id, created_by FROM cop_sessions WHERE workspace_id = ?'
    ).bind(workspaceId).first<{ id: string; created_by: number }>()
    if (!session) return false
    if (String(session.created_by) === String(userId)) return true
    const collab = await env.DB.prepare(
      'SELECT 1 FROM cop_collaborators WHERE cop_session_id = ? AND user_id = ?'
    ).bind(session.id, userId).first()
    return !!collab
  }

  const workspace = await env.DB.prepare(
    `SELECT owner_id, is_public FROM workspaces WHERE id = ?`
  ).bind(workspaceId).first()

  if (!workspace) return false

  // Owner has full access
  if (String(workspace.owner_id) === String(userId)) return true

  // Check member access with role gating
  const member = await env.DB.prepare(
    `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
  ).bind(workspaceId, userId).first()

  if (member) {
    if (!requiredRole) return true
    if (requiredRole === 'VIEWER') return true
    if (requiredRole === 'EDITOR' && (member.role === 'EDITOR' || member.role === 'ADMIN')) return true
    if (requiredRole === 'ADMIN' && member.role === 'ADMIN') return true
  }

  // Public workspaces allow read access
  if (workspace.is_public && (!requiredRole || requiredRole === 'VIEWER')) {
    return true
  }

  return false
}

/**
 * Check if user can manage a workspace (owner or ADMIN member)
 *
 * Used by invite management, member management, and workspace settings.
 */
export async function canManageWorkspace(
  db: D1Database,
  workspaceId: string,
  userId: number
): Promise<boolean> {
  const workspace = await db.prepare(
    `SELECT owner_id FROM workspaces WHERE id = ?`
  ).bind(workspaceId).first()
  if (!workspace) return false
  if (String(workspace.owner_id) === String(userId)) return true

  const member = await db.prepare(
    `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
  ).bind(workspaceId, userId).first()
  return member?.role === 'ADMIN'
}

/**
 * Get effective role for a user in a workspace.
 * Returns 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | null.
 * Owner always gets 'OWNER' even if not in workspace_members.
 */
export async function getWorkspaceMemberRole(
  db: D1Database,
  workspaceId: string,
  userId: number
): Promise<'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | null> {
  const workspace = await db.prepare(
    `SELECT owner_id FROM workspaces WHERE id = ?`
  ).bind(workspaceId).first()
  if (!workspace) return null
  if (String(workspace.owner_id) === String(userId)) return 'OWNER'

  const member = await db.prepare(
    `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
  ).bind(workspaceId, userId).first() as { role: string } | null
  return (member?.role as 'ADMIN' | 'EDITOR' | 'VIEWER') || null
}
