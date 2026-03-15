/**
 * COP Asset Check-in API
 *
 * POST /api/cop/:id/assets/:assetId/check-in
 *
 * Updates asset status, creates audit log entry, sets last_checked_at,
 * and emits ASSET_STATUS_CHANGED event.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../../../_shared/auth-helpers'
import { emitCopEvent } from '../../../../_shared/cop-events'
import { ASSET_STATUS_CHANGED } from '../../../../_shared/cop-event-types'
import { generatePrefixedId , JSON_HEADERS } from '../../../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const assetId = params.assetId as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    if (!(await verifyCopSessionAccess(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: corsHeaders,
      })
    }
    const body = await request.json() as any
    const VALID_STATUSES = ['available', 'deployed', 'degraded', 'offline', 'compromised', 'exhausted']

    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      return new Response(JSON.stringify({ error: 'Valid status required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const existing = await env.DB.prepare(
      'SELECT * FROM cop_assets WHERE id = ? AND cop_session_id = ?'
    ).bind(assetId, sessionId).first() as any

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Asset not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const now = new Date().toISOString()

    // Update asset
    const updateResult = await env.DB.prepare(
      'UPDATE cop_assets SET status = ?, last_checked_at = ?, updated_at = ? WHERE id = ? AND cop_session_id = ?'
    ).bind(body.status, now, now, assetId, sessionId).run()

    if (!updateResult.meta.changes || updateResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Asset update failed' }), {
        status: 404, headers: corsHeaders,
      })
    }

    // Create log entry
    const logId = generatePrefixedId('alog')
    await env.DB.prepare(`
      INSERT INTO cop_asset_log (id, asset_id, cop_session_id, previous_status, new_status, changed_by, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(logId, assetId, sessionId, existing.status, body.status, userId, body.reason || null).run()

    // Emit event
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: ASSET_STATUS_CHANGED,
      entityType: 'asset',
      entityId: assetId,
      payload: {
        name: existing.name,
        asset_type: existing.asset_type,
        previous_status: existing.status,
        new_status: body.status,
        reason: body.reason || null,
      },
      createdBy: userId,
    })

    return new Response(JSON.stringify({ message: 'Asset status updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Asset Check-in] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to check in asset' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}
