/**
 * GET /api/cop/:id/webcams/nearby - Windy webcams around a point, a place, or the
 * session's map center (owner, editor or admin collaborator; the Signal bot through
 * COP_SERVICE_ROUTES).
 *
 * Query (one center): lat & lon | place (≤120 chars) | from_url (a page that is not a
 * camera, ≤500) | nothing (the session's center_lat/center_lon); radius_km 1..50
 * (default 5); limit 1..50 (default 20).
 *
 * `place` is geocoded, and only an ambiguous result goes to the model, which rewrites
 * the text into one geocoder query (functions/api/_shared/webcam-discovery.ts).
 * `from_url` is never fetched: the model reads its host and path. Coordinates always
 * come from the geocoder. Each caller gets 20 searches per 10 minutes.
 *
 * Errors carry `code`: WEBCAM_INVALID, WEBCAM_NO_CENTER (400); PLACE_NOT_FOUND (422);
 * RATE_LIMITED (429); WINDY_ERROR (502); WEBCAM_DISCOVERY_UNAVAILABLE (no Windy key),
 * GEOCODER_UNAVAILABLE, AI_UNAVAILABLE (503).
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { JSON_HEADERS } from '../../../_shared/api-utils'
import { logEvent } from '../../../_shared/event-log'
import { copCallerUserId, copServiceCaller } from '../../../_shared/cop-caller'
import { mayEditCopSession, webcamsTableMissing } from '../../../_shared/cop-webcams'
import { consumeQuota, type KvLike } from '../../../_shared/kv-json'
import { GEOCODER_ATTRIBUTION_FIELDS } from '../../../_shared/geocoder'
import { WINDY_ATTRIBUTION } from '../../../_shared/webcam-url'
import { WINDY_UNAVAILABLE_STATUSES, WindyError, windyKeyConfigured, windyNearby } from '../../../_shared/windy-webcams'
import {
  distanceKm,
  errorResponse,
  pageAddressHint,
  RATE_LIMITED,
  resolvePageUrl,
  resolvePlaceText,
  WEBCAM_DISCOVERY_UNAVAILABLE,
  WEBCAM_INVALID,
  WEBCAM_NO_CENTER,
  WINDY_ATTRIBUTION_URL,
  WINDY_ERROR,
  type Resolution,
} from '../../../_shared/webcam-discovery'
import type { CopContext } from '../../../_shared/webcam-ai'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  CACHE?: KvLike
  WINDY_WEBCAMS_API_KEY?: string
  OPENAI_API_KEY?: string
  AI_GATEWAY_ACCOUNT_ID?: string
  COP_WEBCAM_EXTRA_HOSTS?: string
}

const SEARCHES_PER_WINDOW = 20
const WINDOW_S = 10 * 60
const DEFAULT_RADIUS_KM = 5
const DEFAULT_LIMIT = 20

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

function intParam(raw: string | null, min: number, max: number, fallback: number): number | null {
  if (raw === null || raw === '') return fallback
  const n = Number(raw)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

function coordinateParam(raw: string | null, limit: number): number | null | undefined {
  // undefined: absent; null: present but not a coordinate.
  if (raw === null || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  const userId = await copCallerUserId(context)
  if (!userId) return json({ error: 'Authentication required' }, 401)
  if (!(await mayEditCopSession(env.DB, sessionId, userId))) {
    return json({ error: 'Only the session owner or an editor can search for webcams' }, 403)
  }

  const query = new URL(request.url).searchParams
  const radiusKm = intParam(query.get('radius_km'), 1, 50, DEFAULT_RADIUS_KM)
  const limit = intParam(query.get('limit'), 1, 50, DEFAULT_LIMIT)
  if (radiusKm === null) return errorResponse(400, WEBCAM_INVALID, 'radius_km must be a whole number from 1 to 50.')
  if (limit === null) return errorResponse(400, WEBCAM_INVALID, 'limit must be a whole number from 1 to 50.')
  const lat = coordinateParam(query.get('lat'), 90)
  const lon = coordinateParam(query.get('lon'), 180)
  if (lat === null || lon === null || (lat === undefined) !== (lon === undefined)) {
    return errorResponse(400, WEBCAM_INVALID, 'Give lat and lon together, as coordinates.')
  }
  const place = (query.get('place') ?? '').replace(/\s+/g, ' ').trim()
  if (place.length > 120) return errorResponse(400, WEBCAM_INVALID, 'place must be at most 120 characters.')
  const fromUrl = (query.get('from_url') ?? '').trim()
  let pageHint: string | null = null
  if (fromUrl) {
    pageHint = pageAddressHint(fromUrl, env.COP_WEBCAM_EXTRA_HOSTS)
    if (!pageHint) {
      return errorResponse(400, WEBCAM_INVALID, 'from_url must be an https page address that is not itself a camera link.')
    }
  }

  if (!windyKeyConfigured(env)) {
    console.error('[cop/webcams/nearby] WINDY_WEBCAMS_API_KEY is not set: webcam search is off')
    await logEvent(env, { level: 'error', source: 'cop/webcams/nearby', message: 'WINDY_WEBCAMS_API_KEY is not set: webcam search answers 503' })
    return errorResponse(503, WEBCAM_DISCOVERY_UNAVAILABLE, 'Webcam search is not configured on this server.')
  }

  const service = copServiceCaller(context.data)
  const caller = { userId: service ? `service:${service.clientId}` : String(userId) }
  if (!(await consumeQuota(env.CACHE, 'webcams-nearby', caller.userId, SEARCHES_PER_WINDOW, WINDOW_S))) {
    return errorResponse(429, RATE_LIMITED, 'Too many webcam searches. Try again in a few minutes.')
  }

  try {
    const session = await env.DB.prepare('SELECT name, description, center_lat, center_lon FROM cop_sessions WHERE id = ?')
      .bind(sessionId).first<{ name: string | null; description: string | null; center_lat: number | null; center_lon: number | null }>()
    const sessionCenter = session && Number.isFinite(session.center_lat) && Number.isFinite(session.center_lon) &&
      Math.abs(Number(session.center_lat)) <= 90 && Math.abs(Number(session.center_lon)) <= 180
      ? { lat: Number(session.center_lat), lon: Number(session.center_lon) }
      : null
    const cop: CopContext = { name: session?.name ?? null, description: session?.description ?? null, center: sessionCenter }

    let center: { lat: number; lon: number; label: string | null; source: 'query' | 'session' | 'place' | 'url' }
    let resolution: Resolution | null = null
    if (lat !== undefined && lon !== undefined) {
      center = { lat, lon, label: null, source: 'query' }
    } else if (place || pageHint) {
      const outcome = place
        ? await resolvePlaceText(env, caller, place, cop)
        : await resolvePageUrl(env, caller, pageHint!)
      if (!outcome.ok) return errorResponse(outcome.status, outcome.code, outcome.error)
      resolution = outcome.resolution
      center = { lat: outcome.place.lat, lon: outcome.place.lon, label: outcome.place.display_name, source: place ? 'place' : 'url' }
    } else if (sessionCenter) {
      center = { ...sessionCenter, label: null, source: 'session' }
    } else {
      return errorResponse(400, WEBCAM_NO_CENTER, 'This COP has no map center yet. Search near a place instead.')
    }

    let found
    try {
      found = await windyNearby(env, center.lat, center.lon, radiusKm, limit)
    } catch (error) {
      if (!(error instanceof WindyError)) throw error
      if (error.kind === 'key_missing') {
        return errorResponse(503, WEBCAM_DISCOVERY_UNAVAILABLE, 'Webcam search is not configured on this server.')
      }
      if (error.kind === 'auth') {
        console.error('[cop/webcams/nearby] Windy refused WINDY_WEBCAMS_API_KEY')
        await logEvent(env, { level: 'error', source: 'cop/webcams/nearby', message: `Windy refused the API key (${error.status})` })
      }
      return errorResponse(502, WINDY_ERROR, "Windy's webcam service did not answer. Try again shortly.")
    }

    let pinned = new Set<string>()
    try {
      const rows = await env.DB.prepare(
        "SELECT provider_ref FROM cop_webcams WHERE cop_session_id = ? AND provider = 'windy' AND archived_at IS NULL"
      ).bind(sessionId).all<{ provider_ref: string | null }>()
      pinned = new Set((rows.results ?? []).map((r) => String(r.provider_ref)))
    } catch (error) {
      if (!webcamsTableMissing(error)) throw error
    }

    const webcams = found.webcams
      .filter((cam) => cam.lat !== null && cam.lon !== null && !WINDY_UNAVAILABLE_STATUSES.has(cam.status))
      .map((cam) => ({
        windy_id: cam.windy_id,
        title: cam.title,
        status: cam.status,
        lat: cam.lat as number,
        lon: cam.lon as number,
        distance_km: Math.round(distanceKm(center.lat, center.lon, cam.lat as number, cam.lon as number) * 10) / 10,
        city: cam.city,
        region: cam.region,
        country: cam.country,
        live: cam.live,
        delivery: cam.live ? 'live' : 'timelapse',
        preview_url: cam.preview_url,
        detail_url: cam.detail_url,
        categories: cam.categories,
        on_session: pinned.has(cam.windy_id),
      }))
      .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || a.distance_km - b.distance_km)

    return json({
      center,
      resolution,
      radius_km: radiusKm,
      total: found.total,
      webcams,
      attribution: WINDY_ATTRIBUTION,
      attribution_url: WINDY_ATTRIBUTION_URL,
      ...(resolution ? GEOCODER_ATTRIBUTION_FIELDS : {}),
    })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/webcams/nearby',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return json({ error: 'Webcam search failed' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
