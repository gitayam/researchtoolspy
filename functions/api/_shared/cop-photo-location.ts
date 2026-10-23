/**
 * Map markers placed from a photo's own GPS position (decision 2026-10-23).
 *
 * A photo filed as COP evidence whose team copy kept a valid position gets ONE marker:
 * confidence POSSIBLE, source_type PHOTO_GPS, source_id the evidence item, label
 * "Photo location", source_channel the evidence's own (web, signal, drop). Editors
 * confirm, move or delete it like any other possible marker.
 *
 * Until an editor CONFIRMS it, the marker is the team's only (owner and collaborators):
 * every route a share link, an anonymous reader of a public session or a signed-in
 * non-collaborator reads drops it entirely — its position is the photo's GPS — the
 * markers layer, the CoT feed, the markers list and the marker changelog
 * (teamOnlyPhotoMarker / PUBLIC_MARKERS_SQL). Once CONFIRMED it shows like any marker.
 * PROBABLE, SUSPECTED and DOUBTFUL stay team-only: "confirmed" is the editor's call.
 *
 * Dedupe: one per evidence item, checked in the INSERT (insertCopMarkerOnce) and backed
 * by a unique partial index (managed migration 0029).
 */
import { insertCopMarkerOnce, type CopSessionScope, type SourceChannel } from './cop-records'
import type { StoredLocation } from './cop-uploads'

export const PHOTO_GPS_SOURCE = 'PHOTO_GPS'
export const PHOTO_LOCATION_LABEL = 'Photo location'

/** A photo-location marker no editor has confirmed: never shown outside the team. */
export function teamOnlyPhotoMarker(row: { source_type?: unknown; confidence?: unknown }): boolean {
  return String(row.source_type ?? '').toUpperCase() === PHOTO_GPS_SOURCE && row.confidence !== 'CONFIRMED'
}

/** SQL for the markers a non-collaborator may see (alias-free; for `FROM cop_markers`). */
export const PUBLIC_MARKERS_SQL = `(source_type IS NULL OR upper(source_type) != '${PHOTO_GPS_SOURCE}' OR confidence = 'CONFIRMED')`

/**
 * Place the possible marker for a photo's position, once per evidence item. Returns the
 * new marker's id, or null when the item already has one (or the position is unusable).
 */
export async function placePhotoMarker(
  db: D1Database,
  scope: CopSessionScope,
  input: { evidenceId: string | number; location: StoredLocation; sourceChannel: SourceChannel; createdBy: number },
): Promise<string | null> {
  const { lat, lon } = input.location
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null
  const taken = input.location.capturedAt ? `, taken ${input.location.capturedAt}` : ''
  return insertCopMarkerOnce(db, scope, {
    lat,
    lon,
    label: PHOTO_LOCATION_LABEL,
    description: `Where the photo says it was taken (its own GPS data${taken}). Not verified.`,
    confidence: 'POSSIBLE',
    rationale: 'Position from the GPS data in a photo; not verified.',
    sourceType: PHOTO_GPS_SOURCE,
    sourceId: String(input.evidenceId),
    sourceChannel: input.sourceChannel,
    createdBy: input.createdBy,
  })
}

/** Placing the marker never costs the caller its upload or tip: failures are logged and dropped. */
export async function placePhotoMarkerQuietly(
  db: D1Database,
  scope: CopSessionScope,
  input: Parameters<typeof placePhotoMarker>[2],
): Promise<string | null> {
  try {
    return await placePhotoMarker(db, scope, input)
  } catch (error) {
    console.error('[cop-photo-location] marker not placed:', error instanceof Error ? error.message : error)
    return null
  }
}

export interface PhotoLocationLink {
  marker_id: string
  lat: number
  lon: number
  confirmed: boolean
}

/**
 * The photo-location marker of each evidence item in a session, for the team's evidence
 * list (collaborators only — never call this for anyone else).
 */
export async function photoMarkersByEvidence(db: D1Database, sessionId: string): Promise<Map<string, PhotoLocationLink>> {
  const out = new Map<string, PhotoLocationLink>()
  const rows = await db.prepare(
    `SELECT id, source_id, lat, lon, confidence FROM cop_markers WHERE cop_session_id = ? AND upper(source_type) = '${PHOTO_GPS_SOURCE}' ORDER BY created_at ASC`
  ).bind(sessionId).all<{ id: string; source_id: string | null; lat: number; lon: number; confidence: string | null }>()
  for (const row of rows.results ?? []) {
    if (!row.source_id || out.has(String(row.source_id))) continue
    out.set(String(row.source_id), { marker_id: String(row.id), lat: Number(row.lat), lon: Number(row.lon), confirmed: row.confidence === 'CONFIRMED' })
  }
  return out
}
