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
 * - Spend: at most WINDY_CALLS_PER_MINUTE calls a minute across the whole app (a
 *   global KV counter that refuses when KV is missing or failing), "no such camera"
 *   cached an hour, facts cached 6 hours, nearby results 8 minutes. Cache hits are
 *   free. Callers also charge the person asking (webcam-discovery.ts chargeSpend).
 */
import { getOutboundJson } from './outbound-json'
import { kvGetJson, kvPutJson, type KvLike } from './kv-json'

export const WINDY_API_BASE = 'https://api.windy.com/webcams/api/v3'
export const WINDY_API_HOSTS: ReadonlySet<string> = new Set(['api.windy.com'])
const WINDY_ID = /^\d{6,12}$/
const META_TTL_S = 6 * 3600
const NOT_FOUND_TTL_S = 3600
const NEARBY_TTL_S = 8 * 60
export const WINDY_CALLS_PER_MINUTE = 60

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

export type WindyFailure = 'key_missing' | 'not_found' | 'auth' | 'unavailable' | 'throttled'

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

/** Count one Windy call against the app-wide per-minute cap. No KV or a KV error: refuse. */
async function takeWindySlot(kv: KvLike | undefined): Promise<boolean> {
  if (!kv) return false
  const key = `quota:windy:global:${Math.floor(Date.now() / 60_000)}`
  try {
    const used = Number.parseInt((await kv.get(key)) ?? '0', 10) || 0
    if (used >= WINDY_CALLS_PER_MINUTE) return false
    await kv.put(key, String(used + 1), { expirationTtl: 120 })
    return true
  } catch {
    return false
  }
}

async function windyGet(env: WindyEnv, path: string, params: Record<string, string>): Promise<unknown> {
  if (!windyKeyConfigured(env)) throw new WindyError('key_missing')
  if (!(await takeWindySlot(env.CACHE))) throw new WindyError('throttled')
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

type CachedCamera = WindyCamera | { not_found: true }

const cameraCacheKey = (id: string) => `windy:cam:v1:${id}`

/**
 * What the cache already knows about a camera, without asking Windy: its facts,
 * 'not_found', or null (unknown, so a lookup would cost a call).
 */
export async function cachedWindyCamera(env: WindyEnv, id: string): Promise<WindyCamera | 'not_found' | null> {
  if (!WINDY_ID.test(id)) return 'not_found'
  const cached = await kvGetJson<CachedCamera>(env.CACHE, cameraCacheKey(id))
  if (cached && 'not_found' in cached && cached.not_found === true) return 'not_found'
  return cached && 'windy_id' in cached && cached.windy_id === id ? cached : null
}

/**
 * One camera's facts (cached 6 h, without image URLs; "no such camera" cached 1 h).
 * `fresh` skips the cache read, for status checks. Throws WindyError.
 */
export async function windyCamera(env: WindyEnv, id: string, options: { fresh?: boolean } = {}): Promise<WindyCamera> {
  if (!options.fresh) {
    const cached = await cachedWindyCamera(env, id)
    if (cached === 'not_found') throw new WindyError('not_found')
    if (cached) return cached
  } else if (!WINDY_ID.test(id)) {
    throw new WindyError('not_found')
  }
  let data: unknown
  try {
    data = await windyGet(env, `/webcams/${id}`, { include: 'location,player,urls,categories', lang: 'en' })
  } catch (error) {
    if (error instanceof WindyError && error.kind === 'not_found') {
      await kvPutJson(env.CACHE, cameraCacheKey(id), { not_found: true }, NOT_FOUND_TTL_S)
    }
    throw error
  }
  const parsed = parseWindyCamera(data)
  if (!parsed || parsed.windy_id !== id) throw new WindyError('unavailable')
  const facts = factsOnly(parsed)
  await kvPutJson(env.CACHE, cameraCacheKey(id), facts, META_TTL_S)
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
