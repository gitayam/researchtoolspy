/**
 * Place names to coordinates, server side, through OpenStreetMap Nominatim.
 *
 * Coordinates on a COP come from here (or from Windy), never from a model.
 * The public server's usage policy (operations.osmfoundation.org/policies/nominatim)
 * is followed here, for the whole app:
 *   - an identifying User-Agent;
 *   - at most 30 calls a minute across every caller (a global KV counter; the policy
 *     allows 1 a second). Over the cap, or without KV to count with, the geocoder
 *     reports itself unavailable rather than risk the limit;
 *   - the same search is never sent twice inside the cache window: the query is
 *     normalised (trimmed, spaces collapsed, lower-cased) for the request and the
 *     cache key, results are cached 7 days and empty results 24 hours;
 *   - a kill switch with no deploy: while KV `CACHE` holds `geocoder:disabled`,
 *     Nominatim is not called at all (cached answers still serve);
 *   - the attribution below goes in every response that shows geocoder output.
 */
import { getOutboundJson } from './outbound-json'
import { keyDigest, kvGetJson, kvPutJson, type KvLike } from './kv-json'
import { logEvent } from './event-log'

export const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'
export const GEOCODER_HOSTS: ReadonlySet<string> = new Set(['nominatim.openstreetmap.org'])
export const GEOCODER_USER_AGENT = 'ResearchTools-COP/1.0 (+https://researchtools.net)'
export const GEOCODER_ATTRIBUTION = '© OpenStreetMap contributors'
export const GEOCODER_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright'
export const GEOCODER_KILL_SWITCH_KEY = 'geocoder:disabled'
export const GEOCODER_CALLS_PER_MINUTE = 30
const CACHE_TTL_S = 7 * 24 * 3600
const EMPTY_CACHE_TTL_S = 24 * 3600

/** The attribution fields for a JSON response that includes geocoder output. */
export const GEOCODER_ATTRIBUTION_FIELDS = {
  geocoder_attribution: GEOCODER_ATTRIBUTION,
  geocoder_attribution_url: GEOCODER_ATTRIBUTION_URL,
} as const

export interface GeocodeResult {
  name: string
  display_name: string
  lat: number
  lon: number
  importance: number
}

export interface GeocodeOptions {
  /** Prefer (or, with bounded, require) results inside this box. */
  viewbox?: { minLat: number; minLon: number; maxLat: number; maxLon: number }
  bounded?: boolean
  countryCode?: string | null
  limit?: number
}

export type GeocoderFailure = 'disabled' | 'throttled' | 'upstream'

export class GeocoderError extends Error {
  constructor(public readonly reason: GeocoderFailure, public readonly status: number | null = null) {
    super(`Geocoder unavailable: ${reason}${status ? ` (${status})` : ''}`)
    this.name = 'GeocoderError'
  }
}

/** Trimmed, single-spaced, lower-case: one spelling per search, for the request and the cache key. */
export function normaliseGeocoderQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 200)
}

let killSwitchLogged = false

/** Count one Nominatim call against the app-wide per-minute cap. No KV or a KV error: refuse. */
async function takeGlobalSlot(kv: KvLike | undefined): Promise<boolean> {
  if (!kv) return false
  const key = `quota:geocoder:global:${Math.floor(Date.now() / 60_000)}`
  try {
    const used = Number.parseInt((await kv.get(key)) ?? '0', 10) || 0
    if (used >= GEOCODER_CALLS_PER_MINUTE) return false
    await kv.put(key, String(used + 1), { expirationTtl: 120 })
    return true
  } catch {
    return false
  }
}

/** A box of ±deg around a point, clamped to valid coordinates. */
export function boxAround(lat: number, lon: number, deg: number): NonNullable<GeocodeOptions['viewbox']> {
  return {
    minLat: Math.max(-90, lat - deg),
    maxLat: Math.min(90, lat + deg),
    minLon: Math.max(-180, lon - deg),
    maxLon: Math.min(180, lon + deg),
  }
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, max) : null
}

function parseResults(data: unknown): GeocodeResult[] {
  if (!Array.isArray(data)) return []
  const out: GeocodeResult[] = []
  for (const raw of data) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const lat = Number(r.lat)
    const lon = Number(r.lon)
    const display = clean(r.display_name, 300)
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !display) continue
    const importance = Number(r.importance)
    out.push({
      name: clean(r.name, 120) ?? display.split(',')[0].trim(),
      display_name: display,
      lat,
      lon,
      importance: Number.isFinite(importance) ? importance : 0,
    })
  }
  return out
}

export async function geocode(
  env: { CACHE?: KvLike; DB?: unknown },
  query: string,
  options: GeocodeOptions = {},
): Promise<GeocodeResult[]> {
  const q = normaliseGeocoderQuery(query)
  if (!q) return []
  const url = new URL(NOMINATIM_SEARCH)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', String(Math.min(10, Math.max(1, options.limit ?? 5))))
  url.searchParams.set('accept-language', 'en')
  url.searchParams.set('q', q)
  if (options.viewbox) {
    const b = options.viewbox
    url.searchParams.set('viewbox', [b.minLon, b.maxLat, b.maxLon, b.minLat].map((n) => n.toFixed(4)).join(','))
    url.searchParams.set('bounded', options.bounded ? '1' : '0')
  }
  const cc = typeof options.countryCode === 'string' && /^[a-z]{2}$/.test(options.countryCode) ? options.countryCode : null
  if (cc) url.searchParams.set('countrycodes', cc)

  const cacheKey = `geo:v1:${await keyDigest(url.search)}`
  const cached = await kvGetJson<GeocodeResult[]>(env.CACHE, cacheKey)
  if (Array.isArray(cached)) return cached

  if (env.CACHE && (await env.CACHE.get(GEOCODER_KILL_SWITCH_KEY).catch(() => null)) !== null) {
    if (!killSwitchLogged) {
      killSwitchLogged = true
      await logEvent(env as { DB?: unknown }, {
        level: 'warn',
        source: 'geocoder',
        message: `Nominatim is switched off (KV ${GEOCODER_KILL_SWITCH_KEY}); place search answers 503.`,
      })
    }
    throw new GeocoderError('disabled')
  }
  if (!(await takeGlobalSlot(env.CACHE))) throw new GeocoderError('throttled')

  const result = await getOutboundJson(url.href, {
    allowedHosts: GEOCODER_HOSTS,
    headers: { 'User-Agent': GEOCODER_USER_AGENT, 'Accept-Language': 'en' },
  })
  if (!result.ok) throw new GeocoderError('upstream', result.status)
  const results = parseResults(result.data)
  await kvPutJson(env.CACHE, cacheKey, results, results.length > 0 ? CACHE_TTL_S : EMPTY_CACHE_TTL_S)
  return results
}
