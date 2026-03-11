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

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

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

    return new Response(JSON.stringify({ exports }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Exports] List error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to list exports' }),
      { status: 500, headers: corsHeaders }
    )
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
