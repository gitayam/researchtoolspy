/**
 * COP webcams: input validation, the fields a client sees, editor checks and the
 * map geometry shared by the webcams routes, the webcams layer and the public share.
 *
 * The cop_webcams table comes from managed migration 0020. Until it is applied,
 * writes answer 503 WEBCAMS_UNAVAILABLE and reads answer an empty list or layer.
 * Migration 0021 adds where each camera's facts came from (source_url, windy_status,
 * status_checked_at, position_source, bearing_source); until it is applied, reads use
 * the 0020 columns (the new fields read as null) and writes leave them out.
 */
import {
  parseWebcamUrl,
  webcamEmbedUrl,
  WINDY_ATTRIBUTION,
  type WebcamDelivery,
  type WebcamLinkError,
  type WebcamProvider,
} from './webcam-url'
import { JSON_HEADERS } from './api-utils'

export const WEBCAMS_UNAVAILABLE = 'WEBCAMS_UNAVAILABLE'
export const WEBCAM_DUPLICATE = 'WEBCAM_DUPLICATE'
export const WEBCAM_LIMIT = 'WEBCAM_LIMIT'
export const MAX_WEBCAMS_PER_SESSION = 200
export const DEFAULT_IMAGE_REFRESH_S = 60
export const MIN_IMAGE_REFRESH_S = 30
const MAX_IMAGE_REFRESH_S = 86_400
const DEFAULT_CONE_FOV = 60
const CONE_RANGE_KM = 1.5

/** The 0020 columns a client may read. Never created_by. */
export const WEBCAM_COLUMNS_V1 =
  'id, provider, provider_ref, page_url, image_url, stream_url, label, lat, lon, ' +
  'bearing_deg, fov_deg, delivery, refresh_s, attribution, created_at'

/** Every column a client may read, with migration 0021's. Never created_by. */
export const WEBCAM_COLUMNS =
  `${WEBCAM_COLUMNS_V1}, source_url, windy_status, status_checked_at, position_source, bearing_source`

export type PositionSource = 'user' | 'windy'
export type BearingSource = 'user' | 'estimated'

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
  source_url?: string | null
  windy_status?: string | null
  status_checked_at?: string | null
  position_source?: PositionSource | null
  bearing_source?: BearingSource | null
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
  source_url: string | null
  windy_status: string | null
  status_checked_at: string | null
  position_source: PositionSource | null
  bearing_source: BearingSource | null
}

export function webcamsTableMissing(error: unknown): boolean {
  return /no such table:\s*(?:main\.)?cop_webcams\b/i.test(String(error instanceof Error ? error.message : error))
}

/** Migration 0021 is not applied yet: a read or write named one of its columns. */
export function webcamColumnsMissing(error: unknown): boolean {
  return /no such column|has no column named/i.test(String(error instanceof Error ? error.message : error))
}

/** The live-source unique index (migration 0020) refused a second row for one camera. */
export function webcamDuplicate(error: unknown): boolean {
  const message = String(error instanceof Error ? error.message : error)
  return /UNIQUE constraint failed/i.test(message) && /idx_cop_webcams_live_source/.test(message)
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
  return { ...(out as unknown as WebcamRow), embed_url: webcamEmbedUrl(row.provider, row.provider_ref, row.delivery) }
}

/**
 * Rows of cop_webcams for `tail` (a WHERE/ORDER/LIMIT clause): every client column,
 * or the 0020 ones while migration 0021 is pending.
 */
export async function selectWebcams(db: D1Database, tail: string, binds: unknown[]): Promise<WebcamRow[]> {
  try {
    const rows = await db.prepare(`SELECT ${WEBCAM_COLUMNS} FROM cop_webcams ${tail}`).bind(...binds).all<WebcamRow>()
    return rows.results ?? []
  } catch (error) {
    if (!webcamColumnsMissing(error)) throw error
    const rows = await db.prepare(`SELECT ${WEBCAM_COLUMNS_V1} FROM cop_webcams ${tail}`).bind(...binds).all<WebcamRow>()
    return rows.results ?? []
  }
}

/** One live webcam of a session, or null. */
export async function getSessionWebcam(db: D1Database, sessionId: string, camId: string): Promise<WebcamRow | null> {
  const rows = await selectWebcams(db, 'WHERE id = ? AND cop_session_id = ? AND archived_at IS NULL LIMIT 1', [camId, sessionId])
  return rows[0] ?? null
}

/**
 * Insert a webcam if the session holds fewer than MAX_WEBCAMS_PER_SESSION (checked in
 * the INSERT itself, so parallel adds cannot pass it together). Returns false when the
 * session is full. Throws the D1 error otherwise (duplicates, a missing table).
 */
