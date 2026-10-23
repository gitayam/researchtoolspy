/**
 * COP Public Share API
 *
 * GET /api/cop/public/:token - Get shared session data (filtered by visible_panels)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { shareExpired, sharePanels } from '../../_shared/cop-share'

interface Env {
  DB: D1Database
}


const jsonFields = ['active_layers', 'layer_config', 'linked_frameworks', 'key_questions', 'event_facts', 'content_analyses'] as const

/**
 * The session fields a share link may show, by panel. Only these leave the
 * database: never the owner, workspace ids, visibility, description, mission
 * brief, linked frameworks or content analyses. The map always renders (shares
 * always include it), so its fields come with every link.
 */
const ALWAYS_FIELDS = ['id', 'name', 'template_type', 'status'] as const
const PANEL_FIELDS: Record<string, readonly string[]> = {
  map: [
    'center_lat', 'center_lon', 'zoom_level',
    'bbox_min_lat', 'bbox_min_lon', 'bbox_max_lat', 'bbox_max_lon',
    'active_layers', 'layer_config',
    'time_window_start', 'time_window_end', 'rolling_hours',
  ],
  event: ['event_type', 'event_description', 'event_facts'],
  questions: ['key_questions'],
}

function publicSessionFields(session: Record<string, unknown>, visiblePanels: string[]): Record<string, unknown> {
  const fields = new Set<string>(ALWAYS_FIELDS)
  for (const panel of visiblePanels) for (const field of PANEL_FIELDS[panel] ?? []) fields.add(field)
  const out: Record<string, unknown> = {}
  for (const field of fields) if (field in session) out[field] = session[field]
  return out
}

function parseJsonFields(row: any): any {
  const parsed = { ...row }
  for (const field of jsonFields) {
    if (parsed[field]) {
      try { parsed[field] = JSON.parse(parsed[field]) } catch { parsed[field] = [] }
    } else {
      parsed[field] = field === 'layer_config' ? {} : []
    }
  }
  return parsed
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const token = params.token as string

  try {
    // Find share record
    const share = await env.DB.prepare(`
      SELECT * FROM cop_shares WHERE share_token = ?
    `).bind(token).first() as any

    // expires_at comes from managed migration 0019; a row without it never expires.
    if (!share || shareExpired(share)) {
      return new Response(JSON.stringify({ error: 'Share link not found or expired' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    // Increment view count
    await env.DB.prepare(`
      UPDATE cop_shares SET view_count = view_count + 1 WHERE id = ?
    `).bind(share.id).run()

    // Fetch session
    const session = await env.DB.prepare(`
      SELECT * FROM cop_sessions WHERE id = ?
    `).bind(share.cop_session_id).first()

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    // Don't serve archived sessions via public links
    if ((session as any).status === 'ARCHIVED') {
      return new Response(JSON.stringify({ error: 'This session is no longer available' }), {
        status: 410, headers: JSON_HEADERS,
      })
    }

    const parsed = parseJsonFields(session)
    const visiblePanels = sharePanels(share)

    // Build response based on visible panels
    const response: any = {
      session: publicSessionFields(parsed, visiblePanels),
      visible_panels: visiblePanels,
      allow_rfi_answers: share.allow_rfi_answers === 1,
    }

    // Include RFIs if rfi panel is visible
    if (visiblePanels.includes('rfi')) {
      const rfis = await env.DB.prepare(`
        SELECT id, question, priority, status, created_at, updated_at
        FROM cop_rfis WHERE cop_session_id = ? ORDER BY
          CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
          created_at DESC
      `).bind(share.cop_session_id).all()

      const rfiIds = (rfis.results || []).map((r: any) => r.id)
      let answers: any[] = []
      if (rfiIds.length > 0) {
        const placeholders = rfiIds.map(() => '?').join(',')
        const answerResults = await env.DB.prepare(
          `SELECT id, rfi_id, answer_text, source_url, source_description, is_accepted, responder_name, created_at
           FROM cop_rfi_answers WHERE rfi_id IN (${placeholders}) ORDER BY created_at ASC`
        ).bind(...rfiIds).all()
        answers = answerResults.results
      }

      const answersByRfi: Record<string, any[]> = {}
      for (const a of answers) {
        const rfiId = (a as any).rfi_id
        if (!answersByRfi[rfiId]) answersByRfi[rfiId] = []
        answersByRfi[rfiId].push(a)
      }

      response.rfis = (rfis.results || []).map((r: any) => ({
        ...r,
        answers: answersByRfi[r.id] || [],
      }))
    }

    return new Response(JSON.stringify(response), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/public',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to load shared COP',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
