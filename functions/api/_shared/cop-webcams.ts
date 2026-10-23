/**
 * COP webcams: input validation, the fields a client sees, editor checks and the
 * map geometry shared by the webcams routes, the webcams layer and the public share.
 *
 * The cop_webcams table comes from managed migration 0020. Until it is applied,
 * writes answer 503 WEBCAMS_UNAVAILABLE and reads answer an empty list or layer.
 */
import { parseWebcamUrl, webcamEmbedUrl, WINDY_ATTRIBUTION, type WebcamProvider, type WebcamDelivery } from './webcam-url'
import { JSON_HEADERS } from './api-utils'

export const WEBCAMS_UNAVAILABLE = 'WEBCAMS_UNAVAILABLE'
export const MAX_WEBCAMS_PER_SESSION = 200
export const DEFAULT_IMAGE_REFRESH_S = 60
export const MIN_IMAGE_REFRESH_S = 30
const MAX_IMAGE_REFRESH_S = 86_400
const DEFAULT_CONE_FOV = 60
const CONE_RANGE_KM = 1.5

/** The columns a client may read. Never created_by. */
export const WEBCAM_COLUMNS =
  'id, provider, provider_ref, page_url, image_url, stream_url, label, lat, lon, ' +
  'bearing_deg, fov_deg, delivery, refresh_s, attribution, created_at'

export interface WebcamRow {
  id: string
  provider: WebcamProvider
  provider_ref: string | null
  page_url: string | null
  image_url: string | null
  stream_url: string | null
  label: string
  lat: number | null
  lon: number | null
  bearing_deg: number | null
  fov_deg: number | null
  delivery: WebcamDelivery
  refresh_s: number | null
  attribution: string | null
  created_at: string
}

export interface WebcamInput {
  provider: WebcamProvider
  provider_ref: string | null
  page_url: string | null
  image_url: string | null
  stream_url: string | null
  label: string
  lat: number | null
  lon: number | null
  bearing_deg: number | null
  fov_deg: number | null
  delivery: WebcamDelivery
  refresh_s: number | null
  attribution: string | null
}

export function webcamsTableMissing(error: unknown): boolean {
  return /no such table:\s*(?:main\.)?cop_webcams\b/i.test(String(error instanceof Error ? error.message : error))
}

export function webcamsUnavailable(): Response {
  return new Response(JSON.stringify({
    error: 'Webcams are not available on this server yet.',
    code: WEBCAMS_UNAVAILABLE,
  }), { status: 503, headers: JSON_HEADERS })
}

/** A row as a client sees it, with the embed URL derived from the stored provider id. */
export function publicWebcam(row: WebcamRow): WebcamRow & { embed_url: string | null } {
  const out = {} as Record<string, unknown>
  for (const key of WEBCAM_COLUMNS.split(', ')) out[key] = (row as unknown as Record<string, unknown>)[key] ?? null
  return { ...(out as unknown as WebcamRow), embed_url: webcamEmbedUrl(row.provider, row.provider_ref) }
}

/** The session owner, or a collaborator with the editor or admin role. */
export async function mayEditCopSession(db: D1Database, sessionId: string, userId: number): Promise<boolean> {
  const session = await db.prepare('SELECT created_by FROM cop_sessions WHERE id = ?')
    .bind(sessionId).first<{ created_by: number | null }>()
  if (!session) return false
  if (session.created_by != null && String(session.created_by) === String(userId)) return true
  const collaborator = await db.prepare(
    'SELECT role FROM cop_collaborators WHERE cop_session_id = ? AND user_id = ?'
  ).bind(sessionId, userId).first<{ role: string | null }>()
  const role = String(collaborator?.role ?? '').toLowerCase()
  return role === 'editor' || role === 'admin'
}

function optionalNumber(value: unknown): number | null | undefined {
  // undefined: not a number at all; null: absent.
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(n) ? n : undefined
}

function optionalInteger(value: unknown, min: number, max: number): number | null | undefined {
  const n = optionalNumber(value)
  if (n === null || n === undefined) return n
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined
}

function cleanText(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return undefined
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length > max) return undefined
  return text || null
}

