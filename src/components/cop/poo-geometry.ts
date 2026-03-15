/**
 * POO (Point of Origin) Geometry Generator
 *
 * Pure utility that converts POO estimate data into GeoJSON features
 * for rendering max-range circles, probability sectors, approach vectors,
 * range rings, and min-range exclusion zones on a MapLibre GL map.
 */

import circle from '@turf/circle'
import sector from '@turf/sector'
import { featureCollection, point, lineString } from '@turf/helpers'

// ── Types ────────────────────────────────────────────────────────

export interface PooEstimate {
  id: string
  name: string
  description?: string
  impact_lat: number
  impact_lon: number
  max_range_km: number
  min_range_km?: number
  approach_bearing?: number    // degrees, direction drone came FROM (0-360)
  sector_width_deg?: number    // default 90
  confidence?: string          // CONFIRMED | PROBABLE | POSSIBLE | DOUBTFUL
  range_basis?: string         // e.g. "10km fiber optic spool"
  bearing_basis?: string       // e.g. "WNW approach observed in video"
  color?: string
  opacity?: number
}

// ── Helpers ──────────────────────────────────────────────────────

const CONFIDENCE_COLORS: Record<string, string> = {
  CONFIRMED: '#22c55e',
  PROBABLE: '#3b82f6',
  POSSIBLE: '#eab308',
  DOUBTFUL: '#ef4444',
}

function bearingToCardinal(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(((deg % 360 + 360) % 360) / 22.5) % 16]
}

/**
 * Compute a destination point given a start [lon, lat], bearing (degrees), and distance (km).
 * Simple spherical approximation — good enough for <100km.
 */
function destinationPoint(center: [number, number], bearingDeg: number, distanceKm: number): [number, number] {
  const R = 6371 // Earth radius km
  const lat1 = (center[1] * Math.PI) / 180
  const lon1 = (center[0] * Math.PI) / 180
  const brng = (bearingDeg * Math.PI) / 180
  const d = distanceKm / R

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng))
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))

  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]
}

// ── Generators ───────────────────────────────────────────────────

/**
 * Generate GeoJSON features for a single POO estimate:
 * - Max range circle (translucent fill)
 * - Mid-range rings at 25%, 50%, 75% (dashed reference lines)
 * - Probability sector (if approach_bearing provided)
 * - Approach vector line (bearing centerline)
 * - Min range exclusion circle (if min_range_km > 0)
 * - Impact point marker at center
 * - Range label points at ring intersections with bearing line
 */
