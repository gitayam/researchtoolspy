/**
 * COP Export History API - List past exports for a COP session
 *
 * GET /api/cop/:id/exports
 *
 * Returns past exports ordered by created_at DESC.
 * Query params:
 *   limit  - Max results (default 50, max 200)
 *   format - Filter by format (e.g., 'geojson', 'stix')
 *   status - Filter by status (e.g., 'completed', 'failed')
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}


export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
  }
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
  }

  try {
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    const format = url.searchParams.get('format')
    const status = url.searchParams.get('status')

    let query = 'SELECT * FROM cop_exports WHERE cop_session_id = ?'
    const bindings: any[] = [sessionId]

    if (format) {
      query += ' AND format = ?'
      bindings.push(format)
    }

    if (status) {
      query += ' AND status = ?'
      bindings.push(status)
    }

    query += ' ORDER BY created_at DESC LIMIT ?'
    bindings.push(limit)

    const results = await env.DB.prepare(query).bind(...bindings).all()

    // Parse filters_json for each export
    const exports = (results.results || []).map((row: any) => {
      let filters = {}
      try {
        filters = row.filters_json ? JSON.parse(row.filters_json) : {}
      } catch {
        filters = {}
      }
      return { ...row, filters_json: filters }
    })

    return new Response(JSON.stringify({ exports }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[COP Exports] List error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to list exports' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
