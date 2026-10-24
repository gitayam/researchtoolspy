/**
 * COP Tactical Markers CRUD
 *
 * GET    /api/cop/:id/markers         - List all markers for a COP session
 * POST   /api/cop/:id/markers         - Create a new tactical marker. A `uid` already used in
 *                                       this session updates that marker instead (upsert,
 *                                       200 { marker, updated: true }), as CoT expects.
 * PUT    /api/cop/:id/markers         - Update marker (confidence, rationale, label, etc.)
 * DELETE /api/cop/:id/markers?id=<id> - Delete a marker (a service: only its own)
 *
 * Markers are CoT-compatible tactical points that can be placed manually
 * or programmatically on the COP map. They support stale times for
 * automatic expiration and CoT type codes for ATAK interoperability.
 *
 * Supported source_type values: MANUAL, ENTITY, ACLED, GDELT, FRAMEWORK, EVIDENCE, HYPOTHESIS,
 * PHOTO_GPS (placed by the server from a photo's GPS; source_id is its evidence item —
 * the team's only until an editor confirms it, functions/api/_shared/cop-photo-location.ts)
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { verifyCopSessionAccess, requireCopEditor } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { MARKER_CONFIRMED, MARKER_CREATED, MARKER_DELETED, MARKER_UPDATED } from '../../_shared/cop-event-types'
import { createTimelineEntry } from '../../_shared/timeline-helper'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { copCallerUserId, copServiceCaller } from '../../_shared/cop-caller'
import {
  copSourceChannel, copSourceRef, maskTipMarkerRow, serviceChangeRefused, serviceDeleteRefused, serviceMayChange, serviceMayDelete,
  setProvenance,
} from '../../_shared/cop-input'
import { teamOnlyPhotoMarker } from '../../_shared/cop-photo-location'

/** The marker fields a write answers with. */
const MARKER_COLUMNS = 'id, uid, cot_type, callsign, lat, lon, hae, label, description, icon, color, ' +
  'event_time, stale_time, source_type, source_id, confidence, rationale, created_at'

const MARKER_CONFIDENCE = ['CONFIRMED', 'PROBABLE', 'POSSIBLE', 'SUSPECTED', 'DOUBTFUL']

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}


