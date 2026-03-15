/**
 * COP Layer: Events GeoJSON
 *
 * GET /api/cop/:id/layers/events
 *
 * Returns a GeoJSON FeatureCollection of events within the COP session's
 * workspace, bounding box, and time window. Accepts optional query params:
 *   ?bbox=minLon,minLat,maxLon,maxLat  (overrides session bbox)
 *
 * Time filtering uses the session's rolling_hours or time_window_start/end.
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
    // 1. Look up the COP session for bbox/time config
    const session = await env.DB.prepare(
      `SELECT bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon,
              rolling_hours, time_window_start, time_window_end
       FROM cop_sessions WHERE id = ?`
    ).bind(sessionId).first()

    const workspaceId = access.workspace_id

    // 2. Determine bbox
    const bbox = parseBBoxParam(url.searchParams.get('bbox')) || sessionBBox(session)

    // 3. Build query
    let sql = `
      SELECT
        e.id, e.name, e.event_type, e.date_start, e.date_end,
        e.significance, e.confidence, e.description,
        e.coordinates
      FROM events e
      WHERE e.workspace_id = ?
        AND e.coordinates IS NOT NULL
    `
    const bindings: any[] = [workspaceId]

    // Bbox filter
    if (bbox) {
      sql += `
        AND CAST(json_extract(e.coordinates, '$.lng') AS REAL) >= ?
        AND CAST(json_extract(e.coordinates, '$.lng') AS REAL) <= ?
        AND CAST(json_extract(e.coordinates, '$.lat') AS REAL) >= ?
        AND CAST(json_extract(e.coordinates, '$.lat') AS REAL) <= ?
      `
      bindings.push(bbox.minLon, bbox.maxLon, bbox.minLat, bbox.maxLat)
    }

    // Time filter: rolling_hours takes precedence over explicit window
    if (session.rolling_hours) {
      const hours = Math.floor(Number(session.rolling_hours))
      if (!isNaN(hours) && hours > 0 && hours <= 8760) {
        sql += ` AND e.date_start >= datetime('now', ? || ' hours')`
        bindings.push(`-${hours}`)
      }
    } else if (session.time_window_start && session.time_window_end) {
      sql += ` AND e.date_start >= ? AND e.date_start <= ?`
      bindings.push(session.time_window_start, session.time_window_end)
    } else if (session.time_window_start) {
      sql += ` AND e.date_start >= ?`
      bindings.push(session.time_window_start)
    } else if (session.time_window_end) {
      sql += ` AND e.date_start <= ?`
      bindings.push(session.time_window_end)
    }

    sql += ' ORDER BY e.date_start DESC LIMIT 500'

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
          event_type: row.event_type,
          date_start: row.date_start,
          date_end: row.date_end,
          significance: row.significance,
          confidence: row.confidence,
          description: row.description,
          entity_type: 'event',
        },
      }
    }).filter(Boolean)

    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features,
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[COP Events Layer] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to load events layer',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
