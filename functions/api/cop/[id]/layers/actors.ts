/**
 * COP Layer: Actors GeoJSON
 *
 * GET /api/cop/:id/layers/actors
 *
 * Returns a GeoJSON FeatureCollection of actors that have a LOCATED_AT
 * relationship to a place with coordinates. Accepts optional query params:
 *   ?bbox=minLon,minLat,maxLon,maxLat  (overrides session bbox)
 *
 * Actors don't have their own coordinates column, so we JOIN through
 * relationships (LOCATED_AT) to places to derive spatial position.
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { verifyCopLayerAccess } from '../../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
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

  // Auth: public sessions open, private sessions require owner/collaborator
  const access = await verifyCopLayerAccess(env.DB, sessionId, request, env)
  if (access instanceof Response) return access

  try {
    // 1. Look up the COP session for bbox
    const session = await env.DB.prepare(
      'SELECT bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first()

    const workspaceId = access.workspace_id

    // 2. Determine bbox
    const bbox = parseBBoxParam(url.searchParams.get('bbox')) || sessionBBox(session)

    // 3. Build query: actors -> LOCATED_AT relationships -> places
    let sql = `
      SELECT
        a.id, a.name, a.type AS actor_type, a.category, a.affiliation, a.description,
        p.name AS location_name,
        p.coordinates
      FROM actors a
      INNER JOIN relationships r
        ON r.source_entity_id = a.id
        AND r.source_entity_type = 'ACTOR'
        AND r.target_entity_type = 'PLACE'
        AND r.relationship_type = 'LOCATED_AT'
      INNER JOIN places p
        ON p.id = r.target_entity_id
        AND p.coordinates IS NOT NULL
      WHERE a.workspace_id = ?
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
          actor_type: row.actor_type,
          category: row.category,
          affiliation: row.affiliation,
          description: row.description,
          location_name: row.location_name,
          entity_type: 'actor',
        },
      }
    }).filter(Boolean)

    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features,
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[COP Actors Layer] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to load actors layer',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
