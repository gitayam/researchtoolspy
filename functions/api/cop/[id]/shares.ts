/**
 * COP Share API
 *
 * POST /api/cop/:id/shares - Create share link with panel config
 * GET  /api/cop/:id/shares - List existing share links
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../../_shared/auth-helpers'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `cops-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    const body = await request.json() as any

    const id = generateId()
    const token = crypto.randomUUID()
    const now = new Date().toISOString()

    const validPanels = ['map', 'event', 'claims', 'rfi', 'questions', 'network']
    const visiblePanels = Array.isArray(body.visible_panels)
      ? body.visible_panels.filter((p: string) => validPanels.includes(p))
      : ['map', 'event']

    // Always include map
    if (!visiblePanels.includes('map')) visiblePanels.unshift('map')

    await env.DB.prepare(`
      INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, allow_rfi_answers, created_by, created_at, view_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(
      id, sessionId, token,
      JSON.stringify(visiblePanels),
      body.allow_rfi_answers ? 1 : 0,
      userId, now
    ).run()

    return new Response(JSON.stringify({
      id,
      share_token: token,
      url: `/public/cop/${token}`,
      message: 'Share link created',
    }), { status: 201, headers: corsHeaders })
  } catch (error) {
    console.error('[COP Share API] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create share link',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const results = await env.DB.prepare(`
      SELECT * FROM cop_shares WHERE cop_session_id = ? ORDER BY created_at DESC
    `).bind(sessionId).all()

    const shares = results.results.map((r: any) => ({
      ...r,
      visible_panels: JSON.parse(r.visible_panels || '["map"]'),
    }))

    return new Response(JSON.stringify({ shares }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Share API] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list share links',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
