/**
 * COP Layer: Markers GeoJSON
 *
 * GET /api/cop/:id/layers/markers
 *
 * Returns a GeoJSON FeatureCollection of non-stale tactical markers
 * for the given COP session. Markers with a stale_time in the past
 * are excluded (unless stale_time is NULL, which means persistent).
 *
 * A marker placed from a photo's GPS that no editor has confirmed is the team's only:
 * a share link or anyone else who isn't the owner or a collaborator never gets it
 * (cop-photo-location.ts).
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopLayerAccess, verifyCopSessionAccess } from '../../../_shared/auth-helpers'
import { UNVERIFIED_TIP_LABEL, unreviewedTipMarker } from '../../../_shared/cop-input'
import { PUBLIC_MARKERS_SQL, teamOnlyPhotoMarker } from '../../../_shared/cop-photo-location'
import { JSON_HEADERS } from '../../../_shared/api-utils'
import { logEvent } from '../../../_shared/event-log'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}


export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  // Auth: public sessions open, private sessions require owner/collaborator
  const access = await verifyCopLayerAccess(env.DB, sessionId, request, env, 'markers')
  if (access instanceof Response) return access

  // A drop-form tip nobody has reviewed shows its text to the session's own people only:
  // a share link or a public session's anonymous reader sees "Unverified tip".
  let collaborator = false
  if (!access.viaShare) {
    const userId = await getUserFromRequest(request, env)
    collaborator = Boolean(userId && (await verifyCopSessionAccess(env.DB, sessionId, userId)))
  }

  try {
    const rows = await env.DB.prepare(`
      SELECT * FROM cop_markers
      WHERE cop_session_id = ?
        AND (stale_time IS NULL OR stale_time > datetime('now'))
        ${collaborator ? '' : `AND ${PUBLIC_MARKERS_SQL}`}
      ORDER BY event_time DESC
      LIMIT 500
    `).bind(sessionId).all()

    const visible = (rows.results || []).filter((row: Record<string, unknown>) => collaborator || !teamOnlyPhotoMarker(row))
    const features = visible.map((row: any) => {
      const hidden = !collaborator && unreviewedTipMarker(row)
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [row.lon, row.lat],
        },
        properties: {
          id: row.id,
          uid: row.uid,
          cot_type: row.cot_type,
          callsign: hidden ? null : row.callsign,
          label: hidden ? UNVERIFIED_TIP_LABEL : row.label,
          description: hidden ? null : row.description,
          icon: row.icon,
          color: row.color,
          event_time: row.event_time,
          stale_time: row.stale_time,
          source_type: row.source_type,
          entity_type: 'marker',
        },
      }
    })

    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features,
    }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/layers/markers',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
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
