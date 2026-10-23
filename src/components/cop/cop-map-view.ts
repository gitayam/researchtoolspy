/**
 * Where a COP map opens.
 *
 * A session with a stored center keeps it. A session without one (center_lat/center_lon
 * null — e.g. a COP made from a Signal room) opens fitted to its OWN content: markers,
 * webcams, entities, assets, estimates — never the external feeds (ACLED, GDELT), whose
 * worldwide events would decide the view. Until the user moves the map, the view
 * follows that content as more of it loads. With no content of its own, the map falls
 * back to fitting whatever loads, as before.
 */

export interface MapBounds {
  west: number
  south: number
  east: number
  north: number
}

export type OpeningView =
  | { kind: 'point'; center: [number, number]; zoom: number }
  | { kind: 'bounds'; bounds: [[number, number], [number, number]]; maxZoom: number; padding: number }

/** The closest a fit to the COP's own content zooms in (a street, not a doorstep). */
export const CONTENT_MAX_ZOOM = 14
/** Below this span (degrees) a set of points is treated as one place. */
const POINT_SPAN = 0.0005

/** The world view a map without a stored center starts from, before content arrives. */
export const WORLD_VIEW = { center: [0, 20] as [number, number], zoom: 1.5 }

export function hasStoredView(session: { center_lat?: number | null; center_lon?: number | null }): boolean {
  const lat = session.center_lat
  const lon = session.center_lon
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) return false
  // 0,0 is what an unset center used to become; nobody runs a COP from Null Island.
  return !(lat === 0 && lon === 0)
}

type Position = number[]
interface GeometryLike {
  type: string
  coordinates?: unknown
}
interface FeatureCollectionLike {
  features?: readonly { geometry?: GeometryLike | null }[]
}

function positions(geometry: GeometryLike | null | undefined): Position[] {
  if (!geometry || !Array.isArray(geometry.coordinates)) return []
  const c = geometry.coordinates as unknown
  switch (geometry.type) {
    case 'Point': return [c as Position]
    case 'MultiPoint':
    case 'LineString': return c as Position[]
    case 'MultiLineString':
    case 'Polygon': return (c as Position[][]).flat()
    case 'MultiPolygon': return (c as Position[][][]).flat(2)
    default: return []
  }
}

const validPosition = (p: Position): boolean =>
  Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[1]) <= 90 && Math.abs(p[0]) <= 180

/** The bounds of every feature in the layers `include` accepts, or null when there are none. */
export function contentBounds(
  layers: Record<string, FeatureCollectionLike | undefined>,
  include: (layerId: string) => boolean,
): MapBounds | null {
  let bounds: MapBounds | null = null
  for (const [layerId, fc] of Object.entries(layers)) {
    if (!include(layerId)) continue
    for (const feature of fc?.features ?? []) {
      for (const p of positions(feature.geometry)) {
        if (!validPosition(p)) continue
        const [lon, lat] = p
        bounds = bounds
          ? { west: Math.min(bounds.west, lon), south: Math.min(bounds.south, lat), east: Math.max(bounds.east, lon), north: Math.max(bounds.north, lat) }
          : { west: lon, south: lat, east: lon, north: lat }
      }
    }
  }
  return bounds
}

/** How to show some bounds: one place at street level, or a fit with padding. */
export function openingView(bounds: MapBounds): OpeningView {
  if (bounds.east - bounds.west < POINT_SPAN && bounds.north - bounds.south < POINT_SPAN) {
    return { kind: 'point', center: [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2], zoom: CONTENT_MAX_ZOOM }
  }
  return { kind: 'bounds', bounds: [[bounds.west, bounds.south], [bounds.east, bounds.north]], maxZoom: CONTENT_MAX_ZOOM, padding: 50 }
}

/** A stable key for some bounds, so the same content isn't refitted on every refresh. */
export function boundsKey(bounds: MapBounds): string {
  return [bounds.west, bounds.south, bounds.east, bounds.north].map((n) => n.toFixed(5)).join(',')
}
