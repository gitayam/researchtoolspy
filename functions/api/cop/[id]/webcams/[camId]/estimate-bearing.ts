/**
 * POST /api/cop/:id/webcams/:camId/estimate-bearing - Suggest which way a camera faces
 * (owner, editor or admin collaborator; not services). Nothing is saved: the client
 * shows the suggestion and saves it through PATCH with bearing_source 'estimated'.
 *
 * Windy gives a camera's position but not its direction. The model reads the camera's
 * label and title and names the landmark the view faces ("Eiffel Tower, Paris"); the
 * geocoder places that landmark within ±0.15° of the camera; the bearing is the
 * great-circle bearing from the camera to the nearest match 0.05–15 km away.
 *
 * Errors carry `code`: WEBCAM_NO_POSITION, NO_VIEW_TARGET (422); AI_UNAVAILABLE,
 * GEOCODER_UNAVAILABLE (503); RATE_LIMITED (429). Estimates are charged to the
 * caller and its CF-Connecting-IP address (ESTIMATE_LIMITS); without KV to count
 * with, they are refused.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { JSON_HEADERS } from '../../../../_shared/api-utils'
import { logEvent } from '../../../../_shared/event-log'
import { copCallerUserId, copServiceCaller } from '../../../../_shared/cop-caller'
import { getSessionWebcam, mayEditCopSession, webcamsTableMissing, webcamsUnavailable } from '../../../../_shared/cop-webcams'
import type { KvLike } from '../../../../_shared/kv-json'
import { boxAround, geocode, GEOCODER_ATTRIBUTION_FIELDS, GeocoderError } from '../../../../_shared/geocoder'
import { viewTargetFromTitle, webcamAiAvailable } from '../../../../_shared/webcam-ai'
import { windyCamera, windyKeyConfigured } from '../../../../_shared/windy-webcams'
import {
  AI_UNAVAILABLE,
  chargeSpend,
  distanceKm,
  ESTIMATE_LIMITS,
  errorResponse,
  GEOCODER_UNAVAILABLE,
  initialBearingDeg,
  NO_VIEW_TARGET,
  RATE_LIMITED,
  spendCaller,
  WEBCAM_NO_POSITION,
} from '../../../../_shared/webcam-discovery'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  CACHE?: KvLike
  WINDY_WEBCAMS_API_KEY?: string
  OPENAI_API_KEY?: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

const MIN_TARGET_KM = 0.05
const MAX_TARGET_KM = 15

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const camId = params.camId as string

  const userId = await copCallerUserId(context)
  if (!userId) return json({ error: 'Authentication required' }, 401)
  if (!(await mayEditCopSession(env.DB, sessionId, userId))) {
    return json({ error: 'Only the session owner or an editor can estimate a webcam direction' }, 403)
  }

  try {
    const cam = await getSessionWebcam(env.DB, sessionId, camId)
    if (!cam) return json({ error: 'Webcam not found' }, 404)
    if (cam.lat == null || cam.lon == null) {
      return errorResponse(422, WEBCAM_NO_POSITION, 'Give the camera a position first: the direction is measured from it.')
    }
    if (!webcamAiAvailable(env)) {
      return errorResponse(503, AI_UNAVAILABLE, 'Estimating a direction needs the AI service, which is not configured.')
    }
    const spender = spendCaller(request, userId, copServiceCaller(context.data))
    const charge = await chargeSpend(env.CACHE, 'webcams-bearing', spender, ESTIMATE_LIMITS)
    if (charge === 'over') return errorResponse(429, RATE_LIMITED, 'Too many direction estimates. Try again in a few minutes.')
    if (charge === 'unavailable') {
      return errorResponse(503, AI_UNAVAILABLE, 'Direction estimates are unavailable right now. Try again shortly.')
    }

    let title: string | null = null
    let city: string | null = null
    let country: string | null = null
    if (cam.provider === 'windy' && cam.provider_ref && windyKeyConfigured(env)) {
      try {
        const facts = await windyCamera(env, cam.provider_ref)
        title = facts.title
        city = facts.city
        country = facts.country
      } catch {
        // The label alone may still name the view.
      }
    }

    const target = await viewTargetFromTitle(env, { userId: spender.who }, { label: cam.label, title, city, country })
    if (!target) {
      return errorResponse(422, NO_VIEW_TARGET, "The camera's name doesn't say what it looks at. Set the direction by hand.")
    }

    let matches
    try {
      matches = await geocode(env, target, { viewbox: boxAround(cam.lat, cam.lon, 0.15), bounded: true })
    } catch (error) {
      if (error instanceof GeocoderError) {
        return errorResponse(503, GEOCODER_UNAVAILABLE, 'The place search service is not answering. Try again shortly.')
      }
      throw error
    }
    const nearest = matches
      .map((m) => ({ ...m, distance: distanceKm(cam.lat as number, cam.lon as number, m.lat, m.lon) }))
      .filter((m) => m.distance >= MIN_TARGET_KM && m.distance <= MAX_TARGET_KM)
      .sort((a, b) => a.distance - b.distance)[0]
    if (!nearest) {
      return errorResponse(422, NO_VIEW_TARGET, `Couldn't place "${target}" near the camera. Set the direction by hand.`)
    }

    return json({
      bearing_deg: initialBearingDeg(cam.lat, cam.lon, nearest.lat, nearest.lon),
      target: {
        name: target,
        display_name: nearest.display_name,
        lat: nearest.lat,
        lon: nearest.lon,
        distance_km: Math.round(nearest.distance * 100) / 100,
      },
      ai_used: true,
      ...GEOCODER_ATTRIBUTION_FIELDS,
    })
  } catch (error) {
    if (webcamsTableMissing(error)) return webcamsUnavailable()
    await logEvent(env, {
      level: 'error',
      source: 'cop/webcams/estimate-bearing',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return json({ error: 'Failed to estimate the direction' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
