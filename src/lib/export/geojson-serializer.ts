/**
 * GeoJSON Bundle Serializer
 *
 * Generates one FeatureCollection per active layer plus a metadata.json
 * with session info, bbox, and feature counts.
 *
 * Pure function: takes data objects, returns strings. No D1 access.
 */

export interface GeoJsonBundle {
  /** Map of layerId.geojson -> GeoJSON string */
  layers: Record<string, string>
  /** Session metadata JSON string */
  metadata: string
}

export interface GeoJsonSessionInput {
  id: string
  name: string
  template_type?: string
  bbox_min_lat?: number | null
  bbox_min_lon?: number | null
  bbox_max_lat?: number | null
  bbox_max_lon?: number | null
  created_at?: string
  updated_at?: string
}

export interface FeatureCollectionInput {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: { type: string; coordinates: unknown }
    properties: Record<string, unknown>
  }>
}

export function serializeGeoJsonBundle(
  session: GeoJsonSessionInput,
  layerData: Record<string, FeatureCollectionInput>
): GeoJsonBundle {
  const layers: Record<string, string> = {}

  for (const [layerId, featureCollection] of Object.entries(layerData)) {
    layers[`${layerId}.geojson`] = JSON.stringify(featureCollection, null, 2)
  }

  const hasBbox =
    session.bbox_min_lat != null &&
    session.bbox_min_lon != null &&
    session.bbox_max_lat != null &&
    session.bbox_max_lon != null

  const metadata = JSON.stringify(
    {
      session_id: session.id,
      session_name: session.name,
      template_type: session.template_type ?? null,
      exported_at: new Date().toISOString(),
      bbox: hasBbox
        ? {
            min_lat: session.bbox_min_lat,
            min_lon: session.bbox_min_lon,
            max_lat: session.bbox_max_lat,
            max_lon: session.bbox_max_lon,
          }
        : null,
      layer_count: Object.keys(layers).length,
      feature_counts: Object.fromEntries(
        Object.entries(layerData).map(([id, fc]) => [id, fc.features?.length ?? 0])
      ),
      total_features: Object.values(layerData).reduce(
        (sum, fc) => sum + (fc.features?.length ?? 0),
        0
      ),
    },
    null,
    2
  )

  return { layers, metadata }
}
