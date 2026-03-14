/**
 * COP Export API - Request an export of COP session data
 *
 * POST /api/cop/:id/export
 *
 * Body: { format: 'geojson'|'kml'|'cot'|'stix'|'csv', scope?: 'full'|'layers'|'entities'|'evidence'|'tasks' }
 *
 * Fetches all relevant data from D1 directly, runs the serializer,
 * records the export in cop_exports, and returns the serialized content
 * as a downloadable blob.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault, getUserFromRequest } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { EXPORT_REQUESTED, EXPORT_COMPLETED, EXPORT_FAILED } from '../../_shared/cop-event-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

const VALID_FORMATS = ['geojson', 'kml', 'cot', 'stix', 'csv'] as const
const VALID_SCOPES = ['full', 'layers', 'entities', 'evidence', 'tasks'] as const

function generateExportId(): string {
  return `exp-${crypto.randomUUID().slice(0, 12)}`
}

/**
 * Fetch all layer data as GeoJSON FeatureCollections.
 * Used for geojson, kml, cot formats.
 */
async function fetchLayerData(
  db: D1Database,
  sessionId: string,
  workspaceId: string,
  session: any
): Promise<Record<string, any>> {
  const layers: Record<string, any> = {}
  const minLat = session.bbox_min_lat ?? -90
  const maxLat = session.bbox_max_lat ?? 90
  const minLon = session.bbox_min_lon ?? -180
  const maxLon = session.bbox_max_lon ?? 180

  // Fetch places, events, actors, markers in parallel
  const [places, events, actors, markers] = await Promise.all([
    db.prepare(`
      SELECT id, name, place_type, description, coordinates, created_at FROM places
      WHERE workspace_id = ? AND coordinates IS NOT NULL
        AND json_extract(coordinates, '$.lat') BETWEEN ? AND ?
        AND json_extract(coordinates, '$.lng') BETWEEN ? AND ?
      LIMIT 1000
    `).bind(workspaceId, minLat, maxLat, minLon, maxLon).all(),

    db.prepare(`
      SELECT id, name, event_type, description, coordinates, date, created_at FROM events
      WHERE workspace_id = ? AND coordinates IS NOT NULL
        AND json_extract(coordinates, '$.lat') BETWEEN ? AND ?
        AND json_extract(coordinates, '$.lng') BETWEEN ? AND ?
      LIMIT 1000
    `).bind(workspaceId, minLat, maxLat, minLon, maxLon).all(),

    db.prepare(`
      SELECT a.id, a.name, a.type AS actor_type, a.description, a.category,
             p.coordinates, a.created_at
      FROM actors a
      JOIN relationships r ON r.source_entity_id = a.id
        AND r.source_entity_type = 'ACTOR' AND r.relationship_type = 'LOCATED_AT'
      JOIN places p ON p.id = r.target_entity_id AND r.target_entity_type = 'PLACE'
      WHERE a.workspace_id = ? AND p.coordinates IS NOT NULL
        AND json_extract(p.coordinates, '$.lat') BETWEEN ? AND ?
        AND json_extract(p.coordinates, '$.lng') BETWEEN ? AND ?
      LIMIT 1000
    `).bind(workspaceId, minLat, maxLat, minLon, maxLon).all(),

    db.prepare(`
      SELECT * FROM cop_markers
      WHERE cop_session_id = ?
        AND (stale_time IS NULL OR stale_time > datetime('now'))
      LIMIT 1000
    `).bind(sessionId).all(),
  ])

  // Convert places to GeoJSON FeatureCollection
  layers['places'] = {
    type: 'FeatureCollection',
    features: toPointFeatures(places.results || [], 'place'),
  }

  // Convert events to GeoJSON FeatureCollection
  layers['events'] = {
    type: 'FeatureCollection',
    features: toPointFeatures(events.results || [], 'event'),
  }

  // Convert actors to GeoJSON FeatureCollection
  layers['actors'] = {
    type: 'FeatureCollection',
    features: toPointFeatures(actors.results || [], 'actor'),
  }

  // Convert markers to GeoJSON FeatureCollection
  layers['markers'] = {
    type: 'FeatureCollection',
    features: (markers.results || []).map((m: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [m.lon, m.lat, m.hae ?? 0] },
      properties: {
        id: m.uid || m.id,
        name: m.callsign || m.label || 'Marker',
        cot_type: m.cot_type,
        source_type: m.source_type,
        event_time: m.event_time,
      },
    })),
  }

  // Remove empty layers
  for (const [key, fc] of Object.entries(layers)) {
    if ((fc as any).features.length === 0) delete layers[key]
  }

  return layers
}

