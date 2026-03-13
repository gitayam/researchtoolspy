// GET /api/cross-table — List user's cross tables
// POST /api/cross-table — Create a new cross table
import { getUserIdOrDefault } from '../_shared/auth-helpers'
import { TEMPLATES } from '../../../src/lib/cross-table/engine/templates'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  'Content-Type': 'application/json',
}

export async function onRequest(context: any) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: corsHeaders })
  }

  const userId = await getUserIdOrDefault(request, env)

  try {
    if (request.method === 'GET') {
      return await handleList(env, userId)
    }
    if (request.method === 'POST') {
      return await handleCreate(env, userId, request)
    }
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  } catch (err: any) {
    console.error('[CrossTable] Error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), { status: 500, headers: corsHeaders })
  }
}

async function handleList(env: any, userId: number) {
  const results = await env.DB.prepare(
    'SELECT * FROM cross_tables WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all()

  const tables = (results.results || []).map(parseTableRow)
  return new Response(JSON.stringify({ tables }), { headers: corsHeaders })
}

async function handleCreate(env: any, userId: number, request: Request) {
  const body = await request.json() as any
  const { title, description, template_type } = body

  if (!title || typeof title !== 'string') {
    return new Response(JSON.stringify({ error: 'title is required' }), { status: 400, headers: corsHeaders })
  }

  const type = template_type || 'blank'
  const template = TEMPLATES[type]
  if (!template) {
    return new Response(JSON.stringify({ error: `Unknown template type: ${type}` }), { status: 400, headers: corsHeaders })
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  // Build config from template defaults (nested structure per spec)
  const config = {
    scoring: { ...template.scoring },
    display: { ...template.display },
    delphi: { ...template.delphi },
    rows: template.default_rows.map((r) => ({ ...r, id: crypto.randomUUID() })),
    columns: template.default_columns.map((c) => ({ ...c, id: crypto.randomUUID() })),
    weighting: template.weighting,
  }

  await env.DB.prepare(
    'INSERT INTO cross_tables (id, user_id, title, description, template_type, config, status, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, title, description || null, type, JSON.stringify(config), 'draft', 0, now, now).run()

  const table = parseTableRow({
    id, user_id: userId, title, description: description || null,
    template_type: type, config: JSON.stringify(config),
    status: 'draft', is_public: 0, share_token: null,
    created_at: now, updated_at: now,
  })

  return new Response(JSON.stringify({ table }), { status: 201, headers: corsHeaders })
}

function parseTableRow(row: any) {
  return {
    ...row,
    config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
    is_public: Boolean(row.is_public),
  }
}
