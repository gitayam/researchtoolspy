/**
 * GET /api/cop/:id/geocode?q=<place>[&near=<lat>,<lon>]  (editors; the bot)
 *   → { results: [{ display_name, lat, lon, importance }], resolution,
 *       geocoder_attribution, geocoder_attribution_url }
 *
 * The Phase 2 place search, for `!cop mark` and the COP's own place inputs:
 *   - `q` that is already coordinates comes back as-is (no lookup);
 *   - otherwise Nominatim, biased to `near` or the COP's map center, within the
 *     app-wide policy caps, cache and KV kill switch (functions/api/_shared/geocoder.ts);
 *   - an ambiguous result goes to the model once, with the COP's name, description
 *     and center, to rewrite the words into one search; coordinates still come from
 *     the geocoder.
 * Charged to the caller and its CF-Connecting-IP (fail closed). Errors carry `code`:
 * PLACE_NOT_FOUND (422), GEOCODER_UNAVAILABLE (503), RATE_LIMITED (429).
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { logEvent } from '../../_shared/event-log'
import { coded, copEditor, json } from '../../_shared/cop-route-auth'
import { copServiceCaller } from '../../_shared/cop-caller'
import { boxAround, geocode, GeocoderError, GEOCODER_ATTRIBUTION_FIELDS, type GeocodeResult } from '../../_shared/geocoder'
import {
  chargeSpend,
  GEOCODER_UNAVAILABLE,
  isAmbiguous,
  PLACE_NOT_FOUND,
  RATE_LIMITED,
  spendCaller,
  type SpendLimits,
} from '../../_shared/webcam-discovery'
import { placeQueryFromText, webcamAiAvailable } from '../../_shared/webcam-ai'
import { copSessionScope } from '../../_shared/cop-records'
import type { KvLike } from '../../_shared/kv-json'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  CACHE?: KvLike
  OPENAI_API_KEY?: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

const GEOCODE_LIMITS: SpendLimits = { person: 30, service: 60, address: 40 }
const COORDS = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/

function point(raw: string | null): { lat: number; lon: number } | null | undefined {
  if (raw === null || raw === '') return undefined
  const match = COORDS.exec(raw)
  if (!match) return null
  const lat = Number(match[1])
  const lon = Number(match[2])
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null
}

const view = (r: GeocodeResult) => ({ display_name: r.display_name, lat: r.lat, lon: r.lon, importance: r.importance })

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const sessionId = context.params.id as string
  const access = await copEditor(context, sessionId, 'search for places')
  if (access.ok === false) return access.response
  const query = new URL(context.request.url).searchParams
  const q = (query.get('q') ?? '').replace(/\s+/g, ' ').trim()
  if (!q) return json({ error: 'q is required' }, 400)
  if (q.length > 120) return json({ error: 'q is limited to 120 characters' }, 400)
  const near = point(query.get('near'))
  if (near === null) return json({ error: 'near must be "lat,lon"' }, 400)

  // Coordinates need no lookup.
  const typed = point(q)
  if (typed) {
    const label = `${typed.lat.toFixed(5)}, ${typed.lon.toFixed(5)}`
    return json({
      results: [{ display_name: label, lat: typed.lat, lon: typed.lon, importance: 1 }],
      resolution: { input: q, query: q, display_name: label, ai_used: false, ambiguous: false },
    })
  }

  const { env } = context
  const spender = spendCaller(context.request, access.userId, copServiceCaller(context.data))
  const charge = await chargeSpend(env.CACHE, 'cop-geocode', spender, GEOCODE_LIMITS)
  if (charge === 'over') return coded(429, RATE_LIMITED, 'Too many place searches. Try again in a few minutes.')
  if (charge === 'unavailable') return coded(503, GEOCODER_UNAVAILABLE, 'Place search is unavailable right now. Try again shortly.')

  try {
    const scope = await copSessionScope(env.DB, sessionId)
    const center = near ?? scope?.center ?? null
    const bias = center ? { viewbox: boxAround(center.lat, center.lon, 1), bounded: false } : {}
    let results = await geocode(env, q, bias)
    let resolution = { input: q, query: q, display_name: results[0]?.display_name ?? '', ai_used: false, ambiguous: false }
    if (isAmbiguous(results)) {
      resolution.ambiguous = results.length > 0
      if (webcamAiAvailable(env)) {
        const ai = await placeQueryFromText(env, { userId: spender.who }, {
          text: q,
          cop: { name: scope?.name ?? null, description: scope?.description ?? null, center: scope?.center ?? null },
          candidates: results.map((r) => r.display_name),
        })
        if (ai) {
          const rewritten = await geocode(env, ai.query, { ...bias, countryCode: ai.countryCode })
          if (rewritten.length > 0) {
            results = rewritten
            resolution = { input: q, query: ai.query, display_name: rewritten[0].display_name, ai_used: true, ambiguous: false }
          }
        }
      }
    }
    if (results.length === 0) return coded(422, PLACE_NOT_FOUND, `Couldn't find a place called "${q}".`)
    return json({ results: results.slice(0, 5).map(view), resolution, ...GEOCODER_ATTRIBUTION_FIELDS })
  } catch (error) {
    if (error instanceof GeocoderError) return coded(503, GEOCODER_UNAVAILABLE, 'The place search service is not answering. Try again shortly.')
    await logEvent(env, { level: 'error', source: 'cop/geocode', message: String(error instanceof Error ? error.message : error).slice(0, 500) })
    return json({ error: 'Failed to search for the place' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
