/**
 * COP CoT (Cursor on Target) Feed Export
 *
 * GET /api/cop/:id/cot
 *
 * Returns an XML document containing all COP entities (places, events,
 * actors, and tactical markers) serialized as CoT <event> elements.
 * This feed is compatible with ATAK, WinTAK, and iTAK for real-time
 * common operating picture interoperability.
 *
 * Entities are filtered by the session's bounding box.
 * Stale markers (past their stale_time) are excluded.
 * The staleMinutes for entity-derived CoT events is derived from
 * the session's rolling_hours (converted to minutes), defaulting to 60.
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import {
  entityToCoT, wrapCoTFeed,
  placeToCoTType, eventToCoTType, actorToCoTType,
} from '../cot-serializer'

interface Env {
  DB: D1Database
}

const xmlHeaders = {
  'Content-Type': 'application/xml',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const session = await env.DB.prepare(
      'SELECT * FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first<any>()

    if (!session) {
      return new Response('<error>COP session not found</error>', {
        status: 404, headers: xmlHeaders,
      })
    }

    const wsId = session.workspace_id
    const minLat = session.bbox_min_lat ?? -90
    const maxLat = session.bbox_max_lat ?? 90
    const minLon = session.bbox_min_lon ?? -180
    const maxLon = session.bbox_max_lon ?? 180
    const staleMinutes = session.rolling_hours ? session.rolling_hours * 60 : 60

    const cotEvents: string[] = []

    // Fetch places, events, actors, markers in parallel
    const [places, events, actors, markers] = await Promise.all([
      env.DB.prepare(`
        SELECT id, name, place_type, coordinates FROM places
        WHERE workspace_id = ? AND coordinates IS NOT NULL
          AND json_extract(coordinates, '$.lat') BETWEEN ? AND ?
          AND json_extract(coordinates, '$.lng') BETWEEN ? AND ?
        LIMIT 200
      `).bind(wsId, minLat, maxLat, minLon, maxLon).all(),

      env.DB.prepare(`
        SELECT id, name, event_type, coordinates FROM events
        WHERE workspace_id = ? AND coordinates IS NOT NULL
          AND json_extract(coordinates, '$.lat') BETWEEN ? AND ?
          AND json_extract(coordinates, '$.lng') BETWEEN ? AND ?
        LIMIT 200
      `).bind(wsId, minLat, maxLat, minLon, maxLon).all(),

      env.DB.prepare(`
        SELECT a.id, a.name, a.type AS actor_type, p.coordinates
        FROM actors a
        JOIN relationships r ON r.source_entity_id = a.id
          AND r.source_entity_type = 'ACTOR' AND r.relationship_type = 'LOCATED_AT'
        JOIN places p ON p.id = r.target_entity_id AND r.target_entity_type = 'PLACE'
        WHERE a.workspace_id = ? AND p.coordinates IS NOT NULL
          AND json_extract(p.coordinates, '$.lat') BETWEEN ? AND ?
          AND json_extract(p.coordinates, '$.lng') BETWEEN ? AND ?
        LIMIT 200
      `).bind(wsId, minLat, maxLat, minLon, maxLon).all(),

      env.DB.prepare(`
        SELECT * FROM cop_markers
        WHERE cop_session_id = ?
          AND (stale_time IS NULL OR stale_time > datetime('now'))
        LIMIT 200
      `).bind(sessionId).all(),
    ])

    // Convert places
    for (const row of (places.results || []) as any[]) {
      try {
        const coords = typeof row.coordinates === 'string'
          ? JSON.parse(row.coordinates) : row.coordinates
        if (!coords || coords.lat == null || coords.lng == null) continue
        cotEvents.push(entityToCoT({
          uid: `place-${row.id}`,
          type: placeToCoTType(row.place_type),
          lat: coords.lat,
          lon: coords.lng,
          callsign: row.name,
          staleMinutes,
        }))
      } catch {
        // Skip malformed coordinates
      }
    }

    // Convert events
    for (const row of (events.results || []) as any[]) {
      try {
        const coords = typeof row.coordinates === 'string'
          ? JSON.parse(row.coordinates) : row.coordinates
        if (!coords || coords.lat == null || coords.lng == null) continue
        cotEvents.push(entityToCoT({
          uid: `event-${row.id}`,
          type: eventToCoTType(row.event_type),
          lat: coords.lat,
          lon: coords.lng,
          callsign: row.name,
          staleMinutes,
        }))
      } catch {
        // Skip malformed coordinates
      }
    }

    // Convert actors (positioned via LOCATED_AT -> place coordinates)
    for (const row of (actors.results || []) as any[]) {
      try {
        const coords = typeof row.coordinates === 'string'
          ? JSON.parse(row.coordinates) : row.coordinates
        if (!coords || coords.lat == null || coords.lng == null) continue
        cotEvents.push(entityToCoT({
          uid: `actor-${row.id}`,
          type: actorToCoTType(row.actor_type),
          lat: coords.lat,
          lon: coords.lng,
          callsign: row.name,
          staleMinutes,
        }))
      } catch {
        // Skip malformed coordinates
      }
    }

    // Convert tactical markers (already CoT-native)
    for (const row of (markers.results || []) as any[]) {
      cotEvents.push(entityToCoT({
        uid: row.uid,
        type: row.cot_type,
        lat: row.lat,
        lon: row.lon,
        hae: row.hae,
        callsign: row.callsign || row.label,
        staleMinutes: 5,
      }))
    }

    return new Response(wrapCoTFeed(cotEvents), { headers: xmlHeaders })
  } catch (error) {
    console.error('[CoT Export] Error:', error)
    return new Response('<error>Failed to generate CoT feed</error>', {
      status: 500, headers: xmlHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: xmlHeaders })
}
