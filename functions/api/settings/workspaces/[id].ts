/**
 * Individual Workspace API
 *
 * PUT: Update workspace
 * DELETE: Delete workspace
 */

import { requireAuth } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

/**
 * PUT /api/settings/workspaces/[id]
 * Update workspace details
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)

    const workspaceId = context.params.id as string
    if (!workspaceId) {
      return Response.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    const body = (await context.request.json()) as {
      name?: string
      description?: string
    }

    if (!body.name && !body.description) {
      return Response.json({ error: 'At least one field to update is required' }, { status: 400 })
    }

    // Verify ownership
    const workspace = await context.env.DB.prepare(
      'SELECT id, owner_id FROM workspaces WHERE id = ? AND owner_id = ?'
    )
      .bind(workspaceId, userId)
      .first()

    if (!workspace) {
      return Response.json({ error: 'Workspace not found or access denied' }, { status: 404 })
    }

    // Build update query
    const updates: string[] = []
    const bindings: any[] = []

    if (body.name) {
      updates.push('name = ?')
      bindings.push(body.name)
    }

    if (body.description !== undefined) {
      updates.push('description = ?')
      bindings.push(body.description)
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')

    // Add WHERE clause bindings
    bindings.push(workspaceId, userId)

    await context.env.DB.prepare(
      `UPDATE workspaces SET ${updates.join(', ')} WHERE id = ? AND owner_id = ?`
    )
      .bind(...bindings)
      .run()

    // Fetch updated workspace
    const updated = await context.env.DB.prepare(
      'SELECT id, name, description, type, is_public, created_at, updated_at FROM workspaces WHERE id = ?'
    )
      .bind(workspaceId)
      .first()

    if (!updated) {
      return Response.json({ success: true, id: workspaceId })
    }
    return Response.json(updated)
  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('Workspace PUT error:', error)
    return Response.json(
      {
        error: 'Failed to update workspace',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/workspaces/[id]
 * Delete workspace
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)

    const workspaceId = context.params.id as string
    if (!workspaceId) {
      return Response.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Verify ownership
    const workspace = await context.env.DB.prepare(
      'SELECT id, owner_id FROM workspaces WHERE id = ? AND owner_id = ?'
    )
      .bind(workspaceId, userId)
      .first()

    if (!workspace) {
      return Response.json({ error: 'Workspace not found or access denied' }, { status: 404 })
    }

    // Cascade delete related data, then workspace itself
    await context.env.DB.batch([
      context.env.DB.prepare('DELETE FROM workspace_invites WHERE workspace_id = ?').bind(workspaceId),
      context.env.DB.prepare('DELETE FROM workspace_members WHERE workspace_id = ?').bind(workspaceId),
      context.env.DB.prepare('DELETE FROM actors WHERE workspace_id = ?').bind(workspaceId),
      context.env.DB.prepare('DELETE FROM sources WHERE workspace_id = ?').bind(workspaceId),
      context.env.DB.prepare('DELETE FROM events WHERE workspace_id = ?').bind(workspaceId),
      context.env.DB.prepare('DELETE FROM places WHERE workspace_id = ?').bind(workspaceId),
      context.env.DB.prepare('DELETE FROM behaviors WHERE workspace_id = ?').bind(workspaceId),
      context.env.DB.prepare('DELETE FROM relationships WHERE workspace_id = ?').bind(workspaceId),
      context.env.DB.prepare('DELETE FROM evidence_items WHERE workspace_id = ?').bind(workspaceId),
      context.env.DB.prepare('DELETE FROM framework_sessions WHERE workspace_id = ?').bind(workspaceId),
      context.env.DB.prepare('DELETE FROM ach_analyses WHERE workspace_id = ?').bind(workspaceId),
      context.env.DB.prepare('DELETE FROM workspaces WHERE id = ? AND owner_id = ?').bind(workspaceId, userId),
    ])

    return Response.json({
      success: true,
      message: 'Workspace deleted successfully',
    })
  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('Workspace DELETE error:', error)
    return Response.json(
      {
        error: 'Failed to delete workspace',
      },
      { status: 500 }
    )
  }
}
