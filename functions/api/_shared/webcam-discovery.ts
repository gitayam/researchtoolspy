/**
 * COP webcam discovery: where to look (a point, a place name, the place a non-camera
 * page is about, or the COP's own map center), and the geometry around it.
 *
 * Resolution order for a place name:
 *   1. Geocode it, biased to ±1° around the COP center when there is one.
 *   2. It is AMBIGUOUS when there is no result, or the top two results are more than
 *      50 km apart with importance within 0.1 of each other.
 *   3. Clear → the top result. Ambiguous and a model is available → the model rewrites
 *      the text into one geocoder query using the COP's context, and that query is
 *      geocoded. Ambiguous without a model (or a model that gives nothing usable) → the
 *      top result, flagged `ambiguous`, or PLACE_NOT_FOUND when there is none.
 * The model never supplies coordinates.
 */
import { boxAround, geocode, GeocoderError, type GeocodeResult } from './geocoder'
import { placeQueryFromText, placeQueryFromUrl, webcamAiAvailable, type AiCaller, type CopContext, type WebcamAiEnv } from './webcam-ai'
import { takeQuota, type KvLike, type QuotaResult } from './kv-json'
import { JSON_HEADERS } from './api-utils'
import { parseWebcamUrl } from './webcam-url'

export const WEBCAM_INVALID = 'WEBCAM_INVALID'
export const WEBCAM_NO_CENTER = 'WEBCAM_NO_CENTER'
export const WEBCAM_DISCOVERY_UNAVAILABLE = 'WEBCAM_DISCOVERY_UNAVAILABLE'
export const PLACE_NOT_FOUND = 'PLACE_NOT_FOUND'
export const RATE_LIMITED = 'RATE_LIMITED'
export const WINDY_ERROR = 'WINDY_ERROR'
export const GEOCODER_UNAVAILABLE = 'GEOCODER_UNAVAILABLE'
export const AI_UNAVAILABLE = 'AI_UNAVAILABLE'
export const WEBCAM_NO_POSITION = 'WEBCAM_NO_POSITION'
export const NO_VIEW_TARGET = 'NO_VIEW_TARGET'
export const WEBCAM_NOT_FOUND = 'WEBCAM_NOT_FOUND'
export const WEBCAM_UNAVAILABLE = 'WEBCAM_UNAVAILABLE'

export const WINDY_ATTRIBUTION_URL = 'https://www.windy.com/webcams'

export function errorResponse(status: number, code: string, error: string): Response {
  return new Response(JSON.stringify({ error, code }), { status, headers: JSON_HEADERS })
}

// ── Spend quotas ─────────────────────────────────────────────────────────

/**
 * Who pays for a call that spends Windy, Nominatim or model capacity: the user or
 * service client, and the client address Cloudflare saw (CF-Connecting-IP, which
 * the edge sets; X-Forwarded-For is client-written and never read). Without that
 * header (local runs) only the caller is counted.
 */
export interface SpendCaller {
  who: string
  service: boolean
  ip: string | null
}

/** Allowances per window: a person, the bot service (one client serves every room), one address. */
export interface SpendLimits {
  person: number
  service: number
  address: number
}

export const SPEND_WINDOW_S = 10 * 60
export const NEARBY_LIMITS: SpendLimits = { person: 20, service: 60, address: 30 }
export const ADD_LOOKUP_LIMITS: SpendLimits = { person: 20, service: 60, address: 30 }
export const ESTIMATE_LIMITS: SpendLimits = { person: 20, service: 20, address: 30 }

export function spendCaller(request: Request, userId: number, service: { clientId: string } | null): SpendCaller {
  const raw = (request.headers.get('CF-Connecting-IP') ?? '').trim()
  const ip = /^[0-9A-Fa-f:.]{2,45}$/.test(raw) ? raw.toLowerCase() : null
  return { who: service ? `service:${service.clientId}` : `user:${userId}`, service: Boolean(service), ip }
}

/**
 * Charge one call to the caller and to its address; both must have allowance left.
 * Fails closed: no KV, or a KV error, is 'unavailable'. A service's address gets the
 * service allowance, so the bot host is not held to one person's.
 */
export async function chargeSpend(
  kv: KvLike | undefined,
  name: string,
  caller: SpendCaller,
  limits: SpendLimits,
): Promise<QuotaResult> {
  const allowance = caller.service ? limits.service : limits.person
  const own = await takeQuota(kv, name, caller.who, allowance, SPEND_WINDOW_S)
  if (own !== 'ok' || !caller.ip) return own
  return takeQuota(kv, name, `ip:${caller.ip}`, caller.service ? limits.service : limits.address, SPEND_WINDOW_S)
}

// ── Geometry ─────────────────────────────────────────────────────────────

const R_KM = 6371.0088
const rad = (deg: number) => (deg * Math.PI) / 180

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Initial great-circle bearing from point 1 to point 2, whole degrees 0..359. */
export function initialBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = rad(lat1)
  const φ2 = rad(lat2)
  const Δλ = rad(lon2 - lon1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  return Math.round(deg) % 360
}