// GET - List all markers for a COP session
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  const userId = await copCallerUserId(context)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
  }
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
  }
  // readOnly admits any signed-in reader of a public session: only the owner and
  // collaborators see unreviewed drop-form tips in full.
  const collaborator = Boolean(await verifyCopSessionAccess(env.DB, sessionId, userId))

  try {
    const rows = await env.DB.prepare(`
      SELECT * FROM cop_markers WHERE cop_session_id = ? ORDER BY event_time DESC LIMIT 500
    `).bind(sessionId).all()

    // A photo-location marker no editor has confirmed is the team's only.
    const visible = (rows.results || []).filter((row: Record<string, unknown>) => collaborator || !teamOnlyPhotoMarker(row))
    const markers = visible.map((row: any) => {
      let detail = {}
      try {
        detail = JSON.parse(row.detail || '{}')
      } catch {
        detail = {}
      }
      const marker = { ...row, detail }
      return collaborator ? marker : maskTipMarkerRow(marker)
    })

    return new Response(JSON.stringify({ markers }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/markers',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to list markers',
    }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// POST - Create a new tactical marker
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await copCallerUserId(context)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    const workspaceId = await requireCopEditor(env.DB, sessionId, userId)
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
    }
    const body = await request.json() as any

    if (body.lat == null || body.lon == null) {
      return new Response(JSON.stringify({ error: 'lat and lon are required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    if (typeof body.lat !== 'number' || body.lat < -90 || body.lat > 90) {
      return new Response(JSON.stringify({ error: 'lat must be between -90 and 90' }), { status: 400, headers: JSON_HEADERS })
    }
    if (typeof body.lon !== 'number' || body.lon < -180 || body.lon > 180) {
      return new Response(JSON.stringify({ error: 'lon must be between -180 and 180' }), { status: 400, headers: JSON_HEADERS })
    }

    const id = `mkr-${crypto.randomUUID().slice(0, 12)}`
    const uid = typeof body.uid === 'string' && body.uid.trim() ? body.uid.trim().slice(0, 200) : crypto.randomUUID()
    const now = new Date().toISOString()
    const staleMinutes = body.stale_minutes === null ? null : Math.min(Math.max(body.stale_minutes ?? 5, 1), 1440)
    const staleTime = staleMinutes === null ? null : new Date(Date.now() + staleMinutes * 60000).toISOString()

    const confidence = MARKER_CONFIDENCE.includes(body.confidence)
      ? body.confidence : 'POSSIBLE'

    // Upsert on uid: the same CoT uid in this session updates that marker. A service may
    // only move markers it created (it never takes over someone else's).
    if (typeof body.uid === 'string' && body.uid.trim()) {
      const existing = await env.DB.prepare(
        'SELECT id, created_by FROM cop_markers WHERE uid = ? AND cop_session_id = ? ORDER BY created_at ASC LIMIT 1'
      ).bind(uid, sessionId).first<{ id: string; created_by: number }>()
      if (existing) {
        const service = copServiceCaller(context.data)
        if (service && String(existing.created_by) !== String(service.principalUserId)) {
          return new Response(JSON.stringify({ error: 'That uid belongs to another marker', code: 'UID_TAKEN' }), {
            status: 409, headers: JSON_HEADERS,
          })
        }
        const sets = ['lat = ?', 'lon = ?', 'event_time = ?', 'stale_time = ?']
        const vals: unknown[] = [body.lat, body.lon, now, staleTime]
        if (body.hae !== undefined) { sets.push('hae = ?'); vals.push(Number(body.hae) || 0) }
        for (const field of ['cot_type', 'callsign', 'label', 'description', 'icon', 'color', 'rationale'] as const) {
          if (body[field] !== undefined) { sets.push(`${field} = ?`); vals.push(body[field] || null) }
        }
        if (body.detail !== undefined) { sets.push('detail = ?'); vals.push(JSON.stringify(body.detail || {})) }
        if (MARKER_CONFIDENCE.includes(body.confidence)) { sets.push('confidence = ?'); vals.push(body.confidence) }
        await env.DB.prepare(`UPDATE cop_markers SET ${sets.join(', ')} WHERE id = ? AND cop_session_id = ?`)
          .bind(...vals, existing.id, sessionId).run()
        await env.DB.prepare(`
          INSERT INTO cop_marker_changelog (
            id, marker_id, cop_session_id, action, new_value,
            rationale, created_by, created_by_name, created_at
          ) VALUES (?, ?, ?, 'updated', ?, ?, ?, ?, ?)
        `).bind(
          `mcl-${crypto.randomUUID().slice(0, 12)}`, existing.id, sessionId,
          JSON.stringify({ lat: body.lat, lon: body.lon, label: body.label ?? null }),
          body.rationale || null, userId, body.created_by_name || null, now,
        ).run()
        await emitCopEvent(env.DB, {
          copSessionId: sessionId,
          eventType: MARKER_UPDATED,
          entityType: 'marker',
          entityId: existing.id,
          payload: { lat: body.lat, lon: body.lon, upsert: true },
          createdBy: userId,
        })
        const marker = await env.DB.prepare(`SELECT ${MARKER_COLUMNS} FROM cop_markers WHERE id = ? AND cop_session_id = ?`)
          .bind(existing.id, sessionId).first()
        return new Response(JSON.stringify({ id: existing.id, uid, marker, updated: true, message: 'Marker updated' }), {
          status: 200, headers: JSON_HEADERS,
        })
      }
    }

    await env.DB.prepare(`
      INSERT INTO cop_markers (
        id, cop_session_id, uid, cot_type, callsign,
        lat, lon, hae, label, description, icon, color, detail,
        event_time, stale_time, source_type, source_id,
        workspace_id, created_by, created_at, confidence, rationale
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, sessionId, uid,
      body.cot_type || 'a-u-G',
      body.callsign || null,
      body.lat, body.lon, body.hae ?? 0,
      body.label || null,
      body.description || null,
      body.icon || null,
      body.color || null,
      JSON.stringify(body.detail || {}),
      now, staleTime,
      body.source_type || 'MANUAL',
      body.source_id || null,
      workspaceId, userId, now,
      confidence,
      body.rationale || null,
    ).run()
    await setProvenance(env.DB, 'cop_markers', id, copSourceChannel(context), copSourceRef(context))

    // Insert changelog entry for marker creation
    const changelogId = `mcl-${crypto.randomUUID().slice(0, 12)}`
    await env.DB.prepare(`
      INSERT INTO cop_marker_changelog (
        id, marker_id, cop_session_id, action, new_value,
        rationale, created_by, created_by_name, created_at
      ) VALUES (?, ?, ?, 'created', ?, ?, ?, ?, ?)
    `).bind(
      changelogId, id, sessionId,
      JSON.stringify({ lat: body.lat, lon: body.lon, label: body.label || null, confidence }),
      body.rationale || null,
      userId,
      body.created_by_name || null,
      now,
    ).run()

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: MARKER_CREATED,
      entityType: 'marker',
      entityId: id,
      payload: { label: body.label || null, lat: body.lat, lon: body.lon, cot_type: body.cot_type || 'a-u-G', source_type: body.source_type || 'MANUAL' },
      createdBy: userId,
    })

    try {
      await createTimelineEntry(env.DB, sessionId, workspaceId, userId, {
        title: `Location marked: ${body.label?.substring(0, 160) || body.title?.substring(0, 160) || 'Unnamed pin'}`,
        category: 'event',
        importance: 'low',
        source_type: 'system',
        entity_type: 'marker',
        entity_id: id,
        action: 'created',
      })
    } catch (e) { await logEvent(env, { level: 'error', source: 'cop/markers', message: String(e instanceof Error ? e.message : e).slice(0, 500), context: { error: String(e) } }) }

    const marker = await env.DB.prepare(`SELECT ${MARKER_COLUMNS} FROM cop_markers WHERE id = ? AND cop_session_id = ?`)
      .bind(id, sessionId).first()
    return new Response(JSON.stringify({ id, uid, marker, message: 'Marker created' }), {
      status: 201, headers: JSON_HEADERS,
    })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/markers',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to create marker',
    }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// PUT - Update a marker's confidence, rationale, label, description, etc.
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await copCallerUserId(context)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    const putWorkspaceId = await requireCopEditor(env.DB, sessionId, userId)
    if (!putWorkspaceId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
    }
    const body = await request.json() as any

    if (!body.id) {
      return new Response(JSON.stringify({ error: 'id is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // A service (the Signal bot) may change only the markers it created.
    if (copServiceCaller(context.data)) {
      const own = await env.DB.prepare('SELECT created_by FROM cop_markers WHERE id = ? AND cop_session_id = ?')
        .bind(body.id, sessionId).first<{ created_by: number | null }>()
      if (!own) {
        return new Response(JSON.stringify({ error: 'Marker not found in this session' }), { status: 404, headers: JSON_HEADERS })
      }
      if (!serviceMayChange(context, own.created_by)) return serviceChangeRefused()
    }

    // Build SET clause dynamically from allowed fields
    const allowed: Record<string, any> = {}
    if (body.confidence && ['CONFIRMED', 'PROBABLE', 'POSSIBLE', 'SUSPECTED', 'DOUBTFUL'].includes(body.confidence)) {
      allowed.confidence = body.confidence
    }
    if (body.rationale !== undefined) allowed.rationale = body.rationale || null
    if (body.label !== undefined) allowed.label = body.label || null
    if (body.description !== undefined) allowed.description = body.description || null
    if (body.lat != null && typeof body.lat === 'number') allowed.lat = body.lat
    if (body.lon != null && typeof body.lon === 'number') allowed.lon = body.lon

    if (Object.keys(allowed).length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Confirming is its own event (the chat feed says "confirmed"), once per confirmation.
    let wasConfirmed = false
    if (allowed.confidence === 'CONFIRMED') {
      const before = await env.DB.prepare('SELECT confidence FROM cop_markers WHERE id = ? AND cop_session_id = ?')
        .bind(body.id, sessionId).first<{ confidence: string | null }>()
      wasConfirmed = before?.confidence === 'CONFIRMED'
    }

    const setClauses = Object.keys(allowed).map(k => `${k} = ?`).join(', ')
    const values = Object.values(allowed)

    const updateResult = await env.DB.prepare(
      `UPDATE cop_markers SET ${setClauses} WHERE id = ? AND cop_session_id = ?`
    ).bind(...values, body.id, sessionId).run()

    if (!updateResult.meta.changes || updateResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Marker not found in this session' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    // Log changelog entry
    const changelogId = `mcl-${crypto.randomUUID().slice(0, 12)}`
    const now = new Date().toISOString()
    await env.DB.prepare(`
      INSERT INTO cop_marker_changelog (
        id, marker_id, cop_session_id, action, new_value,
        rationale, created_by, created_by_name, created_at
      ) VALUES (?, ?, ?, 'updated', ?, ?, ?, ?, ?)
    `).bind(
      changelogId, body.id, sessionId,
      JSON.stringify(allowed),
      body.rationale || null,
      userId,
      body.updated_by_name || null,
      now,
    ).run()

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: MARKER_UPDATED,
      entityType: 'marker',
      entityId: body.id,
      payload: allowed,
      createdBy: userId,
    })
    if (allowed.confidence === 'CONFIRMED' && !wasConfirmed) {
      await emitCopEvent(env.DB, {
        copSessionId: sessionId, eventType: MARKER_CONFIRMED, entityType: 'marker', entityId: body.id, createdBy: userId,
      })
    }

    return new Response(JSON.stringify({ id: body.id, message: 'Marker updated' }), {
      headers: JSON_HEADERS,
    })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/markers',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to update marker',
    }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// OPTIONS - CORS preflight
// DELETE - Remove a marker and its changelog (a service: only markers it created)
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await copCallerUserId(context)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
    }
    if (!(await requireCopEditor(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
    }
    const markerQuery = new URL(request.url).searchParams
    const markerId = markerQuery.get('id') ?? markerQuery.get('marker_id')
    if (!markerId) {
      return new Response(JSON.stringify({ error: 'id query parameter is required' }), { status: 400, headers: JSON_HEADERS })
    }
    const existing = await env.DB.prepare('SELECT id, created_by FROM cop_markers WHERE id = ? AND cop_session_id = ?')
      .bind(markerId, sessionId).first<{ id: string; created_by: number }>()
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Marker not found' }), { status: 404, headers: JSON_HEADERS })
    }
    if (!serviceMayDelete(context, existing.created_by)) return serviceDeleteRefused()

    await env.DB.prepare('DELETE FROM cop_marker_changelog WHERE marker_id = ? AND cop_session_id = ?')
      .bind(markerId, sessionId).run()
    await env.DB.prepare('UPDATE cop_tasks SET linked_marker_id = NULL WHERE linked_marker_id = ? AND cop_session_id = ?')
      .bind(markerId, sessionId).run()
    const result = await env.DB.prepare('DELETE FROM cop_markers WHERE id = ? AND cop_session_id = ?')
      .bind(markerId, sessionId).run()
    if (!result.meta?.changes) {
      return new Response(JSON.stringify({ error: 'Marker not found' }), { status: 404, headers: JSON_HEADERS })
    }
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: MARKER_DELETED,
      entityType: 'marker',
      entityId: markerId,
      createdBy: userId,
    })
    return new Response(JSON.stringify({ message: 'Marker deleted' }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/markers',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({ error: 'Failed to delete marker' }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
