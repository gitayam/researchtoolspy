/**
 * COP Layer: Assets GeoJSON
 *
 * GET /api/cop/:id/layers/assets
 *
 * Returns a GeoJSON FeatureCollection of assets that have non-null lat/lon.
 * Accepts optional query params:
 *   ?bbox=minLon,minLat,maxLon,maxLat
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

    // 2. Determine bbox
    const bbox = parseBBoxParam(url.searchParams.get('bbox')) || sessionBBox(session)

    // 3. Build query
    let sql = `
      SELECT id, name, asset_type, status, sensitivity, location, lat, lon, details
      FROM cop_assets
      WHERE cop_session_id = ? AND lat IS NOT NULL AND lon IS NOT NULL
    `
    const bindings: any[] = [sessionId]

    if (bbox) {
      sql += ' AND lon >= ? AND lon <= ? AND lat >= ? AND lat <= ?'
      bindings.push(bbox.minLon, bbox.maxLon, bbox.minLat, bbox.maxLat)
    }

    sql += ' LIMIT 500'

    const results = await env.DB.prepare(sql).bind(...bindings).all()

    // 4. Convert to GeoJSON FeatureCollection
    const features = (results.results || []).map((row: any) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [row.lon, row.lat],
      },
      properties: {
        id: row.id,
        name: row.name,
        asset_type: row.asset_type,
        status: row.status,
        sensitivity: row.sensitivity,
        location: row.location,
        entity_type: 'asset',
      },
    }))

    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features,
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[COP Assets Layer] Error:', error)
    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features: [],
    }), { headers: JSON_HEADERS })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
