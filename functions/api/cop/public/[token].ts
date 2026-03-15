/**
 * COP Public Share API
 *
 * GET /api/cop/public/:token - Get shared session data (filtered by visible_panels)
 */
import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

const jsonFields = ['active_layers', 'layer_config', 'linked_frameworks', 'key_questions', 'event_facts', 'content_analyses'] as const

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

    if (!share) {
      return new Response(JSON.stringify({ error: 'Share link not found or expired' }), {
        status: 404, headers: corsHeaders,
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
        status: 404, headers: corsHeaders,
      })
    }

    const parsed = parseJsonFields(session)
    const visiblePanels = JSON.parse(share.visible_panels || '["map"]')

    // Build response based on visible panels
    const response: any = {
      session: parsed,
      visible_panels: visiblePanels,
      allow_rfi_answers: share.allow_rfi_answers === 1,
    }

    // Include RFIs if rfi panel is visible
    if (visiblePanels.includes('rfi')) {
      const rfis = await env.DB.prepare(`
        SELECT * FROM cop_rfis WHERE cop_session_id = ? ORDER BY
          CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
          created_at DESC
      `).bind(share.cop_session_id).all()

      const rfiIds = (rfis.results || []).map((r: any) => r.id)
      let answers: any[] = []
      if (rfiIds.length > 0) {
        const placeholders = rfiIds.map(() => '?').join(',')
        const answerResults = await env.DB.prepare(
          `SELECT * FROM cop_rfi_answers WHERE rfi_id IN (${placeholders}) ORDER BY created_at ASC`
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

    return new Response(JSON.stringify(response), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Public API] Get error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to load shared COP',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
