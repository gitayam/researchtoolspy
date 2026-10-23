/**
 * COP webcams
 *
 * GET  /api/cop/:id/webcams - The session's webcams (owner, collaborators, or any
 *                             signed-in user on a public session)
 * POST /api/cop/:id/webcams - Add a webcam (owner, editor or admin collaborator)
 *
 * A webcam is a link to the provider's own player or feed: a Windy or YouTube id,
 * or an allow-listed image/HLS URL (functions/api/_shared/webcam-url.ts). The embed
 * URL is derived on read; the browser loads the provider directly.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { copCallerUserId } from '../../_shared/cop-caller'
import {
  listSessionWebcams,
  mayEditCopSession,
  MAX_WEBCAMS_PER_SESSION,
  publicWebcam,
  validateWebcamInput,
  WEBCAM_COLUMNS,
  webcamsTableMissing,
  webcamsUnavailable,
  type WebcamRow,
} from '../../_shared/cop-webcams'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  COP_WEBCAM_EXTRA_HOSTS?: string
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  const userId = await copCallerUserId(context)
  if (!userId) return json({ error: 'Authentication required' }, 401)
  if (!(await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true }))) {
    return json({ error: 'Access denied' }, 403)
  }

  try {
    const rows = await listSessionWebcams(env.DB, sessionId)
    return json({ webcams: rows.map(publicWebcam) })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/webcams',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return json({ error: 'Failed to list webcams' }, 500)
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  const userId = await copCallerUserId(context)
  if (!userId) return json({ error: 'Authentication required' }, 401)
  if (!(await mayEditCopSession(env.DB, sessionId, userId))) {
    return json({ error: 'Only the session owner or an editor can add webcams' }, 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Expected a JSON body' }, 400)
  }
  const input = validateWebcamInput(body, env.COP_WEBCAM_EXTRA_HOSTS)
  if (!input.ok) return json({ error: input.error }, 400)
  const cam = input.value

  try {
    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM cop_webcams WHERE cop_session_id = ? AND archived_at IS NULL'
    ).bind(sessionId).first<{ n: number }>()
    if (Number(count?.n ?? 0) >= MAX_WEBCAMS_PER_SESSION) {
      return json({ error: `A session holds at most ${MAX_WEBCAMS_PER_SESSION} webcams` }, 409)
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await env.DB.prepare(`
      INSERT INTO cop_webcams (id, cop_session_id, provider, provider_ref, page_url, image_url, stream_url,
        label, lat, lon, bearing_deg, fov_deg, delivery, refresh_s, attribution, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, sessionId, cam.provider, cam.provider_ref, cam.page_url, cam.image_url, cam.stream_url,
      cam.label, cam.lat, cam.lon, cam.bearing_deg, cam.fov_deg, cam.delivery, cam.refresh_s, cam.attribution,
      userId, now,
    ).run()

    const row = await env.DB.prepare(`SELECT ${WEBCAM_COLUMNS} FROM cop_webcams WHERE id = ? AND cop_session_id = ?`)
      .bind(id, sessionId).first<WebcamRow>()
    return json({ webcam: row ? publicWebcam(row) : null }, 201)
  } catch (error) {
    if (webcamsTableMissing(error)) return webcamsUnavailable()
    await logEvent(env, {
      level: 'error',
      source: 'cop/webcams',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return json({ error: 'Failed to add webcam' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
