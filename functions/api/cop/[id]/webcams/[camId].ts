/**
 * PATCH  /api/cop/:id/webcams/:camId - Edit a webcam's label, position, bearing or field
 *                                      of view (owner, editor or admin collaborator)
 * DELETE /api/cop/:id/webcams/:camId - Remove a webcam (owner, editor or admin collaborator)
 *
 * Both are scoped to the session in the UPDATE itself, so another session's camera id
 * is simply not found. Removing archives the row (archived_at).
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { JSON_HEADERS } from '../../../_shared/api-utils'
import { logEvent } from '../../../_shared/event-log'
import { copCallerUserId } from '../../../_shared/cop-caller'
import {
  cleanText,
  getSessionWebcam,
  mayEditCopSession,
  optionalInteger,
  optionalNumber,
  publicWebcam,
  webcamColumnsMissing,
  webcamsTableMissing,
  webcamsUnavailable,
} from '../../../_shared/cop-webcams'
import { errorResponse, WEBCAM_INVALID } from '../../../_shared/webcam-discovery'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string
  const camId = params.camId as string

  const userId = await copCallerUserId(context)
  if (!userId) return json({ error: 'Authentication required' }, 401)
  if (!(await mayEditCopSession(env.DB, sessionId, userId))) {
    return json({ error: 'Only the session owner or an editor can remove webcams' }, 403)
  }

  try {
    const result = await env.DB.prepare(
      'UPDATE cop_webcams SET archived_at = ? WHERE id = ? AND cop_session_id = ? AND archived_at IS NULL'
    ).bind(new Date().toISOString(), camId, sessionId).run()
    if (!result.meta?.changes) return json({ error: 'Webcam not found' }, 404)
    return json({ ok: true })
  } catch (error) {
    if (webcamsTableMissing(error)) return webcamsUnavailable()
    await logEvent(env, {
      level: 'error',
      source: 'cop/webcams',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return json({ error: 'Failed to remove webcam' }, 500)
  }
}

type Patch = { sql: string[]; binds: unknown[]; v2sql: string[]; v2binds: unknown[] }

/** The SET clauses for a PATCH body, or an error message. Fields 0021 adds go in v2sql. */
function patchFor(body: unknown): Patch | string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Expected a JSON object.'
  const b = body as Record<string, unknown>
  const patch: Patch = { sql: [], binds: [], v2sql: [], v2binds: [] }

  if ('label' in b) {
    const label = cleanText(b.label, 120)
    if (!label) return 'label must be text of 1 to 120 characters.'
    patch.sql.push('label = ?')
    patch.binds.push(label)
  }

  if ('lat' in b || 'lon' in b) {
    const lat = optionalNumber(b.lat)
    const lon = optionalNumber(b.lon)
    if (lat === undefined || (lat !== null && Math.abs(lat) > 90)) return 'lat must be between -90 and 90.'
    if (lon === undefined || (lon !== null && Math.abs(lon) > 180)) return 'lon must be between -180 and 180.'
    if ((lat === null) !== (lon === null)) return 'Give both lat and lon, or neither (null clears both).'
    patch.sql.push('lat = ?', 'lon = ?')
    patch.binds.push(lat, lon)
    patch.v2sql.push('position_source = ?')
    patch.v2binds.push(lat === null ? null : 'user')
  }

  if ('bearing_deg' in b) {
    const bearing = optionalInteger(b.bearing_deg, 0, 359)
    if (bearing === undefined) return 'bearing_deg must be a whole number from 0 to 359, or null.'
    const source = b.bearing_source ?? 'user'
    if (source !== 'user' && source !== 'estimated') return "bearing_source must be 'user' or 'estimated'."
    patch.sql.push('bearing_deg = ?')
    patch.binds.push(bearing)
    patch.v2sql.push('bearing_source = ?')
    patch.v2binds.push(bearing === null ? null : source)
  } else if ('bearing_source' in b) {
    return 'bearing_source goes with bearing_deg.'
  }

  if ('fov_deg' in b) {
    const fov = optionalInteger(b.fov_deg, 1, 360)
    if (fov === undefined || fov === null) return 'fov_deg must be a whole number from 1 to 360.'
    patch.sql.push('fov_deg = ?')
    patch.binds.push(fov)
  }

  if (patch.sql.length === 0) return 'Nothing to change: send label, lat and lon, bearing_deg or fov_deg.'
  return patch
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const camId = params.camId as string

  const userId = await copCallerUserId(context)
  if (!userId) return json({ error: 'Authentication required' }, 401)
  if (!(await mayEditCopSession(env.DB, sessionId, userId))) {
    return json({ error: 'Only the session owner or an editor can edit webcams' }, 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, WEBCAM_INVALID, 'Expected a JSON body')
  }
  const patch = patchFor(body)
  if (typeof patch === 'string') return errorResponse(400, WEBCAM_INVALID, patch)

  const where = ' WHERE id = ? AND cop_session_id = ? AND archived_at IS NULL'
  try {
    let result
    try {
      result = await env.DB.prepare(`UPDATE cop_webcams SET ${[...patch.sql, ...patch.v2sql].join(', ')}${where}`)
        .bind(...patch.binds, ...patch.v2binds, camId, sessionId).run()
    } catch (error) {
      if (!webcamColumnsMissing(error)) throw error
      result = await env.DB.prepare(`UPDATE cop_webcams SET ${patch.sql.join(', ')}${where}`)
        .bind(...patch.binds, camId, sessionId).run()
    }
    if (!result.meta?.changes) return json({ error: 'Webcam not found' }, 404)
    const row = await getSessionWebcam(env.DB, sessionId, camId)
    return json({ webcam: row ? publicWebcam(row) : null })
  } catch (error) {
    if (webcamsTableMissing(error)) return webcamsUnavailable()
    await logEvent(env, {
      level: 'error',
      source: 'cop/webcams',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return json({ error: 'Failed to edit webcam' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
