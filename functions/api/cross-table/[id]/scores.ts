// GET /api/cross-table/:id/scores — Get scores for a table
// PUT /api/cross-table/:id/scores — Batch upsert scores
import { getUserIdOrDefault, getUserFromRequest } from '../../_shared/auth-helpers'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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

  const userId = await getUserIdOrDefault(request, env)

  try {
    // Verify table access
    const table = await env.DB.prepare(
      'SELECT id, config FROM cross_tables WHERE id = ? AND user_id = ?'
    ).bind(tableId, userId).first()

    if (!table) {
      return new Response(JSON.stringify({ error: 'Cross table not found' }), { status: 404, headers: corsHeaders })
    }

    if (request.method === 'GET') return await handleGet(env, tableId)
    if (request.method === 'PUT') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: corsHeaders,
        })
      }
      return await handleUpsert(env, tableId, userId, request, table)
    }
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  } catch (err: any) {
    console.error('[CrossTable Scores] Error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
}

async function handleGet(env: any, tableId: string) {
  const result = await env.DB.prepare(
    'SELECT * FROM cross_table_scores WHERE cross_table_id = ? ORDER BY round, row_id, col_id'
  ).bind(tableId).all()

  return new Response(JSON.stringify({ scores: result.results || [] }), { headers: corsHeaders })
}

async function handleUpsert(env: any, tableId: string, userId: number, request: Request, table: any) {
  const body = await request.json() as any
  const inputScores = body.scores

  if (!Array.isArray(inputScores)) {
    return new Response(JSON.stringify({ error: 'scores must be an array' }), { status: 400, headers: corsHeaders })
  }

  const config = typeof table.config === 'string' ? JSON.parse(table.config) : table.config
  const round = config.delphi?.current_round || 1
  const now = new Date().toISOString()

  // Batch upsert using INSERT OR REPLACE
  const stmts = inputScores.map((s: any) => {
    const id = crypto.randomUUID()
    return env.DB.prepare(
      `INSERT INTO cross_table_scores (id, cross_table_id, row_id, col_id, user_id, round, score, confidence, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cross_table_id, row_id, col_id, user_id, round)
       DO UPDATE SET score = excluded.score, confidence = excluded.confidence, notes = excluded.notes, updated_at = excluded.updated_at`
    ).bind(
      id, tableId, s.row_id, s.col_id, userId, round,
      s.score ?? null, s.confidence ?? 1.0, s.notes ?? null,
      now, now
    )
  })

  if (stmts.length > 0) {
    await env.DB.batch(stmts)
  }

  // Update table's updated_at
  await env.DB.prepare(
    'UPDATE cross_tables SET updated_at = ? WHERE id = ?'
  ).bind(now, tableId).run()

  // Return all scores for this table
  const result = await env.DB.prepare(
    'SELECT * FROM cross_table_scores WHERE cross_table_id = ? AND user_id = ? AND round = ? ORDER BY row_id, col_id'
  ).bind(tableId, userId, round).all()

  return new Response(JSON.stringify({ scores: result.results || [] }), { headers: corsHeaders })
}
