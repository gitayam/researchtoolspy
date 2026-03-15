// GET /api/cross-table — List user's cross tables
// POST /api/cross-table — Create a new cross table
import { getUserIdOrDefault, getUserFromRequest } from '../_shared/auth-helpers'
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
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: corsHeaders,
        })
      }
      return await handleCreate(env, authUserId, request)
    }
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  } catch (err: any) {
    console.error('[CrossTable] Error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
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
  const templateRows = template.default_rows.map((r) => ({ ...r, id: crypto.randomUUID() }))
  const templateCols = template.default_columns.map((c) => ({ ...c, id: crypto.randomUUID() }))

  // Merge AI suggestions if provided
  const aiCriteria = Array.isArray(body.ai_criteria) ? body.ai_criteria : []
  const aiRows = Array.isArray(body.ai_rows) ? body.ai_rows : []

  let finalRows = templateRows
  let finalCols = templateCols

  if (aiCriteria.length > 0) {
    // Replace template defaults with AI suggestions (they're more contextual)
    finalCols = aiCriteria.map((c: any, i: number) => ({
      id: crypto.randomUUID(),
      label: String(c.label || '').slice(0, 100),
      description: typeof c.description === 'string' ? c.description.slice(0, 500) : '',
      order: i,
      weight: typeof c.weight === 'number' ? c.weight : 1,
    }))
  }

  if (aiRows.length > 0) {
    finalRows = aiRows.map((r: any, i: number) => ({
      id: crypto.randomUUID(),
      label: String(r.label || '').slice(0, 100),
      description: typeof r.description === 'string' ? r.description.slice(0, 500) : '',
      order: i,
    }))
  }

  const config = {
    scoring: { ...template.scoring },
    display: { ...template.display },
    delphi: { ...template.delphi },
    rows: finalRows,
    columns: finalCols,
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
    config: typeof row.config === 'string' ? (() => { try { return JSON.parse(row.config) } catch { return {} } })() : (row.config || {}),
    is_public: Boolean(row.is_public),
  }
}