export async function insertWebcam(
  db: D1Database,
  id: string,
  sessionId: string,
  cam: WebcamInput,
  userId: number,
  now: string,
): Promise<boolean> {
  const base = [
    id, sessionId, cam.provider, cam.provider_ref, cam.page_url, cam.image_url, cam.stream_url,
    cam.label, cam.lat, cam.lon, cam.bearing_deg, cam.fov_deg, cam.delivery, cam.refresh_s, cam.attribution,
    userId, now,
  ]
  const cap = [sessionId, MAX_WEBCAMS_PER_SESSION]
  const v1Columns = 'id, cop_session_id, provider, provider_ref, page_url, image_url, stream_url, ' +
    'label, lat, lon, bearing_deg, fov_deg, delivery, refresh_s, attribution, created_by, created_at'
  const capClause = 'WHERE (SELECT COUNT(*) FROM cop_webcams WHERE cop_session_id = ? AND archived_at IS NULL) < ?'
  try {
    const result = await db.prepare(`
      INSERT INTO cop_webcams (${v1Columns}, source_url, windy_status, status_checked_at, position_source, bearing_source)
      SELECT ${Array(22).fill('?').join(', ')}
      ${capClause}
    `).bind(
      ...base, cam.source_url, cam.windy_status, cam.status_checked_at, cam.position_source, cam.bearing_source, ...cap,
    ).run()
    return Boolean(result.meta?.changes)
  } catch (error) {
    if (!webcamColumnsMissing(error)) throw error
    const result = await db.prepare(`
      INSERT INTO cop_webcams (${v1Columns})
      SELECT ${Array(17).fill('?').join(', ')}
      ${capClause}
    `).bind(...base, ...cap).run()
    return Boolean(result.meta?.changes)
  }
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

export function optionalNumber(value: unknown): number | null | undefined {
  // undefined: not a number at all; null: absent.
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(n) ? n : undefined
}

export function optionalInteger(value: unknown, min: number, max: number): number | null | undefined {
  const n = optionalNumber(value)
  if (n === null || n === undefined) return n
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined
}

export function cleanText(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return undefined
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length > max) return undefined
  return text || null
}

export type WebcamInputResult =
  | { ok: true; value: WebcamInput; error?: undefined; code?: undefined }
  | { ok: false; error: string; code: WebcamLinkError; value?: undefined }

/**
 * Validate a POST body. `extraHosts` is COP_WEBCAM_EXTRA_HOSTS. A Windy camera may
 * omit its label (value.label is then ''): the route fills it from Windy's title, or
 * from the id when Windy cannot be asked.
 */
export function validateWebcamInput(body: unknown, extraHosts?: string | null): WebcamInputResult {
  const bad = (error: string): WebcamInputResult => ({ ok: false, error, code: 'WEBCAM_INVALID' })
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('Expected a JSON object.')
  const b = body as Record<string, unknown>

  const parsed = parseWebcamUrl(b.url, extraHosts)
  if (!parsed.ok) return { ok: false, error: parsed.error, code: parsed.code }
  const cam = parsed.cam

  const label = cleanText(b.label, 120)
  if (label === undefined) return bad('label must be text of at most 120 characters.')
  if (!label && cam.provider !== 'windy') return bad('label is required.')

  const lat = optionalNumber(b.lat)
  const lon = optionalNumber(b.lon)
  if (lat === undefined || (lat !== null && (lat < -90 || lat > 90))) return bad('lat must be between -90 and 90.')
  if (lon === undefined || (lon !== null && (lon < -180 || lon > 180))) return bad('lon must be between -180 and 180.')
  if ((lat === null) !== (lon === null)) return bad('Give both lat and lon, or neither.')

  const bearing = optionalInteger(b.bearing_deg, 0, 359)
  if (bearing === undefined) return bad('bearing_deg must be a whole number from 0 to 359.')
  const fov = optionalInteger(b.fov_deg, 1, 360)
  if (fov === undefined) return bad('fov_deg must be a whole number from 1 to 360.')

  let refresh: number | null = null
  if (cam.provider === 'image') {
    const r = optionalInteger(b.refresh_s, MIN_IMAGE_REFRESH_S, MAX_IMAGE_REFRESH_S)
    if (r === undefined) return bad(`refresh_s must be a whole number of seconds, at least ${MIN_IMAGE_REFRESH_S}.`)
    refresh = r ?? DEFAULT_IMAGE_REFRESH_S
  }

  const attribution = cleanText(b.attribution, 200)
  if (attribution === undefined) return bad('attribution must be text of at most 200 characters.')

  return {
    ok: true,
    value: {
      provider: cam.provider,
      provider_ref: cam.provider_ref,
      page_url: cam.page_url,
      image_url: cam.image_url,
      stream_url: cam.stream_url,
      label: label ?? '',
      lat,
      lon,
      bearing_deg: bearing,
      fov_deg: bearing === null ? null : fov,
      delivery: cam.delivery,
      refresh_s: refresh,
      // A source whose terms require a credit (Windy, an allow-listed host's licence) always
      // shows it; only sources without one take the caller's text.
      attribution: cam.provider === 'windy' ? WINDY_ATTRIBUTION : cam.attribution ?? attribution,
      source_url: null,
      windy_status: null,
      status_checked_at: null,
      position_source: lat === null ? null : 'user',
      bearing_source: bearing === null ? null : 'user',
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
        bearing_source: cam.bearing_source,
        windy_status: cam.windy_status,
        kind: 'webcam',
      },
    })
    if (row.bearing_deg != null) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [viewCone(row.lon, row.lat, row.bearing_deg, row.fov_deg)] },
        properties: { id: cam.id, name: cam.label, bearing_source: cam.bearing_source, kind: 'view_cone' },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

/** Live (not removed) webcams of a session, oldest first; [] while the table is absent. */
export async function listSessionWebcams(db: D1Database, sessionId: string): Promise<WebcamRow[]> {
  try {
    return await selectWebcams(
      db,
      `WHERE cop_session_id = ? AND archived_at IS NULL ORDER BY created_at ASC, id ASC LIMIT ${MAX_WEBCAMS_PER_SESSION}`,
      [sessionId],
    )
  } catch (error) {
    if (webcamsTableMissing(error)) return []
    throw error
  }
}
