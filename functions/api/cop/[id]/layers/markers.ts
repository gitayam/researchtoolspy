/**
 * COP Layer: Markers GeoJSON
 *
 * GET /api/cop/:id/layers/markers
 *
 * Returns a GeoJSON FeatureCollection of non-stale tactical markers
 * for the given COP session. Markers with a stale_time in the past
 * are excluded (unless stale_time is NULL, which means persistent).
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { verifyCopLayerAccess } from '../../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}


export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  // Auth: public sessions open, private sessions require owner/collaborator
  const access = await verifyCopLayerAccess(env.DB, sessionId, request, env)
  if (access instanceof Response) return access

  try {
    const rows = await env.DB.prepare(`
      SELECT * FROM cop_markers
      WHERE cop_session_id = ?
        AND (stale_time IS NULL OR stale_time > datetime('now'))
      ORDER BY event_time DESC
      LIMIT 500
    `).bind(sessionId).all()

    const features = (rows.results || []).map((row: any) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [row.lon, row.lat],
      },
      properties: {
        id: row.id,
        uid: row.uid,
        cot_type: row.cot_type,
        callsign: row.callsign,
        label: row.label,
        description: row.description,
        icon: row.icon,
        color: row.color,
        event_time: row.event_time,
        stale_time: row.stale_time,
        source_type: row.source_type,
        entity_type: 'marker',
      },
    }))

    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features,
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[COP Markers Layer] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch markers layer',
    }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
