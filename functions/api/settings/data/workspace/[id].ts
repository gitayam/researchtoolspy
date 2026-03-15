/**
 * Workspace Data Management API
 *
 * DELETE: Clear all data in a workspace
 */

import { requireAuth } from '../../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../../_shared/api-utils'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

/**
 * DELETE /api/settings/data/workspace/[id]
 * Clear all data in workspace (entities, frameworks, evidence, analyses, etc.)
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)

    const workspaceId = context.params.id as string
    if (!workspaceId) {
      return Response.json({ error: 'Workspace ID required' }, { status: 400, headers: JSON_HEADERS })
    }

    // Verify workspace ownership via owner_id
    const workspace = await context.env.DB.prepare(
      'SELECT id, owner_id FROM workspaces WHERE id = ? AND owner_id = ?'
    )
      .bind(workspaceId, userId)
      .first()

    if (!workspace) {
      return Response.json({ error: 'Workspace not found or access denied' }, { status: 404, headers: JSON_HEADERS })
    }

    // Delete all data associated with this workspace
    const deletedCounts: Record<string, number> = {}

    // Entity tables
    const entityTables = ['actors', 'sources', 'events', 'places', 'behaviors']
    for (const table of entityTables) {
      try {
        const result = await context.env.DB.prepare(`DELETE FROM ${table} WHERE workspace_id = ?`)
          .bind(workspaceId)
          .run()
        deletedCounts[table] = result.meta?.changes || 0
      } catch {
        deletedCounts[table] = 0
      }
    }

    // Framework sessions (correct table name)
    try {
      const result = await context.env.DB.prepare('DELETE FROM framework_sessions WHERE workspace_id = ?')
        .bind(workspaceId)
        .run()
      deletedCounts.framework_sessions = result.meta?.changes || 0
    } catch {
      deletedCounts.framework_sessions = 0
    }

    // Evidence items (correct table name)
    try {
      const result = await context.env.DB.prepare('DELETE FROM evidence_items WHERE workspace_id = ?')
        .bind(workspaceId)
        .run()
      deletedCounts.evidence_items = result.meta?.changes || 0
    } catch {
      deletedCounts.evidence_items = 0
    }

    // ACH analyses
    try {
      const result = await context.env.DB.prepare('DELETE FROM ach_analyses WHERE workspace_id = ?')
        .bind(workspaceId)
        .run()
      deletedCounts.ach_analyses = result.meta?.changes || 0
    } catch {
      deletedCounts.ach_analyses = 0
    }

    // Relationships
    try {
      const result = await context.env.DB.prepare('DELETE FROM relationships WHERE workspace_id = ?')
        .bind(workspaceId)
        .run()
      deletedCounts.relationships = result.meta?.changes || 0
    } catch {
      deletedCounts.relationships = 0
    }

    return Response.json({
      success: true,
      message: 'Workspace data cleared successfully',
      deleted: deletedCounts,
      total: Object.values(deletedCounts).reduce((a, b) => a + b, 0),
    }, { headers: JSON_HEADERS })
  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('Clear workspace data error:', error)
    return Response.json(
      {
        error: 'Failed to clear workspace data',
      },
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
