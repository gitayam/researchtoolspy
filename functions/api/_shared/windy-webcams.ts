/**
 * Windy Webcams API v3, server side: a camera's facts by id, cameras near a point,
 * and the status of a few cameras at once.
 *
 * - Base https://api.windy.com/webcams/api/v3, key in the `x-windy-api-key` header
 *   (Pages secret WINDY_WEBCAMS_API_KEY). No key: callers get WINDY_KEY_MISSING and
 *   degrade (an add works as before; discovery answers 503).
 * - Only facts are kept: id, title, status, position, place names, whether Windy has a
 *   live player, the operator's page. Image URLs carry a token that expires in about
 *   10 minutes on the free tier, so they appear only in the short-lived nearby cache
 *   and are handed to the browser as-is, never fetched or stored here.
 * - Terms: show "Webcams provided by windy.com" near the cameras and link each image
 *   to the camera's Windy page.
 */
import { getOutboundJson } from './outbound-json'
import { kvGetJson, kvPutJson, type KvLike } from './kv-json'

export const WINDY_API_BASE = 'https://api.windy.com/webcams/api/v3'
export const WINDY_API_HOSTS: ReadonlySet<string> = new Set(['api.windy.com'])
const WINDY_ID = /^\d{6,12}$/
const META_TTL_S = 6 * 3600
const NEARBY_TTL_S = 8 * 60

/** Windy statuses that mean the camera cannot be shown at all. */
export const WINDY_UNAVAILABLE_STATUSES: ReadonlySet<string> = new Set([
  'disabled', 'rejected', 'duplicate', 'merged', 'unapproved',
])
const WINDY_STATUSES: ReadonlySet<string> = new Set(['active', 'inactive', ...WINDY_UNAVAILABLE_STATUSES])

export interface WindyEnv {
  WINDY_WEBCAMS_API_KEY?: string
  CACHE?: KvLike
}

export interface WindyCamera {
  windy_id: string
  title: string
  status: string
  lat: number | null
  lon: number | null
  city: string | null
  region: string | null
  country: string | null
  live: boolean
  source_url: string | null
  detail_url: string
  categories: string[]
}

export interface WindyNearbyCamera extends WindyCamera {
  preview_url: string | null
}

export type WindyFailure = 'key_missing' | 'not_found' | 'auth' | 'unavailable'

export class WindyError extends Error {
  constructor(public readonly kind: WindyFailure, public readonly status: number | null = null) {
    super(`Windy webcams API: ${kind}${status ? ` (${status})` : ''}`)
    this.name = 'WindyError'
  }
}

export function windyKeyConfigured(env: WindyEnv): boolean {
  return typeof env.WINDY_WEBCAMS_API_KEY === 'string' && env.WINDY_WEBCAMS_API_KEY.trim().length > 0
}

// ── Parsing: Windy's JSON is third-party input ───────────────────────────

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const clean = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  return clean ? clean.slice(0, max) : null
}

function coordinate(value: unknown, limit: number): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null
}

/** An https link on an ordinary host, without credentials or a port; else null. */
export function safeHttpsUrl(value: unknown, maxLength = 500): string | null {
  if (typeof value !== 'string' || value.length > maxLength) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    if (url.hostname.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname)) return null
    if (!url.hostname.includes('.')) return null
    return url.href
  } catch {
    return null
  }
}

function isWindyHost(hostname: string): boolean {
  return hostname === 'windy.com' || hostname.endsWith('.windy.com')
}

/** Windy's live player for this id, exactly; anything else is not trusted as live. */
function hasLivePlayer(id: string, live: unknown): boolean {
  if (typeof live !== 'string') return false
  try {
    const url = new URL(live)
    return url.protocol === 'https:' && url.hostname === 'webcams.windy.com' && !url.port &&
      new RegExp(`^/webcams/public/embed/player/${id}/live/?$`).test(url.pathname)
  } catch {
    return false
  }
}

function previewUrl(images: unknown): string | null {
  const current = (images as { current?: Record<string, unknown> } | null)?.current
  for (const candidate of [current?.preview, current?.thumbnail]) {
    const href = safeHttpsUrl(candidate, 1000)
    if (href && isWindyHost(new URL(href).hostname)) return href
  }
  return null
}

