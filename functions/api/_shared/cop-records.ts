/**
 * Evidence and marker rows written by the S2 routes (uploads, evidence-form
 * ingest), with the same columns as functions/api/cop/[id]/evidence.ts and
 * markers.ts, plus where the item came from.
 *
 * `source_channel` arrives with managed migration 0022; until it is applied the
 * insert is retried without it, so these routes work on either schema.
 */
import { emitCopEventLoose } from './cop-events-loose'
import { createTimelineEntry } from './timeline-helper'

export type SourceChannel = 'web' | 'signal' | 'drop' | 'scrape' | 'api'

export function columnMissing(error: unknown, column: string): boolean {
  const message = String(error instanceof Error ? error.message : error)
  return new RegExp(`(?:no such column|has no column named):?\\s*${column}\\b`, 'i').test(message)
}

export interface CopSessionScope {
  sessionId: string
  workspaceId: string
  name: string | null
  description: string | null
  center: { lat: number; lon: number } | null
  archived: boolean
}

export async function copSessionScope(db: D1Database, sessionId: string): Promise<CopSessionScope | null> {
  const row = await db.prepare('SELECT id, workspace_id, name, description, center_lat, center_lon, status FROM cop_sessions WHERE id = ?')
    .bind(sessionId)
    .first<{ id: string; workspace_id: string | null; name: string | null; description: string | null; center_lat: number | null; center_lon: number | null; status: string | null }>()
  if (!row || !row.workspace_id) return null
  const lat = Number(row.center_lat)
  const lon = Number(row.center_lon)
  const hasCenter = row.center_lat !== null && row.center_lon !== null && Number.isFinite(lat) && Number.isFinite(lon) &&
    Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  return {
    sessionId: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    center: hasCenter ? { lat, lon } : null,
    archived: String(row.status ?? '').toUpperCase() === 'ARCHIVED',
  }
}

export interface EvidenceInput {
  title: string
  description: string
  sourceUrl: string | null
  evidenceType: 'observation' | 'image' | 'document' | 'audio'
  credibility: 'confirmed' | 'probable' | 'possible' | 'doubtful' | 'unverified'
  sourceName: string | null
  sourceChannel: SourceChannel
  metadata: Record<string, unknown>
  createdBy: number
}

/** Insert one evidence item in the session's workspace; emits its event and a timeline line. */
export async function insertCopEvidence(db: D1Database, scope: CopSessionScope, input: EvidenceInput): Promise<string> {
  const now = new Date().toISOString()
  const values = [
    input.title.slice(0, 500),
    input.description.slice(0, 5000),
    input.sourceUrl,
    input.evidenceType,
    'low',
    input.credibility,
    'unknown',
    input.sourceName,
    JSON.stringify(input.metadata),
    scope.workspaceId,
    input.createdBy,
    now,
    now,
  ]
  const columns = `title, description, source_url, evidence_type, confidence_level,
      credibility, reliability, source_name, metadata,
      status, workspace_id, created_by, created_at, updated_at`
  // source_channel and cop_session_id come with migration 0022; cop_session_id is what
  // makes the item this COP's (evidence_items is workspace-wide). A missing column is
  // dropped on its own, so the session is never lost because the channel column is.
  const optional: { column: string; value: unknown }[] = [
    { column: 'source_channel', value: input.sourceChannel },
    { column: 'cop_session_id', value: scope.sessionId },
  ]
  let result
  for (;;) {
    const extraColumns = optional.map((o) => `, ${o.column}`).join('')
    const extraMarks = optional.map(() => ', ?').join('')
    try {
      result = await db.prepare(`
        INSERT INTO evidence_items (${columns}${extraColumns})
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?${extraMarks})
      `).bind(...values, ...optional.map((o) => o.value)).run()
      break
    } catch (error) {
      const missing = optional.findIndex((o) => columnMissing(error, o.column))
      if (missing === -1) throw error
      optional.splice(missing, 1)
    }
  }
  const id = String(result.meta?.last_row_id ?? '')
  if (!id || id === '0') throw new Error('Evidence insert returned no id')

  await emitCopEventLoose(db, {
    copSessionId: scope.sessionId,
    eventType: 'evidence.created',
    entityType: 'evidence',
    entityId: id,
    payload: { title: input.title.slice(0, 200), evidence_type: input.evidenceType, source_channel: input.sourceChannel },
    createdBy: input.createdBy,
  })
  try {
    await createTimelineEntry(db, scope.sessionId, scope.workspaceId, input.createdBy, {
      title: `Evidence added: ${input.title.slice(0, 160)}`,
      category: 'event',
      importance: 'normal',
      source_type: 'system',
      entity_type: 'evidence',
      entity_id: id,
      action: 'created',
    })
  } catch { /* the timeline line is a convenience */ }
  return id
}

export interface MarkerInput {
  lat: number
  lon: number
  label: string
  description: string | null
  confidence: 'CONFIRMED' | 'PROBABLE' | 'POSSIBLE' | 'SUSPECTED' | 'DOUBTFUL'
  rationale: string | null
  sourceType: string
  sourceId: string | null
  sourceChannel: SourceChannel
  createdBy: number
}

/** Insert one marker that stays until removed (no stale time); emits its event. */
export async function insertCopMarker(db: D1Database, scope: CopSessionScope, input: MarkerInput): Promise<string> {
  const id = `mkr-${crypto.randomUUID().slice(0, 12)}`
  const now = new Date().toISOString()
  const values = [
    id, scope.sessionId, crypto.randomUUID(), 'a-u-G', null,
    input.lat, input.lon, 0, input.label.slice(0, 200), input.description?.slice(0, 2000) ?? null,
    null, null, '{}', now, null, input.sourceType, input.sourceId,
    scope.workspaceId, input.createdBy, now, input.confidence, input.rationale,
  ]
  const columns = `id, cop_session_id, uid, cot_type, callsign,
      lat, lon, hae, label, description, icon, color, detail,
      event_time, stale_time, source_type, source_id,
      workspace_id, created_by, created_at, confidence, rationale`
  const marks = values.map(() => '?').join(', ')
  try {
    await db.prepare(`INSERT INTO cop_markers (${columns}, source_channel) VALUES (${marks}, ?)`).bind(...values, input.sourceChannel).run()
  } catch (error) {
    if (!columnMissing(error, 'source_channel')) throw error
    await db.prepare(`INSERT INTO cop_markers (${columns}) VALUES (${marks})`).bind(...values).run()
  }
  try {
    await db.prepare(`
      INSERT INTO cop_marker_changelog (id, marker_id, cop_session_id, action, new_value, rationale, created_by, created_by_name, created_at)
      VALUES (?, ?, ?, 'created', ?, ?, ?, NULL, ?)
    `).bind(`mcl-${crypto.randomUUID().slice(0, 12)}`, id, scope.sessionId,
      JSON.stringify({ lat: input.lat, lon: input.lon, label: input.label, confidence: input.confidence }),
      input.rationale, input.createdBy, now).run()
  } catch { /* the changelog is a convenience */ }
  await emitCopEventLoose(db, {
    copSessionId: scope.sessionId,
    eventType: 'marker.created',
    entityType: 'marker',
    entityId: id,
    payload: { label: input.label.slice(0, 200), source_type: input.sourceType, source_channel: input.sourceChannel },
    createdBy: input.createdBy,
  })
  return id
}
