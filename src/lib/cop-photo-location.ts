/**
 * A photo's own location in the team's COP workspace (decision 2026-10-23).
 *
 * The server keeps a photo's GPS position for the team and places a POSSIBLE "Photo
 * location" marker there (source PHOTO_GPS). The team's evidence list carries
 * `photo_location: { marker_id, lat, lon, confirmed }` for such an item; nobody else's
 * does, and the public share never shows it. The evidence card turns it into a link
 * that opens the map at the marker.
 */

export interface PhotoLocationLink {
  markerId: string
  lat: number
  lon: number
  confirmed: boolean
}

/** The evidence row's photo location, or null when absent or not a usable position. */
export function photoLocationFor(row: unknown): PhotoLocationLink | null {
  if (!row || typeof row !== 'object') return null
  const raw = (row as { photo_location?: unknown }).photo_location
  if (!raw || typeof raw !== 'object') return null
  const { marker_id, lat, lon, confirmed } = raw as Record<string, unknown>
  if (typeof marker_id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(marker_id)) return null
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { markerId: marker_id, lat, lon, confirmed: confirmed === true }
}

/** The card's link text and its accessible description. */
export function photoLocationLabel(link: PhotoLocationLink): { text: string; title: string } {
  return {
    text: 'Photo location',
    title: link.confirmed
      ? 'Show where the photo was taken on the map (confirmed marker)'
      : 'Show where the photo says it was taken on the map (possible marker, team only until confirmed)',
  }
}

// ── Opening the map at a point ────────────────────────────────────

export const COP_MAP_FOCUS_EVENT = 'cop:map-focus'

export interface CopMapFocus {
  lat: number
  lon: number
  markerId?: string
}

let pending: CopMapFocus | null = null

/** Ask the workspace to show the map and centre it on a point (the map may mount later). */
export function focusCopMap(target: CopMapFocus): void {
  pending = target
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<CopMapFocus>(COP_MAP_FOCUS_EVENT, { detail: target }))
}

/** The focus asked for before the map was ready, once. */
export function takePendingMapFocus(): CopMapFocus | null {
  const target = pending
  pending = null
  return target
}
