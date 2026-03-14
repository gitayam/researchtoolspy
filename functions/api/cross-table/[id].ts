// GET /api/cross-table/:id — Get single table with scores
// PUT /api/cross-table/:id — Update table
// DELETE /api/cross-table/:id — Delete table
import { getUserIdOrDefault } from '../_shared/auth-helpers'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  'Content-Type': 'application/json',
}

export async function onRequest(context: any) {
  const { request, env, params } = context
  const id = params.id as string

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: corsHeaders })
  }

  const userId = await getUserIdOrDefault(request, env)

  try {
    if (request.method === 'GET') return await handleGet(env, userId, id)
    if (request.method === 'PUT') return await handleUpdate(env, userId, id, request)
    if (request.method === 'DELETE') return await handleDelete(env, userId, id)
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  } catch (err: any) {
    console.error('[CrossTable] Error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
}

async function handleGet(env: any, userId: number, id: string) {
  const table = await env.DB.prepare(
    'SELECT * FROM cross_tables WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first()

  if (!table) {
    return new Response(JSON.stringify({ error: 'Cross table not found' }), { status: 404, headers: corsHeaders })
  }

  const scoresResult = await env.DB.prepare(
    'SELECT * FROM cross_table_scores WHERE cross_table_id = ? ORDER BY round, row_id, col_id'
  ).bind(id).all()

  return new Response(JSON.stringify({
    table: parseTableRow(table),
    scores: scoresResult.results || [],
  }), { headers: corsHeaders })
}

async function handleUpdate(env: any, userId: number, id: string, request: Request) {
  const existing = await env.DB.prepare(
    'SELECT * FROM cross_tables WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first()

  if (!existing) {
    return new Response(JSON.stringify({ error: 'Cross table not found' }), { status: 404, headers: corsHeaders })
  }

  const body = await request.json() as any
  const now = new Date().toISOString()

  const title = body.title ?? existing.title
  const description = body.description ?? existing.description
  const status = body.status ?? existing.status
  const config = body.config ? JSON.stringify(body.config) : existing.config

  await env.DB.prepare(
    'UPDATE cross_tables SET title = ?, description = ?, config = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).bind(title, description, config, status, now, id, userId).run()

  const updated = await env.DB.prepare(
    'SELECT * FROM cross_tables WHERE id = ?'
  ).bind(id).first()

  return new Response(JSON.stringify({ table: parseTableRow(updated) }), { headers: corsHeaders })
}

async function handleDelete(env: any, userId: number, id: string) {
  const existing = await env.DB.prepare(
    'SELECT id FROM cross_tables WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first()

  if (!existing) {
    return new Response(JSON.stringify({ error: 'Cross table not found' }), { status: 404, headers: corsHeaders })
  }

  await env.DB.prepare('DELETE FROM cross_tables WHERE id = ?').bind(id).run()
  return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
}

function parseTableRow(row: any) {
  return {
    ...row,
    config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
    is_public: Boolean(row.is_public),
  }
}