function toPointFeatures(rows: any[], entityPrefix: string): any[] {
  const features: any[] = []
  for (const row of rows) {
    try {
      const coords =
        typeof row.coordinates === 'string'
          ? JSON.parse(row.coordinates)
          : row.coordinates
      if (!coords || coords.lat == null || coords.lng == null) continue
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [coords.lng, coords.lat, 0] },
        properties: {
          id: row.id,
          name: row.name,
          description: row.description || '',
          entity_type: entityPrefix,
          ...(row.place_type ? { place_type: row.place_type } : {}),
          ...(row.event_type ? { event_type: row.event_type } : {}),
          ...(row.actor_type ? { actor_type: row.actor_type } : {}),
          ...(row.category ? { category: row.category } : {}),
          ...(row.date ? { event_date: row.date } : {}),
          created_at: row.created_at,
        },
      })
    } catch {
      // Skip malformed coordinates
    }
  }
  return features
}

/**
 * Fetch entity data as flat arrays. Used for stix, csv formats.
 */
async function fetchEntityData(
  db: D1Database,
  workspaceId: string,
  sessionId: string,
  scope: string
): Promise<Record<string, any[]>> {
  const entities: Record<string, any[]> = {}

  const shouldFetch = (type: string) =>
    scope === 'full' || scope === type || scope === 'entities'

  const queries: Promise<void>[] = []

  if (shouldFetch('entities') || scope === 'full') {
    queries.push(
      db.prepare('SELECT * FROM actors WHERE workspace_id = ? LIMIT 1000')
        .bind(workspaceId).all()
        .then(r => { entities.actors = r.results || [] }),
      db.prepare('SELECT * FROM events WHERE workspace_id = ? LIMIT 1000')
        .bind(workspaceId).all()
        .then(r => { entities.events = r.results || [] }),
      db.prepare('SELECT * FROM places WHERE workspace_id = ? LIMIT 1000')
        .bind(workspaceId).all()
        .then(r => { entities.places = r.results || [] }),
      db.prepare('SELECT * FROM relationships WHERE workspace_id = ? LIMIT 1000')
        .bind(workspaceId).all()
        .then(r => { entities.relationships = r.results || [] }),
    )
  }

  if (shouldFetch('evidence') || scope === 'full') {
    queries.push(
      db.prepare('SELECT * FROM evidence_items WHERE workspace_id = ? LIMIT 1000')
        .bind(workspaceId).all()
        .then(r => { entities.evidence = r.results || [] }),
    )
  }

  if (shouldFetch('tasks') || scope === 'full') {
    queries.push(
      db.prepare('SELECT * FROM cop_tasks WHERE cop_session_id = ? LIMIT 1000')
        .bind(sessionId).all()
        .then(r => { entities.tasks = r.results || [] }),
    )
  }

  // Hypotheses (always included in full or entities scope)
  if (shouldFetch('entities') || scope === 'full') {
    queries.push(
      db.prepare('SELECT * FROM cop_hypotheses WHERE cop_session_id = ? LIMIT 1000')
        .bind(sessionId).all()
        .then(r => { entities.hypotheses = r.results || [] }),
    )
  }

  await Promise.all(queries)
  return entities
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: corsHeaders,
    })
  }

  try {
    const body = await request.json() as any
    const format = body.format
    const scope = body.scope || 'full'

    // Validate format
    if (!VALID_FORMATS.includes(format)) {
      return new Response(
        JSON.stringify({ error: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}` }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate scope
    if (!VALID_SCOPES.includes(scope)) {
      return new Response(
        JSON.stringify({ error: `Invalid scope. Must be one of: ${VALID_SCOPES.join(', ')}` }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Fetch session
    const session = await env.DB.prepare(
      `SELECT * FROM cop_sessions WHERE id = ? AND status != 'ARCHIVED'`
    ).bind(sessionId).first<any>()

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'COP session not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    const workspaceId = session.workspace_id
    const exportId = generateExportId()

    // Create export record
    await env.DB.prepare(`
      INSERT INTO cop_exports (id, cop_session_id, format, scope, filters_json, status, created_by)
      VALUES (?, ?, ?, ?, ?, 'generating', ?)
    `).bind(exportId, sessionId, format, scope, JSON.stringify(body.filters || {}), userId).run()

    // Emit EXPORT_REQUESTED event
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: EXPORT_REQUESTED,
      entityType: 'export',
      entityId: exportId,
      payload: { format, scope },
      createdBy: userId,
    })

    try {
      // Dynamically import the orchestrator (Cloudflare Pages functions
      // work with relative imports from the functions/ directory, but
      // src/lib/ is bundled by the build pipeline and available at runtime)
      const { generateExport } = await import('../../../../src/lib/export/export-bundle')

      // Fetch the data based on format needs
      const needsLayers = ['geojson', 'kml', 'cot'].includes(format)
      const needsEntities = ['stix', 'csv'].includes(format)

      const [layerData, entities] = await Promise.all([
        needsLayers ? fetchLayerData(env.DB, sessionId, workspaceId, session) : Promise.resolve(undefined),
        needsEntities ? fetchEntityData(env.DB, workspaceId, sessionId, scope) : Promise.resolve(undefined),
      ])

      const result = generateExport(format, {
        session,
        layerData,
        entities,
      })

      // For multi-file results, concatenate with file separators
      let content: string
      if (result.isMultiFile && typeof result.content === 'object') {
        // Combine multiple CSVs with file markers
        const parts = Object.entries(result.content as Record<string, string>)
          .map(([filename, csv]) => `--- ${filename} ---\n${csv}`)
        content = parts.join('\n\n')
      } else {
        content = result.content as string
      }

      const fileSize = new TextEncoder().encode(content).length

      // Update export record with completed status
      await env.DB.prepare(`
        UPDATE cop_exports SET status = 'completed', file_size_bytes = ? WHERE id = ?
      `).bind(fileSize, exportId).run()

      // Emit EXPORT_COMPLETED event
      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: EXPORT_COMPLETED,
        entityType: 'export',
        entityId: exportId,
        payload: { format, scope, file_size_bytes: fileSize },
        createdBy: userId,
      })

      // Return the content as a downloadable blob
      return new Response(content, {
        headers: {
          'Content-Type': result.contentType,
          'Content-Disposition': `attachment; filename="${result.filename}"`,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
          'Access-Control-Expose-Headers': 'Content-Disposition',
          'X-Export-Id': exportId,
        },
      })
    } catch (serializeError: any) {
      // Update export record with failed status
      const errMsg = serializeError?.message || 'Unknown serialization error'
      await env.DB.prepare(`
        UPDATE cop_exports SET status = 'failed', error_message = ? WHERE id = ?
      `).bind(errMsg, exportId).run()

      // Emit EXPORT_FAILED event
      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: EXPORT_FAILED,
        entityType: 'export',
        entityId: exportId,
        payload: { format, scope, error: errMsg },
        createdBy: userId,
      })

      console.error('[COP Export] Serialization error:', serializeError)
      return new Response(
        JSON.stringify({ error: 'Export serialization failed', export_id: exportId }),
        { status: 500, headers: corsHeaders }
      )
    }
  } catch (error: any) {
    console.error('[COP Export] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process export request' }),
      { status: 500, headers: corsHeaders }
    )
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}
