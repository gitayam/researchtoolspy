// GET /api/cross-table/:id/scorers — List scorers with completion %
// POST /api/cross-table/:id/scorers — Invite a scorer
import { requireAuth } from '../../_shared/auth-helpers'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  'Content-Type': 'application/json',
}

export async function onRequest(context: any) {
  const { request, env, params } = context
  const tableId = params.id as string

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: corsHeaders })
  }

  try {
    const userId = await requireAuth(request, env)

    // Verify table ownership
    const table = await env.DB.prepare(
      'SELECT id, config FROM cross_tables WHERE id = ? AND user_id = ?'
    ).bind(tableId, userId).first()

    if (!table) {
      return new Response(JSON.stringify({ error: 'Cross table not found' }), { status: 404, headers: corsHeaders })
    }

    if (request.method === 'GET') return await handleList(env, tableId, table)
    if (request.method === 'POST') return await handleInvite(env, tableId, request)
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  } catch (err: any) {
    if (err instanceof Response) return err
    console.error('[CrossTable Scorers] Error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), { status: 500, headers: corsHeaders })
  }
}

async function handleList(env: any, tableId: string, table: any) {
  const config = typeof table.config === 'string' ? JSON.parse(table.config) : table.config
  const totalCells = (config.rows?.length || 0) * (config.columns?.length || 0)

  const scorersResult = await env.DB.prepare(
    'SELECT * FROM cross_table_scorers WHERE cross_table_id = ? ORDER BY invited_at'
  ).bind(tableId).all()

  const scorers = await Promise.all((scorersResult.results || []).map(async (scorer: any) => {
    let completion = 0
    if (scorer.user_id && totalCells > 0) {
      const countResult = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM cross_table_scores WHERE cross_table_id = ? AND user_id = ? AND score IS NOT NULL'
      ).bind(tableId, scorer.user_id).first()
      completion = Math.round(((countResult?.count || 0) / totalCells) * 100)
    }
    return { ...scorer, completion_percent: completion }
  }))

  return new Response(JSON.stringify({ scorers }), { headers: corsHeaders })
}

async function handleInvite(env: any, tableId: string, request: Request) {
  const body = await request.json() as any
  const inviteToken = crypto.randomUUID()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  await env.DB.prepare(
    'INSERT INTO cross_table_scorers (id, cross_table_id, user_id, invite_token, status, invited_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, tableId, body.user_id ?? null, inviteToken, 'invited', now).run()

  const url = new URL(request.url)
  return new Response(JSON.stringify({
    scorer: {
      id, cross_table_id: tableId, user_id: body.user_id ?? null,
      invite_token: inviteToken, status: 'invited',
      invited_at: now, accepted_at: null,
    },
    invite_url: `${url.origin}/dashboard/tools/cross-table/${tableId}/score?invite=${inviteToken}`,
  }), { status: 201, headers: corsHeaders })
}
