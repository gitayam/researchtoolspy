/**
 * COP RFI Single Item API
 *
 * PUT /api/cop/:id/rfis/:rfiId - Update RFI (status, priority)
 */
import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const rfiId = params.rfiId as string

  try {
    const body = await request.json() as any
    const now = new Date().toISOString()

    const updates: string[] = ['updated_at = ?']
    const values: any[] = [now]

    if (body.status && ['open', 'answered', 'accepted', 'closed'].includes(body.status)) {
      updates.push('status = ?')
      values.push(body.status)
    }
    if (body.priority && ['critical', 'high', 'medium', 'low'].includes(body.priority)) {
      updates.push('priority = ?')
      values.push(body.priority)
    }
    if (body.assigned_to !== undefined) {
      updates.push('assigned_to = ?')
      values.push(body.assigned_to)
    }

    values.push(rfiId)

    await env.DB.prepare(`
      UPDATE cop_rfis SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run()

    return new Response(JSON.stringify({ message: 'RFI updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP RFI API] Update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update RFI',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
