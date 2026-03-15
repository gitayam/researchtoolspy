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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const assetId = params.assetId as string

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: corsHeaders })
  }
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders })
  }

  try {
    // Verify asset exists in this session
    const existing = await env.DB.prepare(
      'SELECT id FROM cop_assets WHERE id = ? AND cop_session_id = ?'
    ).bind(assetId, sessionId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Asset not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const rows = await env.DB.prepare(
      'SELECT * FROM cop_asset_log WHERE asset_id = ? AND cop_session_id = ? ORDER BY created_at DESC'
    ).bind(assetId, sessionId).all()

    return new Response(JSON.stringify({ log: rows.results || [] }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Asset Log] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch asset log' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