export function parseWindyCamera(raw: unknown): WindyNearbyCamera | null {
  if (!raw || typeof raw !== 'object') return null
  const cam = raw as Record<string, unknown>
  const id = typeof cam.webcamId === 'number' && Number.isSafeInteger(cam.webcamId)
    ? String(cam.webcamId)
    : typeof cam.webcamId === 'string' ? cam.webcamId : ''
  if (!WINDY_ID.test(id)) return null
  const location = (cam.location ?? {}) as Record<string, unknown>
  const status = typeof cam.status === 'string' && WINDY_STATUSES.has(cam.status) ? cam.status : 'unknown'
  const categories = Array.isArray(cam.categories)
    ? cam.categories
      .map((c) => (c && typeof c === 'object' ? (c as { id?: unknown }).id : c))
      .filter((c): c is string => typeof c === 'string' && /^[A-Za-z]{1,30}$/.test(c))
      .slice(0, 10)
    : []
  const lat = coordinate(location.latitude, 90)
  const lon = coordinate(location.longitude, 180)
  return {
    windy_id: id,
    title: text(cam.title, 200) ?? `Windy webcam ${id}`,
    status,
    lat: lat !== null && lon !== null ? lat : null,
    lon: lat !== null && lon !== null ? lon : null,
    city: text(location.city, 100),
    region: text(location.region, 100),
    country: text(location.country, 100),
    live: hasLivePlayer(id, (cam.player as Record<string, unknown> | undefined)?.live),
    source_url: safeHttpsUrl((cam.urls as Record<string, unknown> | undefined)?.provider),
    detail_url: `https://www.windy.com/webcams/${id}`,
    categories,
    preview_url: previewUrl(cam.images),
  }
}

/** The facts without the image URL, whose token expires in minutes. */
function factsOnly(cam: WindyNearbyCamera): WindyCamera {
  const facts: Partial<WindyNearbyCamera> = { ...cam }
  delete facts.preview_url
  return facts as WindyCamera
}

// ── Calls ────────────────────────────────────────────────────────────────

async function windyGet(env: WindyEnv, path: string, params: Record<string, string>): Promise<unknown> {
  if (!windyKeyConfigured(env)) throw new WindyError('key_missing')
  const url = new URL(`${WINDY_API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const result = await getOutboundJson(url.href, {
    allowedHosts: WINDY_API_HOSTS,
    headers: { 'x-windy-api-key': env.WINDY_WEBCAMS_API_KEY!.trim() },
  })
  if (result.ok) return result.data
  if (result.status === 404) throw new WindyError('not_found', 404)
  if (result.status === 401 || result.status === 403) throw new WindyError('auth', result.status)
  throw new WindyError('unavailable', result.status)
}

/** One camera's facts (cached 6 h, without image URLs). Throws WindyError. */
export async function windyCamera(env: WindyEnv, id: string): Promise<WindyCamera> {
  if (!WINDY_ID.test(id)) throw new WindyError('not_found')
  const cacheKey = `windy:cam:v1:${id}`
  const cached = await kvGetJson<WindyCamera>(env.CACHE, cacheKey)
  if (cached?.windy_id === id) return cached
  const data = await windyGet(env, `/webcams/${id}`, { include: 'location,player,urls,categories', lang: 'en' })
  const parsed = parseWindyCamera(data)
  if (!parsed || parsed.windy_id !== id) throw new WindyError('unavailable')
  const facts = factsOnly(parsed)
  await kvPutJson(env.CACHE, cacheKey, facts, META_TTL_S)
  return facts
}

/** Cameras within radiusKm of a point (cached 8 min: the image tokens last about 10). */
export async function windyNearby(
  env: WindyEnv,
  lat: number,
  lon: number,
  radiusKm: number,
  limit: number,
): Promise<{ total: number; webcams: WindyNearbyCamera[]; cached: boolean }> {
  const key = `windy:nearby:v1:${lat.toFixed(3)},${lon.toFixed(3)},${radiusKm},${limit}`
  const cached = await kvGetJson<{ total: number; webcams: WindyNearbyCamera[] }>(env.CACHE, key)
  if (cached && Array.isArray(cached.webcams)) return { ...cached, cached: true }
  const data = await windyGet(env, '/webcams', {
    nearby: `${lat.toFixed(5)},${lon.toFixed(5)},${radiusKm}`,
    limit: String(limit),
    include: 'location,player,images,urls,categories',
    lang: 'en',
  }) as { total?: unknown; webcams?: unknown }
  const webcams = (Array.isArray(data?.webcams) ? data.webcams : [])
    .map(parseWindyCamera)
    .filter((c): c is WindyNearbyCamera => c !== null)
  const total = typeof data?.total === 'number' && Number.isFinite(data.total) ? data.total : webcams.length
  await kvPutJson(env.CACHE, key, { total, webcams }, NEARBY_TTL_S)
  return { total, webcams, cached: false }
}

/** Status of up to 50 cameras in one call. Cameras Windy leaves out are absent. */
export async function windyStatuses(env: WindyEnv, ids: string[]): Promise<Map<string, WindyCamera>> {
  const wanted = [...new Set(ids.filter((id) => WINDY_ID.test(id)))].slice(0, 50)
  const out = new Map<string, WindyCamera>()
  if (wanted.length === 0) return out
  const data = await windyGet(env, '/webcams', {
    webcamIds: wanted.join(','),
    limit: String(wanted.length),
    include: 'player',
    lang: 'en',
  }) as { webcams?: unknown }
  for (const raw of Array.isArray(data?.webcams) ? data.webcams : []) {
    const cam = parseWindyCamera(raw)
    if (cam && wanted.includes(cam.windy_id)) {
      out.set(cam.windy_id, factsOnly(cam))
    }
  }
  return out
}
