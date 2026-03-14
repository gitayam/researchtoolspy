/**
 * COP Global Alert Feed API -- REDSIGHT BDA integration
 *
 * GET  /api/cop/:id/alerts          - Fetch alerts for session (external + local state)
 * POST /api/cop/:id/alerts          - Action an alert (dismiss, mark_action, mark_analysis, link_rfi, link_task)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { ALERT_DISMISSED, ALERT_ACTIONED, ALERT_LINKED } from '../../_shared/cop-event-types'
import { createTimelineEntry } from '../../_shared/timeline-helper'

interface Env {
  DB: D1Database
  REDSIGHT_API_URL?: string
  REDSIGHT_API_KEY?: string
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `alt-${crypto.randomUUID().slice(0, 12)}`
}

interface RedsightIncident {
  incident_id: string
  incident_type?: string
  severity?: string
  location_name?: string
  summary?: string
  damage_assessment?: string
  credibility?: number | string | null
  source_types?: string[]
  event_occurred_at?: string
  lat?: number | null
  lon?: number | null
}

interface CopSession {
  id: string
  workspace_id: string
  global_alerts_enabled: number
  global_alerts_region: string | null
  bbox_min_lat: number | null
  bbox_min_lon: number | null
  bbox_max_lat: number | null
  bbox_max_lon: number | null
}

/**
 * Fetch incidents from the REDSIGHT API.
 * Returns an empty array on any failure so the caller can fall back to cached D1 data.
 */
async function fetchRedsightIncidents(
  baseUrl: string,
  apiKey?: string,
  limit: number = 50
): Promise<RedsightIncident[]> {
  try {
    const url = new URL(`/api/v1/bda/incidents`, baseUrl)
    url.searchParams.set('limit', String(limit))

    const headers: Record<string, string> = { 'Accept': 'application/json' }
    if (apiKey) headers['X-API-Key'] = apiKey

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      console.error('[REDSIGHT] API returned status:', response.status)
      return []
    }

    const data = await response.json() as any
    // Accept both { incidents: [...] } and raw array
    const incidents = Array.isArray(data) ? data : (data.incidents ?? data.data ?? [])
    return incidents as RedsightIncident[]
  } catch (error) {
    console.error('[REDSIGHT] Fetch failed:', error)
    return []
  }
}

/**
 * Filter incidents to those within the session's bounding box.
 */
function filterByBbox(
  incidents: RedsightIncident[],
  session: CopSession
): RedsightIncident[] {
  const { bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon } = session

  // If bbox is not configured, return all incidents
  if (bbox_min_lat == null || bbox_min_lon == null || bbox_max_lat == null || bbox_max_lon == null) {
    return incidents
  }

  return incidents.filter((inc) => {
    if (inc.lat == null || inc.lon == null) return false
    return (
      inc.lat >= bbox_min_lat &&
      inc.lat <= bbox_max_lat &&
      inc.lon >= bbox_min_lon &&
      inc.lon <= bbox_max_lon
    )
  })
}

