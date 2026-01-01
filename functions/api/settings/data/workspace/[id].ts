/**
 * Workspace Data Management API
 *
 * DELETE: Clear all data in a workspace
 */

import { requireAuth } from '../../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

/**
 * Helper to get user hash from authenticated user ID
 */
async function getUserHashFromId(db: D1Database, userId: number): Promise<string | null> {
  const user = await db.prepare('SELECT user_hash FROM users WHERE id = ?').bind(userId).first()
  return user?.user_hash as string | null
}

/**
 * DELETE /api/settings/data/workspace/[id]
 * Clear all data in workspace
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)
    const userHash = await getUserHashFromId(context.env.DB, userId)

    if (!userHash) {
      return Response.json({ error: 'User hash not found' }, { status: 404 })
    }

    const workspaceId = context.params.id as string
    if (!workspaceId) {
      return Response.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Prevent deletion of default workspace data
    if (workspaceId === '1') {
      return Response.json({ error: 'Cannot clear default workspace data' }, { status: 400 })
    }

    // Verify workspace ownership
    const workspace = await context.env.DB.prepare(
      'SELECT id, user_hash FROM workspaces WHERE id = ? AND user_hash = ?'
    )
      .bind(workspaceId, userHash)
      .first()

    if (!workspace) {
      return Response.json({ error: 'Workspace not found or access denied' }, { status: 404 })
    }

    // Delete all data associated with this workspace
    const deletedCounts: Record<string, number> = {}

    // Delete frameworks (if table exists)
    try {
      const result = await context.env.DB.prepare('DELETE FROM frameworks WHERE workspace_id = ?')
        .bind(workspaceId)
        .run()
      deletedCounts.frameworks = result.meta?.changes || 0
    } catch {
      deletedCounts.frameworks = 0
    }

    // Delete evidence (if table exists)
    try {
      const result = await context.env.DB.prepare('DELETE FROM evidence WHERE workspace_id = ?')
        .bind(workspaceId)
        .run()
      deletedCounts.evidence = result.meta?.changes || 0
    } catch {
      deletedCounts.evidence = 0
    }

    // Delete ACH analyses (if table exists)
    try {
      const result = await context.env.DB.prepare('DELETE FROM ach_analyses WHERE workspace_id = ?')
        .bind(workspaceId)
        .run()
      deletedCounts.ach_analyses = result.meta?.changes || 0
    } catch {
      deletedCounts.ach_analyses = 0
    }

    // Delete comments (if table exists)
    try {
      const result = await context.env.DB.prepare(
        `DELETE FROM comments WHERE workspace_id = ?`
      )
        .bind(workspaceId)
        .run()
      deletedCounts.comments = result.meta?.changes || 0
    } catch {
      deletedCounts.comments = 0
    }

    // Log the clear operation
    try {
      await context.env.DB.prepare(
        `INSERT INTO settings_audit_log (user_hash, category, setting_key, new_value, changed_at)
         VALUES (?, 'data', 'workspace_cleared', ?, CURRENT_TIMESTAMP)`
      )
        .bind(userHash, JSON.stringify({ workspace_id: workspaceId, deleted: deletedCounts }))
        .run()
    } catch {
      // Audit log table might not exist - continue anyway
    }

    return Response.json({
      success: true,
      message: 'Workspace data cleared successfully',
      deleted: deletedCounts,
      total: Object.values(deletedCounts).reduce((a, b) => a + b, 0),
    })
  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('Clear workspace data error:', error)
    return Response.json(
      {
        error: 'Failed to clear workspace data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
