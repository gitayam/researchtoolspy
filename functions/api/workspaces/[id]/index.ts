/**
 * Single Workspace API
 *
 * GET    /api/workspaces/:id - Get workspace details
 * PUT    /api/workspaces/:id - Update workspace
 * DELETE /api/workspaces/:id - Delete workspace
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'
import { canManageWorkspace } from '../../_shared/workspace-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
}


// GET — Workspace details
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)

    const workspace = await env.DB.prepare(
      `SELECT * FROM workspaces WHERE id = ?`
    ).bind(workspaceId).first()

    if (!workspace) {
      return new Response(JSON.stringify({ error: 'Workspace not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const isOwner = String(workspace.owner_id) === String(userId)
    const isMember = userId
      ? await env.DB.prepare(
          `SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
        ).bind(workspaceId, userId).first()
      : null

    if (!isOwner && !isMember && !workspace.is_public) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({
      ...workspace,
      is_public: Boolean(workspace.is_public),
      allow_cloning: Boolean(workspace.allow_cloning),
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[workspace] Get error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get workspace' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// PUT — Update workspace
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    if (!await canManageWorkspace(env.DB, workspaceId, userId)) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    const workspace = await env.DB.prepare(
      `SELECT * FROM workspaces WHERE id = ?`
    ).bind(workspaceId).first()

    if (!workspace) {
      return new Response(JSON.stringify({ error: 'Workspace not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any
    const now = new Date().toISOString()

    await env.DB.prepare(`
      UPDATE workspaces
      SET name = ?, description = ?, is_public = ?, allow_cloning = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      body.name || workspace.name,
      body.description !== undefined ? body.description : workspace.description,
      body.is_public !== undefined ? (body.is_public ? 1 : 0) : workspace.is_public,
      body.allow_cloning !== undefined ? (body.allow_cloning ? 1 : 0) : workspace.allow_cloning,
      now,
      workspaceId
    ).run()

    const updated = await env.DB.prepare(
      `SELECT * FROM workspaces WHERE id = ?`
    ).bind(workspaceId).first()

    return new Response(JSON.stringify({
      ...updated,
      is_public: Boolean(updated!.is_public),
      allow_cloning: Boolean(updated!.allow_cloning),
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[workspace] Update error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update workspace' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// DELETE — Delete workspace
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const workspace = await env.DB.prepare(
      `SELECT owner_id FROM workspaces WHERE id = ?`
    ).bind(workspaceId).first()

    if (!workspace) {
      return new Response(JSON.stringify({ error: 'Workspace not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    if (workspace.owner_id !== userId) {
      return new Response(JSON.stringify({ error: 'Only workspace owner can delete' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Cascade delete related data before removing workspace
    // Order matters: delete leaf records first, then parent records
    await env.DB.batch([
      env.DB.prepare('DELETE FROM workspace_invites WHERE workspace_id = ?').bind(workspaceId),
      env.DB.prepare('DELETE FROM workspace_members WHERE workspace_id = ?').bind(workspaceId),
      env.DB.prepare('DELETE FROM investigation_activity WHERE investigation_id IN (SELECT id FROM investigations WHERE workspace_id = ?)').bind(workspaceId),
      env.DB.prepare('DELETE FROM investigations WHERE workspace_id = ?').bind(workspaceId),
      env.DB.prepare('DELETE FROM actors WHERE workspace_id = ?').bind(workspaceId),
      env.DB.prepare('DELETE FROM sources WHERE workspace_id = ?').bind(workspaceId),
      env.DB.prepare('DELETE FROM events WHERE workspace_id = ?').bind(workspaceId),
      env.DB.prepare('DELETE FROM places WHERE workspace_id = ?').bind(workspaceId),
      env.DB.prepare('DELETE FROM behaviors WHERE workspace_id = ?').bind(workspaceId),
      env.DB.prepare('DELETE FROM relationships WHERE workspace_id = ?').bind(workspaceId),
      env.DB.prepare('DELETE FROM evidence_items WHERE workspace_id = ?').bind(workspaceId),
      env.DB.prepare('DELETE FROM framework_sessions WHERE workspace_id = ?').bind(workspaceId),
      env.DB.prepare('DELETE FROM ach_analyses WHERE workspace_id = ?').bind(workspaceId),
      env.DB.prepare('DELETE FROM workspaces WHERE id = ?').bind(workspaceId),
    ])

    return new Response(JSON.stringify({ message: 'Workspace deleted' }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[workspace] Delete error:', error)
    return new Response(JSON.stringify({ error: 'Failed to delete workspace' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

