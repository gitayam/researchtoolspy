/**
 * COP Layer: Relationships GeoJSON (LineStrings)
 *
 * GET /api/cop/:id/layers/relationships
 *
 * Returns a GeoJSON FeatureCollection of LineString geometries representing
 * relationships between places (both endpoints must have coordinates).
 * Accepts optional query params:
 *   ?bbox=minLon,minLat,maxLon,maxLat  (overrides session bbox)
 *
 * Only PLACE-to-PLACE relationships are included since both endpoints need
 * spatial coordinates to render a line on the map.
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

interface BBox {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

function parseBBoxParam(param: string | null): BBox | null {
  if (!param) return null
  const parts = param.split(',').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return null
  return { minLon: parts[0], minLat: parts[1], maxLon: parts[2], maxLat: parts[3] }
}

function sessionBBox(session: any): BBox | null {
  if (
    session.bbox_min_lon != null &&
    session.bbox_min_lat != null &&
    session.bbox_max_lon != null &&
    session.bbox_max_lat != null
  ) {
    return {
      minLon: session.bbox_min_lon,
      minLat: session.bbox_min_lat,
      maxLon: session.bbox_max_lon,
      maxLat: session.bbox_max_lat,
    }
  }
  return null
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)

  try {
    // 1. Look up the COP session
    const session = await env.DB.prepare(
      'SELECT workspace_id, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first()

    if (!session) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404,
        headers: corsHeaders,
      })
    }

    const workspaceId = session.workspace_id as string

    // 2. Determine bbox
    const bbox = parseBBoxParam(url.searchParams.get('bbox')) || sessionBBox(session)

    // 3. Build query: relationships between two places, both with coordinates
    let sql = `
      SELECT
        r.id, r.relationship_type, r.confidence,
        r.source_entity_id, r.target_entity_id,
        r.description,
        src.name AS source_name,
        tgt.name AS target_name,
        src.coordinates AS src_coordinates,
        tgt.coordinates AS tgt_coordinates
      FROM relationships r
      INNER JOIN places src
        ON src.id = r.source_entity_id
        AND src.coordinates IS NOT NULL
      INNER JOIN places tgt
        ON tgt.id = r.target_entity_id
        AND tgt.coordinates IS NOT NULL
      WHERE r.workspace_id = ?
        AND r.source_entity_type = 'PLACE'
        AND r.target_entity_type = 'PLACE'
    `
    const bindings: any[] = [workspaceId]

    // Bbox filter: at least one endpoint must be within the bbox
    if (bbox) {
      sql += `
        AND (
          (
            CAST(json_extract(src.coordinates, '$.lng') AS REAL) >= ?
            AND CAST(json_extract(src.coordinates, '$.lng') AS REAL) <= ?
            AND CAST(json_extract(src.coordinates, '$.lat') AS REAL) >= ?
            AND CAST(json_extract(src.coordinates, '$.lat') AS REAL) <= ?
          )
          OR
          (
            CAST(json_extract(tgt.coordinates, '$.lng') AS REAL) >= ?
            AND CAST(json_extract(tgt.coordinates, '$.lng') AS REAL) <= ?
            AND CAST(json_extract(tgt.coordinates, '$.lat') AS REAL) >= ?
            AND CAST(json_extract(tgt.coordinates, '$.lat') AS REAL) <= ?
          )
        )
      `
      bindings.push(
        bbox.minLon, bbox.maxLon, bbox.minLat, bbox.maxLat,
        bbox.minLon, bbox.maxLon, bbox.minLat, bbox.maxLat
      )
    }

    sql += ' LIMIT 200'

    let results: any
    try {
      results = await env.DB.prepare(sql).bind(...bindings).all()
    } catch (dbError) {
      // Table or column may not exist — return empty FeatureCollection
      console.warn('[COP Relationships Layer] DB query failed:', dbError)
      return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { headers: corsHeaders })
    }

    // 4. Convert to GeoJSON FeatureCollection with LineString geometries
    const features = (results.results || []).map((row: any) => {
      let srcCoords: { lat: number; lng: number } | null = null
      let tgtCoords: { lat: number; lng: number } | null = null
      try {
        srcCoords = typeof row.src_coordinates === 'string'
          ? JSON.parse(row.src_coordinates) : row.src_coordinates
        tgtCoords = typeof row.tgt_coordinates === 'string'
          ? JSON.parse(row.tgt_coordinates) : row.tgt_coordinates
      } catch {
        return null
      }
      if (
        !srcCoords || srcCoords.lat == null || srcCoords.lng == null ||
        !tgtCoords || tgtCoords.lat == null || tgtCoords.lng == null
      ) return null

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [srcCoords.lng, srcCoords.lat],
            [tgtCoords.lng, tgtCoords.lat],
          ],
        },
        properties: {
          id: row.id,
          relationship_type: row.relationship_type,
          confidence: row.confidence,
          description: row.description,
          source_id: row.source_entity_id,
          target_id: row.target_entity_id,
          source_name: row.source_name,
          target_name: row.target_name,
          entity_type: 'relationship',
        },
      }
    }).filter(Boolean)

    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features,
    }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Relationships Layer] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to load relationships layer',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
