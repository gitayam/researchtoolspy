/**
 * Shared Workspace Authorization Helpers
 *
 * Extracted from duplicated logic in workspace invite handlers.
 * Checks workspace ownership or ADMIN role membership.
 */

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
  if (workspace.owner_id === userId) return true

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
  if (workspace.owner_id === userId) return 'OWNER'

  const member = await db.prepare(
    `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
  ).bind(workspaceId, userId).first() as { role: string } | null
  return (member?.role as 'ADMIN' | 'EDITOR' | 'VIEWER') || null
}