// GET -- list alerts for a COP session, merging REDSIGHT data with local state
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const url = new URL(request.url)
  const statusFilter = url.searchParams.get('status')
  const severityFilter = url.searchParams.get('severity')

  try {
    // 1. Fetch session to check if alerts are enabled and get bbox
    const session = await env.DB.prepare(`
      SELECT id, workspace_id, global_alerts_enabled, global_alerts_region,
             bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon
      FROM cop_sessions WHERE id = ?
    `).bind(sessionId).first<CopSession>()

    if (!session) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    if (!session.global_alerts_enabled) {
      return new Response(JSON.stringify({
        alerts: [],
        enabled: false,
        region: session.global_alerts_region,
      }), { headers: corsHeaders })
    }

    // 2. Fetch ALL local alert state from D1 (always load full state for merge)
    const localResults = await env.DB.prepare(
      `SELECT id, redsight_incident_id, status, linked_rfi_id, linked_task_id,
              notes, severity, incident_type, location_name, summary, created_at
       FROM cop_alert_state WHERE cop_session_id = ?`
    ).bind(sessionId).all()
    const localStateMap = new Map<string, any>()
    for (const row of (localResults.results || [])) {
      localStateMap.set((row as any).redsight_incident_id, row)
    }

    // 3. Try to fetch from REDSIGHT API
    let redsightIncidents: RedsightIncident[] = []
    let apiAvailable = false

    if (env.REDSIGHT_API_URL) {
      redsightIncidents = await fetchRedsightIncidents(
        env.REDSIGHT_API_URL,
        env.REDSIGHT_API_KEY
      )
      apiAvailable = redsightIncidents.length > 0
    }

    if (redsightIncidents.length > 0) {
      // Filter by bounding box
      redsightIncidents = filterByBbox(redsightIncidents, session)
    }

    // 4. Merge REDSIGHT data with local state
    let alerts: any[]

    if (redsightIncidents.length > 0) {
      alerts = redsightIncidents.map((inc) => {
        const local = localStateMap.get(inc.incident_id)
        // Normalize credibility to 0-1 number
        const rawCred = inc.credibility
        const credibility = rawCred == null ? null
          : typeof rawCred === 'number' ? rawCred
          : parseFloat(String(rawCred)) || null
        return {
          incident_id: inc.incident_id,
          incident_type: inc.incident_type,
          severity: inc.severity,
          location_name: inc.location_name,
          summary: inc.summary,
          damage_assessment: inc.damage_assessment,
          credibility,
          source_types: inc.source_types,
          event_occurred_at: inc.event_occurred_at,
          lat: inc.lat,
          lon: inc.lon,
          // Local state overlay
          status: local?.status ?? 'new',
          linked_rfi_id: local?.linked_rfi_id ?? null,
          linked_task_id: local?.linked_task_id ?? null,
          notes: local?.notes ?? null,
        }
      })
    } else {
      // API unavailable or returned nothing -- fall back to cached D1 data
      alerts = (localResults.results || []).map((row: any) => ({
        incident_id: row.redsight_incident_id,
        incident_type: row.incident_type,
        severity: row.severity,
        location_name: row.location_name,
        summary: row.summary,
        damage_assessment: null,
        credibility: null,
        source_types: [],
        event_occurred_at: row.created_at,
        lat: null,
        lon: null,
        status: row.status,
        linked_rfi_id: row.linked_rfi_id,
        linked_task_id: row.linked_task_id,
        notes: row.notes,
      }))
    }

    // 5. Apply client-side filters
    if (statusFilter) {
      alerts = alerts.filter((a) => a.status === statusFilter)
    }
    if (severityFilter) {
      alerts = alerts.filter((a) =>
        a.severity?.toUpperCase() === severityFilter.toUpperCase()
      )
    }

    return new Response(JSON.stringify({
      alerts,
      enabled: true,
      region: session.global_alerts_region,
      api_available: apiAvailable,
    }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Alerts] GET error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch alerts' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// POST -- action an alert (dismiss, mark_action, mark_analysis, link_rfi, link_task)
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

    const validActions = ['dismiss', 'mark_action', 'mark_analysis', 'link_rfi', 'link_task']
    if (!body.action || !validActions.includes(body.action)) {
      return new Response(JSON.stringify({
        error: `action is required and must be one of: ${validActions.join(', ')}`,
      }), { status: 400, headers: corsHeaders })
    }

    if (!body.incident_id) {
      return new Response(JSON.stringify({ error: 'incident_id is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Verify session exists
    const session = await env.DB.prepare(
      `SELECT id, workspace_id FROM cop_sessions WHERE id = ?`
    ).bind(sessionId).first<{ id: string; workspace_id: string }>()

    if (!session) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const workspaceId = session.workspace_id ?? sessionId
    const now = new Date().toISOString()

    // Map action to status
    const actionStatusMap: Record<string, string> = {
      dismiss: 'dismissed',
      mark_action: 'action',
      mark_analysis: 'analysis',
      link_rfi: 'action',
      link_task: 'action',
    }
    const newStatus = actionStatusMap[body.action]

    // Check if local state already exists
    const existing = await env.DB.prepare(
      `SELECT id FROM cop_alert_state WHERE cop_session_id = ? AND redsight_incident_id = ?`
    ).bind(sessionId, body.incident_id).first<{ id: string }>()

    if (existing) {
      // Update existing record
      const updates: string[] = ['status = ?', 'updated_at = ?', 'actioned_by = ?']
      const bindings: any[] = [newStatus, now, userId]

      if (body.notes !== undefined) {
        updates.push('notes = ?')
        bindings.push(body.notes)
      }
      if (body.rfi_id && body.action === 'link_rfi') {
        updates.push('linked_rfi_id = ?')
        bindings.push(body.rfi_id)
      }
      if (body.task_id && body.action === 'link_task') {
        updates.push('linked_task_id = ?')
        bindings.push(body.task_id)
      }
      if (body.severity) {
        updates.push('severity = ?')
        bindings.push(body.severity)
      }
      if (body.incident_type) {
        updates.push('incident_type = ?')
        bindings.push(body.incident_type)
      }
      if (body.location_name) {
        updates.push('location_name = ?')
        bindings.push(body.location_name)
      }
      if (body.summary) {
        updates.push('summary = ?')
        bindings.push(body.summary)
      }

      bindings.push(existing.id)

      await env.DB.prepare(
        `UPDATE cop_alert_state SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...bindings).run()
    } else {
      // Insert new record
      const id = generateId()

      await env.DB.prepare(`
        INSERT INTO cop_alert_state
          (id, cop_session_id, workspace_id, redsight_incident_id, status,
           linked_rfi_id, linked_task_id, notes, severity, incident_type,
           location_name, summary, actioned_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, sessionId, workspaceId, body.incident_id, newStatus,
        (body.action === 'link_rfi' ? body.rfi_id : null),
        (body.action === 'link_task' ? body.task_id : null),
        body.notes ?? null,
        body.severity ?? null,
        body.incident_type ?? null,
        body.location_name ?? null,
        body.summary ?? null,
        userId, now, now
      ).run()
    }

    // For mark_action / mark_analysis, create a timeline entry (with dedup)
    if (body.action === 'mark_action' || body.action === 'mark_analysis') {
      const title = body.action === 'mark_action'
        ? `Alert actioned: ${(body.summary ?? body.incident_id).substring(0, 80)}`
        : `Alert sent to analysis: ${(body.summary ?? body.incident_id).substring(0, 80)}`

      createTimelineEntry(env.DB, sessionId, workspaceId, userId, {
        title,
        description: body.notes ?? `REDSIGHT incident ${body.incident_id}`,
        source_type: 'system',
        entity_type: 'alert',
        entity_id: body.incident_id,
        action: body.action,
        importance: body.severity === 'CRITICAL' ? 'critical' : 'normal',
      }).catch((err) => console.error('[COP Alerts] Timeline entry failed:', err))
    }

    // Emit COP event
    const eventTypeMap: Record<string, string> = {
      dismiss: ALERT_DISMISSED,
      mark_action: ALERT_ACTIONED,
      mark_analysis: ALERT_ACTIONED,
      link_rfi: ALERT_LINKED,
      link_task: ALERT_LINKED,
    }

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: eventTypeMap[body.action] as any,
      entityType: 'alert',
      entityId: body.incident_id,
      payload: {
        action: body.action,
        incident_id: body.incident_id,
        rfi_id: body.rfi_id ?? null,
        task_id: body.task_id ?? null,
      },
      createdBy: userId,
    })

    return new Response(JSON.stringify({
      message: `Alert ${body.action} successful`,
      incident_id: body.incident_id,
      status: newStatus,
    }), { status: 200, headers: corsHeaders })
  } catch (error) {
    console.error('[COP Alerts] POST error:', error)
    return new Response(JSON.stringify({ error: 'Failed to action alert' }), {
      status: 500, headers: corsHeaders,
    })
  }
}