export function generatePooFeatures(estimate: PooEstimate): GeoJSON.FeatureCollection {
  const center: [number, number] = [estimate.impact_lon, estimate.impact_lat]
  const features: GeoJSON.Feature[] = []
  const color = estimate.color || '#ef4444'
  const opacity = estimate.opacity ?? 0.15
  const confColor = CONFIDENCE_COLORS[estimate.confidence ?? ''] ?? color

  // 1. Max range circle
  const maxCircle = circle(center, estimate.max_range_km, {
    steps: 64,
    units: 'kilometers',
  })
  maxCircle.properties = {
    poo_id: estimate.id,
    poo_name: estimate.name,
    layer_type: 'max-range',
    color,
    opacity,
    stroke_color: color,
    stroke_opacity: 0.6,
    stroke_width: 2,
    confidence: estimate.confidence,
    range_basis: estimate.range_basis,
    max_range_km: estimate.max_range_km,
  }
  features.push(maxCircle)

  // 2. Mid-range reference rings (25%, 50%, 75%) — outline only, no fill
  const ringPercents = [0.25, 0.5, 0.75]
  for (const pct of ringPercents) {
    const ringRadius = estimate.max_range_km * pct
    const ring = circle(center, ringRadius, { steps: 48, units: 'kilometers' })
    ring.properties = {
      poo_id: estimate.id,
      layer_type: 'range-ring',
      color: 'transparent',
      opacity: 0,
      stroke_color: color,
      stroke_opacity: 0.2,
      stroke_width: 1,
      range_km: ringRadius,
    }
    features.push(ring)
  }

  // 3. Probability sector (if bearing is known)
  if (estimate.approach_bearing != null) {
    const bearing = estimate.approach_bearing
    const halfWidth = (estimate.sector_width_deg || 90) / 2
    const sectorFeature = sector(
      center,
      estimate.max_range_km,
      bearing - halfWidth,
      bearing + halfWidth,
      { steps: 64, units: 'kilometers' },
    )
    sectorFeature.properties = {
      poo_id: estimate.id,
      poo_name: estimate.name,
      layer_type: 'probability-sector',
      color: confColor,
      opacity: Math.min(opacity * 2.5, 0.5),
      stroke_color: confColor,
      stroke_opacity: 0.8,
      stroke_width: 2.5,
      bearing: estimate.approach_bearing,
      sector_width_deg: estimate.sector_width_deg ?? 90,
      bearing_basis: estimate.bearing_basis,
      bearing_cardinal: bearingToCardinal(bearing),
      confidence: estimate.confidence,
    }
    features.push(sectorFeature)

    // 4. Approach vector line — from impact point along bearing to max range
    const endpoint = destinationPoint(center, bearing, estimate.max_range_km)
    const vectorLine = lineString([center, endpoint], {
      poo_id: estimate.id,
      layer_type: 'approach-vector',
      color: confColor,
      stroke_opacity: 0.7,
      stroke_width: 2,
      bearing: bearing,
      bearing_cardinal: bearingToCardinal(bearing),
    })
    features.push(vectorLine)

    // 5. Range label points along bearing line
    const labelDistances = [
      { km: estimate.max_range_km, label: `${estimate.max_range_km}km` },
      { km: estimate.max_range_km * 0.5, label: `${(estimate.max_range_km * 0.5).toFixed(1)}km` },
    ]
    for (const ld of labelDistances) {
      const labelPos = destinationPoint(center, bearing, ld.km)
      features.push(point(labelPos, {
        poo_id: estimate.id,
        layer_type: 'range-label',
        label: ld.label,
        color,
      }))
    }
  }

  // 6. Min range exclusion ring (if set)
  if (estimate.min_range_km && estimate.min_range_km > 0) {
    const minCircle = circle(center, estimate.min_range_km, {
      steps: 48,
      units: 'kilometers',
    })
    minCircle.properties = {
      poo_id: estimate.id,
      poo_name: estimate.name,
      layer_type: 'min-range',
      color: '#1e293b',
      opacity: 0.4,
      stroke_color: color,
      stroke_opacity: 0.5,
      stroke_width: 1.5,
      min_range_km: estimate.min_range_km,
    }
    features.push(minCircle)
  }

  // 7. Impact point marker
  const impactPoint = point(center, {
    poo_id: estimate.id,
    poo_name: estimate.name,
    layer_type: 'impact-point',
    name: `⊕ ${estimate.name}`,
    description: estimate.description,
    color,
    confidence: estimate.confidence,
    max_range_km: estimate.max_range_km,
    min_range_km: estimate.min_range_km,
    approach_bearing: estimate.approach_bearing,
    sector_width_deg: estimate.sector_width_deg,
    range_basis: estimate.range_basis,
    bearing_basis: estimate.bearing_basis,
    bearing_cardinal: estimate.approach_bearing != null ? bearingToCardinal(estimate.approach_bearing) : undefined,
    entity_type: 'poo-estimate',
  })
  features.push(impactPoint)

  return featureCollection(features)
}

/**
 * Convert API response (array of point features with POO properties)
 * into a polygon+line+point FeatureCollection for map rendering.
 */
export function convertPooLayerData(
  apiResponse: GeoJSON.FeatureCollection,
): GeoJSON.FeatureCollection {
  const allFeatures: GeoJSON.Feature[] = []

  for (const f of apiResponse.features) {
    const props = f.properties as Record<string, unknown> | null
    if (!props) continue

    const geom = f.geometry as GeoJSON.Point
    if (!geom || geom.type !== 'Point') continue

    const estimate: PooEstimate = {
      id: String(props.id ?? ''),
      name: String(props.name ?? 'Untitled'),
      description: props.description ? String(props.description) : undefined,
      impact_lat: geom.coordinates[1],
      impact_lon: geom.coordinates[0],
      max_range_km: Number(props.max_range_km) || 10,
      min_range_km: props.min_range_km ? Number(props.min_range_km) : undefined,
      approach_bearing: props.approach_bearing != null ? Number(props.approach_bearing) : undefined,
      sector_width_deg: props.sector_width_deg ? Number(props.sector_width_deg) : undefined,
      confidence: props.confidence ? String(props.confidence) : undefined,
      range_basis: props.range_basis ? String(props.range_basis) : undefined,
      bearing_basis: props.bearing_basis ? String(props.bearing_basis) : undefined,
      color: props.color ? String(props.color) : undefined,
      opacity: props.opacity != null ? Number(props.opacity) : undefined,
    }

    const pooFeatures = generatePooFeatures(estimate)
    allFeatures.push(...pooFeatures.features)
  }

  return featureCollection(allFeatures)
}
