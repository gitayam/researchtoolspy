/**
 * COP Playbook Execution Log API
 *
 * GET /api/cop/:id/playbooks/:pbId/log
 *
 * Paginated execution log, ordered by created_at DESC.
 * Parses actions_taken JSON on read.
 *
 * Query params:
 *   - limit (default 50, max 200)
 *   - offset (default 0)
 *   - status (filter: success, partial, failed)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function parseActionsTaken(row: any): any {
  if (!row) return row
  try {
    row.actions_taken = typeof row.actions_taken === 'string'
      ? JSON.parse(row.actions_taken)
      : (row.actions_taken || [])
  } catch {
    row.actions_taken = []
  }
  return row
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const pbId = params.pbId as string
  const url = new URL(request.url)

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: corsHeaders })
  }
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders })
  }

  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200)
  const offset = Number(url.searchParams.get('offset') || 0)
  const statusFilter = url.searchParams.get('status')

  try {
    // Verify playbook belongs to session
    const playbook = await env.DB.prepare(
      'SELECT id FROM cop_playbooks WHERE id = ? AND cop_session_id = ?'
    ).bind(pbId, sessionId).first()

    if (!playbook) {
      return new Response(JSON.stringify({ error: 'Playbook not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    let query = 'SELECT l.*, r.name AS rule_name, r.trigger_event FROM cop_playbook_log l LEFT JOIN cop_playbook_rules r ON l.rule_id = r.id WHERE l.playbook_id = ?'
    const bindings: any[] = [pbId]

    if (statusFilter && ['success', 'partial', 'failed'].includes(statusFilter)) {
      query += ' AND l.status = ?'
      bindings.push(statusFilter)
    }

    // Count total
    const countQuery = query.replace('SELECT l.*, r.name AS rule_name, r.trigger_event', 'SELECT COUNT(*) AS total')
    const countResult = await env.DB.prepare(countQuery).bind(...bindings).first() as any
    const total = countResult?.total || 0

    query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?'
    bindings.push(limit, offset)

    const rows = await env.DB.prepare(query).bind(...bindings).all()
    const entries = (rows.results || []).map(parseActionsTaken)

    return new Response(JSON.stringify({ log: entries, total, limit, offset }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Playbook Log] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch execution log' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
