/**
 * COP RFI API - List and Create
 *
 * GET  /api/cop/:id/rfis - List RFIs for session (with answers)
 * POST /api/cop/:id/rfis - Create new RFI
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
  return `rfi-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const rfis = await env.DB.prepare(`
      SELECT * FROM cop_rfis WHERE cop_session_id = ? ORDER BY
        CASE priority
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END,
        created_at DESC
    `).bind(sessionId).all()

    // Fetch answers for each RFI
    const rfiIds = rfis.results.map((r: any) => r.id)
    let answers: any[] = []
    if (rfiIds.length > 0) {
      const placeholders = rfiIds.map(() => '?').join(',')
      const answerResults = await env.DB.prepare(`
        SELECT * FROM cop_rfi_answers WHERE rfi_id IN (${placeholders}) ORDER BY created_at ASC
      `).bind(...rfiIds).all()
      answers = answerResults.results
    }

    // Group answers by rfi_id
    const answersByRfi: Record<string, any[]> = {}
    for (const a of answers) {
      const rfiId = (a as any).rfi_id
      if (!answersByRfi[rfiId]) answersByRfi[rfiId] = []
      answersByRfi[rfiId].push(a)
    }

    const enriched = rfis.results.map((r: any) => ({
      ...r,
      answers: answersByRfi[r.id] || [],
    }))

    return new Response(JSON.stringify({ rfis: enriched }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP RFI API] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list RFIs',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    const body = await request.json() as any

    if (!body.question?.trim()) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const id = generateId()
    const now = new Date().toISOString()
    const priority = ['critical', 'high', 'medium', 'low'].includes(body.priority) ? body.priority : 'medium'

    await env.DB.prepare(`
      INSERT INTO cop_rfis (id, cop_session_id, question, priority, status, created_by, assigned_to, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)
    `).bind(id, sessionId, body.question.trim(), priority, userId, body.assigned_to ?? null, now, now).run()

    return new Response(JSON.stringify({ id, message: 'RFI created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP RFI API] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create RFI',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
