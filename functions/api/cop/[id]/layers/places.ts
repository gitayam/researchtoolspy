/**
 * COP Layer: Places GeoJSON
 *
 * GET /api/cop/:id/layers/places
 *
 * Returns a GeoJSON FeatureCollection of places within the COP session's
 * workspace and bounding box. Accepts an optional ?bbox=minLon,minLat,maxLon,maxLat
 * query parameter that overrides the session bbox.
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

    // 2. Determine bbox: query param overrides session bbox
    const bbox = parseBBoxParam(url.searchParams.get('bbox')) || sessionBBox(session)

    // 3. Build query
    let sql = `
      SELECT
        p.id, p.name, p.place_type, p.country, p.region,
        p.strategic_importance, p.controlled_by, p.description,
        p.coordinates
      FROM places p
      WHERE p.workspace_id = ?
        AND p.coordinates IS NOT NULL
    `
    const bindings: any[] = [workspaceId]

    if (bbox) {
      sql += `
        AND CAST(json_extract(p.coordinates, '$.lng') AS REAL) >= ?
        AND CAST(json_extract(p.coordinates, '$.lng') AS REAL) <= ?
        AND CAST(json_extract(p.coordinates, '$.lat') AS REAL) >= ?
        AND CAST(json_extract(p.coordinates, '$.lat') AS REAL) <= ?
      `
      bindings.push(bbox.minLon, bbox.maxLon, bbox.minLat, bbox.maxLat)
    }

    sql += ' LIMIT 500'

    const results = await env.DB.prepare(sql).bind(...bindings).all()

    // 4. Convert to GeoJSON FeatureCollection
    const features = (results.results || []).map((row: any) => {
      let coords: { lat: number; lng: number } | null = null
      try {
        coords = typeof row.coordinates === 'string' ? JSON.parse(row.coordinates) : row.coordinates
      } catch {
        return null
      }
      if (!coords || coords.lat == null || coords.lng == null) return null

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [coords.lng, coords.lat],
        },
        properties: {
          id: row.id,
          name: row.name,
          place_type: row.place_type,
          country: row.country,
          region: row.region,
          strategic_importance: row.strategic_importance,
          controlled_by: row.controlled_by,
          description: row.description,
          entity_type: 'place',
        },
      }
    }).filter(Boolean)

    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features,
    }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Places Layer] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to load places layer',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