// ── Place resolution ─────────────────────────────────────────────────────

export interface Resolution {
  input: string
  query: string
  display_name: string
  ai_used: boolean
  ambiguous: boolean
}

// Both arms name every field: functions compile with strict: false, where a boolean
// discriminant does not narrow.
export type PlaceOutcome =
  | { ok: true; place: GeocodeResult; resolution: Resolution; status?: undefined; code?: undefined; error?: undefined }
  | { ok: false; status: number; code: string; error: string; place?: undefined; resolution?: undefined }

export interface ResolveEnv extends WebcamAiEnv {
  CACHE?: KvLike
}

const AMBIGUOUS_KM = 50
const AMBIGUOUS_IMPORTANCE = 0.1

export function isAmbiguous(results: GeocodeResult[]): boolean {
  if (results.length === 0) return true
  if (results.length < 2) return false
  const [a, b] = results
  return distanceKm(a.lat, a.lon, b.lat, b.lon) > AMBIGUOUS_KM && Math.abs(a.importance - b.importance) < AMBIGUOUS_IMPORTANCE
}

function geocoderDown(): PlaceOutcome {
  return { ok: false, status: 503, code: GEOCODER_UNAVAILABLE, error: 'The place search service is not answering. Try again shortly.' }
}

function notFound(text: string): PlaceOutcome {
  return { ok: false, status: 422, code: PLACE_NOT_FOUND, error: `Couldn't find a place called "${text}".` }
}

export async function resolvePlaceText(
  env: ResolveEnv,
  caller: AiCaller,
  text: string,
  cop: CopContext,
): Promise<PlaceOutcome> {
  const bias = cop.center ? { viewbox: boxAround(cop.center.lat, cop.center.lon, 1), bounded: false } : {}
  let results: GeocodeResult[]
  try {
    results = await geocode(env, text, bias)
  } catch (error) {
    if (error instanceof GeocoderError) return geocoderDown()
    throw error
  }
  const plain = (place: GeocodeResult, ambiguous: boolean): PlaceOutcome => ({
    ok: true,
    place,
    resolution: { input: text, query: text, display_name: place.display_name, ai_used: false, ambiguous },
  })
  if (!isAmbiguous(results)) return plain(results[0], false)

  if (webcamAiAvailable(env)) {
    const ai = await placeQueryFromText(env, caller, { text, cop, candidates: results.map((r) => r.display_name) })
    if (ai) {
      let rewritten: GeocodeResult[]
      try {
        rewritten = await geocode(env, ai.query, { ...bias, countryCode: ai.countryCode })
      } catch (error) {
        if (error instanceof GeocoderError) return geocoderDown()
        throw error
      }
      if (rewritten.length > 0) {
        return {
          ok: true,
          place: rewritten[0],
          resolution: { input: text, query: ai.query, display_name: rewritten[0].display_name, ai_used: true, ambiguous: false },
        }
      }
    }
  }
  return results.length > 0 ? plain(results[0], true) : notFound(text)
}

/**
 * The host and decoded path of a non-camera page, which is all the model sees.
 * Null when the link is not a plain https page address, or when it IS a camera.
 */
export function pageAddressHint(raw: string, extraHosts?: string | null): string | null {
  if (raw.length > 500) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  if (url.hostname.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname) || !url.hostname.includes('.')) return null
  // The model sees host and path only, so the camera check reads the same address;
  // a link that is a camera only with its query (youtube.com/watch?v=…) is refused too.
  const bare = new URL(url.href)
  bare.search = ''
  bare.hash = ''
  if (parseWebcamUrl(bare.href, extraHosts).ok || parseWebcamUrl(raw, extraHosts).ok) return null
  const segments = url.pathname.split('/').filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s)
    } catch {
      return s
    }
  })
  // eslint-disable-next-line no-control-regex
  return [url.hostname, ...segments].join(' / ').replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, 300)
}

export async function resolvePageUrl(
  env: ResolveEnv,
  caller: AiCaller,
  hint: string,
): Promise<PlaceOutcome> {
  if (!webcamAiAvailable(env)) {
    return { ok: false, status: 503, code: AI_UNAVAILABLE, error: 'Reading a place from a page link needs the AI service, which is not configured.' }
  }
  const ai = await placeQueryFromUrl(env, caller, hint)
  if (!ai || ai.confidence === 'low') {
    return { ok: false, status: 422, code: PLACE_NOT_FOUND, error: "Couldn't tell which place that page is about. Search by place name instead." }
  }
  let results: GeocodeResult[]
  try {
    results = await geocode(env, ai.query, { countryCode: ai.countryCode })
  } catch (error) {
    if (error instanceof GeocoderError) return geocoderDown()
    throw error
  }
  if (results.length === 0) return notFound(ai.query)
  return {
    ok: true,
    place: results[0],
    resolution: { input: hint, query: ai.query, display_name: results[0].display_name, ai_used: true, ambiguous: ai.confidence !== 'high' },
  }
}
