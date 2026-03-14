/**
 * COP Asset Tracking API
 *
 * GET    /api/cop/:id/assets          - List assets (optional ?asset_type=human&status=available)
 * POST   /api/cop/:id/assets          - Create asset
 * PUT    /api/cop/:id/assets          - Update asset (id in body)
 * DELETE /api/cop/:id/assets?asset_id=x - Delete asset (hard delete or soft offline)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault, getUserFromRequest } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { ASSET_CREATED, ASSET_UPDATED, ASSET_STATUS_CHANGED, ASSET_QUOTA_LOW } from '../../_shared/cop-event-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `ast-${crypto.randomUUID().slice(0, 12)}`
}

const VALID_ASSET_TYPES = ['human', 'source', 'infrastructure', 'digital']
const VALID_STATUSES = ['available', 'deployed', 'degraded', 'offline', 'compromised', 'exhausted']
const VALID_SENSITIVITIES = ['unclassified', 'internal', 'restricted']

function parseDetails(row: any): any {
  if (!row) return row
  try {
    row.details = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {})
  } catch {
    row.details = {}
  }
  return row
}

// GET - List assets for a COP session
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const url = new URL(request.url)
  const typeFilter = url.searchParams.get('asset_type')
  const statusFilter = url.searchParams.get('status')

  try {
    let query = 'SELECT * FROM cop_assets WHERE cop_session_id = ?'
    const bindings: any[] = [sessionId]

    if (typeFilter && VALID_ASSET_TYPES.includes(typeFilter)) {
      query += ' AND asset_type = ?'
      bindings.push(typeFilter)
    }

    if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
      query += ' AND status = ?'
      bindings.push(statusFilter)
    }

    query += ' ORDER BY asset_type, name'

    const rows = await env.DB.prepare(query).bind(...bindings).all()
    const assets = (rows.results || []).map(parseDetails)

    return new Response(JSON.stringify({ assets }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Assets] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list assets' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// POST - Create a new asset
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    const body = await request.json() as any

    if (!body.name?.trim()) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    if (!body.asset_type || !VALID_ASSET_TYPES.includes(body.asset_type)) {
      return new Response(JSON.stringify({ error: 'Valid asset_type required (human, source, infrastructure, digital)' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Look up session workspace_id
    const session = await env.DB.prepare(
      'SELECT workspace_id FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first() as any

    const workspaceId = session?.workspace_id || request.headers.get('X-Workspace-ID') || sessionId

    const id = generateId()
    const now = new Date().toISOString()
    const status = VALID_STATUSES.includes(body.status) ? body.status : 'available'
    const sensitivity = VALID_SENSITIVITIES.includes(body.sensitivity) ? body.sensitivity : 'unclassified'
    const detailsStr = JSON.stringify(body.details || {})

    await env.DB.prepare(`
      INSERT INTO cop_assets (
        id, cop_session_id, asset_type, name, status, details,
        assigned_to_task_id, location, lat, lon, sensitivity,
        last_checked_at, notes, created_by, workspace_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, sessionId, body.asset_type, body.name.trim(), status, detailsStr,
      body.assigned_to_task_id || null,
      body.location || null,
      body.lat ?? null,
      body.lon ?? null,
      sensitivity,
      null,
      body.notes || null,
      userId, workspaceId, now, now,
    ).run()

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: ASSET_CREATED,
      entityType: 'asset',
      entityId: id,
      payload: { name: body.name, asset_type: body.asset_type, status },
      createdBy: userId,
    })

    return new Response(JSON.stringify({ id, message: 'Asset created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Assets] Create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create asset' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// PUT - Update an existing asset
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    const body = await request.json() as any

    if (!body.id) {
      return new Response(JSON.stringify({ error: 'Asset id is required in body' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Verify asset belongs to this session
    const existing = await env.DB.prepare(
      'SELECT * FROM cop_assets WHERE id = ? AND cop_session_id = ?'
    ).bind(body.id, sessionId).first() as any

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Asset not found in this session' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const now = new Date().toISOString()
    const updates: string[] = []
    const bindings: any[] = []
    let statusChanged = false

    if (body.name !== undefined) {
      updates.push('name = ?')
      bindings.push(body.name.trim())
    }
    if (body.status !== undefined && VALID_STATUSES.includes(body.status)) {
      updates.push('status = ?')
      bindings.push(body.status)
      if (body.status !== existing.status) {
        statusChanged = true
      }
    }
    if (body.details !== undefined) {
      updates.push('details = ?')
      bindings.push(JSON.stringify(body.details))
    }
    if (body.assigned_to_task_id !== undefined) {
      updates.push('assigned_to_task_id = ?')
      bindings.push(body.assigned_to_task_id || null)
    }
    if (body.location !== undefined) {
      updates.push('location = ?')
      bindings.push(body.location || null)
    }
    if (body.lat !== undefined) {
      updates.push('lat = ?')
      bindings.push(body.lat ?? null)
    }
    if (body.lon !== undefined) {
      updates.push('lon = ?')
      bindings.push(body.lon ?? null)
    }
    if (body.sensitivity !== undefined && VALID_SENSITIVITIES.includes(body.sensitivity)) {
      updates.push('sensitivity = ?')
      bindings.push(body.sensitivity)
    }
    if (body.notes !== undefined) {
      updates.push('notes = ?')
      bindings.push(body.notes || null)
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400, headers: corsHeaders,
      })
    }

    updates.push('updated_at = ?')
    bindings.push(now)
    bindings.push(body.id, sessionId)

    await env.DB.prepare(
      `UPDATE cop_assets SET ${updates.join(', ')} WHERE id = ? AND cop_session_id = ?`
    ).bind(...bindings).run()

    // Emit status change event
    if (statusChanged) {
      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: ASSET_STATUS_CHANGED,
        entityType: 'asset',
        entityId: body.id,
        payload: {
          name: existing.name,
          asset_type: existing.asset_type,
          previous_status: existing.status,
          new_status: body.status,
        },
        createdBy: userId,
      })
    } else {
      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: ASSET_UPDATED,
        entityType: 'asset',
        entityId: body.id,
        payload: { name: body.name || existing.name, asset_type: existing.asset_type },
        createdBy: userId,
      })
    }

    // Check digital asset quota
    if (existing.asset_type === 'digital') {
      const details = body.details || (typeof existing.details === 'string' ? JSON.parse(existing.details) : existing.details) || {}
      if (details.total_units > 0 && details.used_units / details.total_units > 0.8) {
        await emitCopEvent(env.DB, {
          copSessionId: sessionId,
          eventType: ASSET_QUOTA_LOW,
          entityType: 'asset',
          entityId: body.id,
          payload: {
            name: body.name || existing.name,
            used_units: details.used_units,
            total_units: details.total_units,
            pct: Math.round((details.used_units / details.total_units) * 100),
          },
          createdBy: userId,
        })
      }
    }

    return new Response(JSON.stringify({ id: body.id, message: 'Asset updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Assets] Update error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update asset' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// DELETE - Delete an asset
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)
  const assetId = url.searchParams.get('asset_id')
  const hard = url.searchParams.get('hard') === 'true'

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    if (!assetId) {
      return new Response(JSON.stringify({ error: 'asset_id query param is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const existing = await env.DB.prepare(
      'SELECT name, asset_type FROM cop_assets WHERE id = ? AND cop_session_id = ?'
    ).bind(assetId, sessionId).first() as any

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Asset not found in this session' }), {
        status: 404, headers: corsHeaders,
      })
    }

    if (hard) {
      // Hard delete: remove log entries first, then asset
      await env.DB.prepare(
        'DELETE FROM cop_asset_log WHERE asset_id = ? AND cop_session_id = ?'
      ).bind(assetId, sessionId).run()
      await env.DB.prepare(
        'DELETE FROM cop_assets WHERE id = ? AND cop_session_id = ?'
      ).bind(assetId, sessionId).run()
    } else {
      // Soft delete: set status to offline
      const now = new Date().toISOString()
      await env.DB.prepare(
        'UPDATE cop_assets SET status = ?, updated_at = ? WHERE id = ? AND cop_session_id = ?'
      ).bind('offline', now, assetId, sessionId).run()
    }

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: ASSET_STATUS_CHANGED,
      entityType: 'asset',
      entityId: assetId,
      payload: { name: existing.name, asset_type: existing.asset_type, new_status: hard ? 'deleted' : 'offline' },
      createdBy: userId,
    })

    return new Response(JSON.stringify({ message: hard ? 'Asset deleted' : 'Asset set to offline' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Assets] Delete error:', error)
    return new Response(JSON.stringify({ error: 'Failed to delete asset' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
