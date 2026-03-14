/**
 * Workspace Frameworks API
 *
 * GET /api/workspaces/:id/frameworks — List framework sessions in workspace
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'
import { getWorkspaceMemberRole } from '../../_shared/workspace-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string
  const url = new URL(request.url)

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: jsonHeaders,
      })
    }

    const role = await getWorkspaceMemberRole(env.DB, workspaceId, userId)
    if (!role) {
      return new Response(JSON.stringify({ error: 'Not a workspace member' }), {
        status: 403, headers: jsonHeaders,
      })
    }

    const typeFilter = url.searchParams.get('type') || null
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    let whereClause = 'WHERE fs.workspace_id = ?'
    const binds: any[] = [workspaceId]

    if (typeFilter) {
      whereClause += ' AND fs.framework_type = ?'
      binds.push(typeFilter)
    }

    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM framework_sessions fs ${whereClause}`
    ).bind(...binds).first()

    const { results } = await env.DB.prepare(`
      SELECT
        fs.id, fs.title, fs.framework_type, fs.status, fs.tags,
        fs.created_at, fs.updated_at,
        u.username as created_by_username
      FROM framework_sessions fs
      LEFT JOIN users u ON fs.user_id = u.id
      ${whereClause}
      ORDER BY fs.updated_at DESC
      LIMIT ? OFFSET ?
    `).bind(...binds, limit, offset).all()

    // Parse tags JSON
    const frameworks = results.map((row: any) => ({
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
    }))

    return new Response(JSON.stringify({
      frameworks,
      total: (countResult?.total as number) || 0,
      limit,
      offset,
    }), { headers: jsonHeaders })
  } catch (error) {
    console.error('[workspace frameworks] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch frameworks' }), {
      status: 500, headers: jsonHeaders,
    })
  }
}
