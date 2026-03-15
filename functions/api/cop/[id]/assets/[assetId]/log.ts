/**
 * COP Asset Audit Log API
 *
 * GET /api/cop/:id/assets/:assetId/log
 *
 * Returns the status change audit trail for a specific asset,
 * ordered by created_at DESC.
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
  const assetId = params.assetId as string

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
  }
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
  }

  try {
    // Verify asset exists in this session
    const existing = await env.DB.prepare(
      'SELECT id FROM cop_assets WHERE id = ? AND cop_session_id = ?'
    ).bind(assetId, sessionId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Asset not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const rows = await env.DB.prepare(
      'SELECT * FROM cop_asset_log WHERE asset_id = ? AND cop_session_id = ? ORDER BY created_at DESC'
    ).bind(assetId, sessionId).all()

    return new Response(JSON.stringify({ log: rows.results || [] }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[COP Asset Log] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch asset log' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
