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
    // Order: child tables first, then parent tables (ACH children cascade automatically)
    const deletedCounts: Record<string, number> = {}
    const errors: string[] = []

    const tablesToClear = [
      // Comments and related (must go before entities they reference)
      'comment_notifications',
      'comment_mentions',
      'comments',
      // Content intelligence
      'content_intelligence',
      // Entity tables
      'actors',
      'sources',
      'events',
      'places',
      'behaviors',
      // Relationships between entities
      'relationships',
      // Evidence (cascades to ach_evidence_links, evidence_citations)
      'evidence_items',
      // Frameworks
      'framework_sessions',
      // ACH (cascades to ach_hypotheses, ach_scores, ach_evidence_links)
      'ach_analyses',
    ]

    for (const table of tablesToClear) {
      try {
        const result = await context.env.DB.prepare(`DELETE FROM ${table} WHERE workspace_id = ?`)
          .bind(workspaceId)
          .run()
        deletedCounts[table] = result.meta?.changes || 0
      } catch (err: any) {
        // Table may not exist in this environment — log but continue
        console.warn(`[Workspace Clear] Failed to clear ${table}:`, err?.message)
        deletedCounts[table] = 0
        errors.push(`${table}: failed to clear`)
      }
    }

    return Response.json({
      success: true,
      message: 'Workspace data cleared successfully',
      deleted: deletedCounts,
      total: Object.values(deletedCounts).reduce((a, b) => a + b, 0),
      errors: errors.length > 0 ? errors : undefined,
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
