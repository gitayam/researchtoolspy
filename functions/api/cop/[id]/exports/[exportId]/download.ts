/**
 * COP Export Download API - Download a previously generated export
 *
 * GET /api/cop/:id/exports/:exportId/download
 *
 * For now, returns the export metadata (since we return content directly
 * from the POST /export endpoint). In the future, this will serve
 * signed R2 URLs for large exports.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}


export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const exportId = params.exportId as string

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
  }
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
  }

  try {
    const row = await env.DB.prepare(
      `SELECT * FROM cop_exports WHERE id = ? AND cop_session_id = ?`
    ).bind(exportId, sessionId).first<any>()

    if (!row) {
      return new Response(
        JSON.stringify({ error: 'Export not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    if (row.status !== 'completed') {
      return new Response(
        JSON.stringify({
          error: 'Export not ready',
          status: row.status,
          error_message: row.error_message,
        }),
        { status: row.status === 'failed' ? 410 : 202, headers: JSON_HEADERS }
      )
    }

    // Future: return signed R2 URL
    // For now, exports are returned inline from POST /export.
    // This endpoint returns metadata so the client knows the export exists.
    let filters = {}
    try {
      filters = row.filters_json ? JSON.parse(row.filters_json) : {}
    } catch {
      filters = {}
    }

    return new Response(
      JSON.stringify({
        export: {
          ...row,
          filters_json: filters,
        },
        message: 'Export content was returned directly from the POST /export endpoint. Re-export to download again.',
      }),
      { headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('[COP Export Download] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve export' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