/** Validate a POST body. `extraHosts` is COP_WEBCAM_EXTRA_HOSTS. */
export function validateWebcamInput(
  body: unknown,
  extraHosts?: string | null,
): { ok: true; value: WebcamInput; error?: undefined } | { ok: false; error: string; value?: undefined } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Expected a JSON object.' }
  const b = body as Record<string, unknown>

  const parsed = parseWebcamUrl(b.url, extraHosts)
  if (!parsed.ok) return { ok: false, error: parsed.error }
  const cam = parsed.cam

  const label = cleanText(b.label, 120)
  if (label === undefined) return { ok: false, error: 'label must be text of at most 120 characters.' }
  if (!label) return { ok: false, error: 'label is required.' }

  const lat = optionalNumber(b.lat)
  const lon = optionalNumber(b.lon)
  if (lat === undefined || (lat !== null && (lat < -90 || lat > 90))) return { ok: false, error: 'lat must be between -90 and 90.' }
  if (lon === undefined || (lon !== null && (lon < -180 || lon > 180))) return { ok: false, error: 'lon must be between -180 and 180.' }
  if ((lat === null) !== (lon === null)) return { ok: false, error: 'Give both lat and lon, or neither.' }

  const bearing = optionalInteger(b.bearing_deg, 0, 359)
  if (bearing === undefined) return { ok: false, error: 'bearing_deg must be a whole number from 0 to 359.' }
  const fov = optionalInteger(b.fov_deg, 1, 360)
  if (fov === undefined) return { ok: false, error: 'fov_deg must be a whole number from 1 to 360.' }

  let refresh: number | null = null
  if (cam.provider === 'image') {
    const r = optionalInteger(b.refresh_s, MIN_IMAGE_REFRESH_S, MAX_IMAGE_REFRESH_S)
    if (r === undefined) return { ok: false, error: `refresh_s must be a whole number of seconds, at least ${MIN_IMAGE_REFRESH_S}.` }
    refresh = r ?? DEFAULT_IMAGE_REFRESH_S
  }

  const attribution = cleanText(b.attribution, 200)
  if (attribution === undefined) return { ok: false, error: 'attribution must be text of at most 200 characters.' }

  return {
    ok: true,
    value: {
      provider: cam.provider,
      provider_ref: cam.provider_ref,
      page_url: cam.page_url,
      image_url: cam.image_url,
      stream_url: cam.stream_url,
      label,
      lat,
      lon,
      bearing_deg: bearing,
      fov_deg: bearing === null ? null : fov,
      delivery: cam.delivery,
      refresh_s: refresh,
      // Windy's terms fix its attribution; other sources take the caller's or their default.
      attribution: cam.provider === 'windy' ? WINDY_ATTRIBUTION : attribution ?? cam.attribution,
    },
  }
}

/** A view cone: apex at the camera, an arc CONE_RANGE_KM out across the field of view. */
export function viewCone(lon: number, lat: number, bearingDeg: number, fovDeg: number | null): number[][] {
  const fov = Math.min(360, Math.max(1, fovDeg ?? DEFAULT_CONE_FOV))
  const R = 6371
  const d = CONE_RANGE_KM / R
  const lat1 = (lat * Math.PI) / 180
  const lon1 = (lon * Math.PI) / 180
  const steps = Math.max(4, Math.ceil(fov / 10))
  const arc: number[][] = []
  for (let i = 0; i <= steps; i++) {
    const brg = ((bearingDeg - fov / 2 + (fov * i) / steps) * Math.PI) / 180
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg))
    const lon2 = lon1 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
    arc.push([Number((((lon2 * 180) / Math.PI + 540) % 360 - 180).toFixed(6)), Number(((lat2 * 180) / Math.PI).toFixed(6))])
  }
  if (fov >= 360) return [...arc.slice(0, -1), arc[0]]
  return [[lon, lat], ...arc, [lon, lat]]
}

/** The webcams layer: a point per located camera, plus a view cone where a bearing is set. */
export function webcamFeatureCollection(rows: WebcamRow[]): { type: 'FeatureCollection'; features: unknown[] } {
  const features: unknown[] = []
  for (const row of rows) {
    if (row.lat == null || row.lon == null) continue
    const cam = publicWebcam(row)
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [row.lon, row.lat] },
      properties: {
        id: cam.id,
        name: cam.label,
        provider: cam.provider,
        delivery: cam.delivery,
        attribution: cam.attribution,
        page_url: cam.page_url,
        bearing_deg: cam.bearing_deg,
        kind: 'webcam',
      },
    })
    if (row.bearing_deg != null) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [viewCone(row.lon, row.lat, row.bearing_deg, row.fov_deg)] },
        properties: { id: cam.id, name: cam.label, kind: 'view_cone' },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

/** Live (not removed) webcams of a session, oldest first; [] while the table is absent. */
export async function listSessionWebcams(db: D1Database, sessionId: string): Promise<WebcamRow[]> {
  try {
    const rows = await db.prepare(
      `SELECT ${WEBCAM_COLUMNS} FROM cop_webcams WHERE cop_session_id = ? AND archived_at IS NULL ORDER BY created_at ASC, id ASC LIMIT ${MAX_WEBCAMS_PER_SESSION}`
    ).bind(sessionId).all<WebcamRow>()
    return rows.results ?? []
  } catch (error) {
    if (webcamsTableMissing(error)) return []
    throw error
  }
}
