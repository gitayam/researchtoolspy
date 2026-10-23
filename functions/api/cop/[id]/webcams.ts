/**
 * COP webcams
 *
 * GET  /api/cop/:id/webcams - The session's webcams (owner, collaborators, or any
 *                             signed-in user on a public session). Windy cameras
 *                             whose status is over 6 h old are re-checked in the
 *                             background (at most once per session per 10 min).
 * POST /api/cop/:id/webcams - Add a webcam (owner, editor or admin collaborator).
 *                             400 WEBCAM_INVALID / WEBCAM_UNSUPPORTED_LINK (a page,
 *                             not a camera); 422 WEBCAM_NOT_FOUND / WEBCAM_UNAVAILABLE
 *                             (Windy says so); 409 WEBCAM_DUPLICATE / WEBCAM_LIMIT.
 *
 * A webcam is a link to the provider's own player or feed: a Windy or YouTube id,
 * or an allow-listed image/HLS URL (functions/api/_shared/webcam-url.ts). The embed
 * URL is derived on read; the browser loads the provider directly. A Windy camera
 * takes its position (when none is given), title, live player and status from Windy
 * when WINDY_WEBCAMS_API_KEY is set (functions/api/_shared/webcam-enrich.ts).
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { copCallerUserId, copServiceCaller } from '../../_shared/cop-caller'
import {
  getSessionWebcam,
  insertWebcam,
  listSessionWebcams,
  mayEditCopSession,
  MAX_WEBCAMS_PER_SESSION,
  publicWebcam,
  validateWebcamInput,
  WEBCAM_DUPLICATE,
  WEBCAM_LIMIT,
  webcamDuplicate,
  webcamsTableMissing,
  webcamsUnavailable,
} from '../../_shared/cop-webcams'
import { claimStatusRefresh, enrichWebcamInput, refreshWindyStatuses, staleWindyCameras } from '../../_shared/webcam-enrich'
import { windyKeyConfigured } from '../../_shared/windy-webcams'
import { spendCaller, WEBCAM_INVALID } from '../../_shared/webcam-discovery'
import type { KvLike } from '../../_shared/kv-json'
import { emitCopEvent } from '../../_shared/cop-events'
import { SESSION_UPDATED, WEBCAM_CREATED, WEBCAM_UPDATED } from '../../_shared/cop-event-types'

/**
 * Switch the session's webcams map layer on, so the first camera shows on the map
 * without anyone finding the layer toggle. Does nothing when it is already on.
 */
async function ensureWebcamsLayer(db: D1Database, sessionId: string, userId: number): Promise<void> {
  const result = await db.prepare(`
    UPDATE cop_sessions
    SET active_layers = json_insert(CASE WHEN json_valid(active_layers) THEN active_layers ELSE '[]' END, '$[#]', 'webcams'),
        updated_at = ?
    WHERE id = ?
      AND NOT EXISTS (
        SELECT 1 FROM json_each(CASE WHEN json_valid(active_layers) THEN active_layers ELSE '[]' END)
        WHERE value = 'webcams'
      )
  `).bind(new Date().toISOString(), sessionId).run()
  if (result.meta?.changes) {
    await emitCopEvent(db, {
      copSessionId: sessionId,
      eventType: SESSION_UPDATED,
      entityType: 'session',
      entityId: sessionId,
      payload: { active_layers: 'webcams' },
      createdBy: userId,
    })
  }
}

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  CACHE?: KvLike
  COP_WEBCAM_EXTRA_HOSTS?: string
  WINDY_WEBCAMS_API_KEY?: string
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
    const stale = staleWindyCameras(rows)
    if (stale.length > 0 && windyKeyConfigured(env) && (await claimStatusRefresh(env.CACHE, sessionId))) {
      // The stored status is answered now; the refreshed one shows on the next load.
      context.waitUntil(refreshWindyStatuses(env, sessionId, stale).then(async (changed) => {
        // Open COPs refetch the cams panel when a status actually moved.
        if (changed > 0) {
          await emitCopEvent(env.DB, { copSessionId: sessionId, eventType: WEBCAM_UPDATED, entityType: 'webcam', payload: { refreshed: changed }, createdBy: userId })
        }
      }).catch((error) => logEvent(env, {
        level: 'warn',
        source: 'cop/webcams',
        message: `Windy status refresh failed: ${String(error instanceof Error ? error.message : error)}`.slice(0, 500),
      })))
    }
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
    return json({ error: 'Expected a JSON body', code: WEBCAM_INVALID }, 400)
  }
  const input = validateWebcamInput(body, env.COP_WEBCAM_EXTRA_HOSTS)
  if (!input.ok) return json({ error: input.error, code: input.code }, 400)

  const now = new Date().toISOString()
  const caller = spendCaller(request, userId, copServiceCaller(context.data))
  const enriched = await enrichWebcamInput(env, input.value, now, caller, (message) => logEvent(env, {
    level: 'warn',
    source: 'cop/webcams',
    message: message.slice(0, 500),
  }))
  if (!enriched.ok) return json({ error: enriched.error, code: enriched.code }, enriched.status)
  const cam = enriched.cam

  try {
    const id = crypto.randomUUID()
    if (!(await insertWebcam(env.DB, id, sessionId, cam, userId, now))) {
      return json({ error: `A session holds at most ${MAX_WEBCAMS_PER_SESSION} webcams`, code: WEBCAM_LIMIT }, 409)
    }
    const row = await getSessionWebcam(env.DB, sessionId, id)
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: WEBCAM_CREATED,
      entityType: 'webcam',
      entityId: id,
      createdBy: userId,
    })
    try {
      await ensureWebcamsLayer(env.DB, sessionId, userId)
    } catch (error) {
      await logEvent(env, { level: 'warn', source: 'cop/webcams', message: `webcams layer not switched on: ${String(error).slice(0, 300)}` })
    }
    return json({ webcam: row ? publicWebcam(row) : null }, 201)
  } catch (error) {
    if (webcamsTableMissing(error)) return webcamsUnavailable()
    if (webcamDuplicate(error)) {
      return json({ error: 'That camera is already on this session', code: WEBCAM_DUPLICATE }, 409)
    }
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
