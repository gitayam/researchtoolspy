// POST /api/cross-table/:id/share — Generate share token
import { getUserIdOrDefault } from '../../_shared/auth-helpers'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  'Content-Type': 'application/json',
}

export async function onRequest(context: any) {
  const { request, env, params } = context
  const tableId = params.id as string

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: corsHeaders })
  }

  const userId = await getUserIdOrDefault(request, env)

  try {
    const table = await env.DB.prepare(
      'SELECT id, share_token FROM cross_tables WHERE id = ? AND user_id = ?'
    ).bind(tableId, userId).first()

    if (!table) {
      return new Response(JSON.stringify({ error: 'Cross table not found' }), { status: 404, headers: corsHeaders })
    }

    // If share_token already exists, return it
    if (table.share_token) {
      const url = new URL(request.url)
      return new Response(JSON.stringify({
        share_token: table.share_token,
        url: `${url.origin}/public/cross-table/${table.share_token}`,
      }), { headers: corsHeaders })
    }

    // Generate new token
    const shareToken = crypto.randomUUID()
    const now = new Date().toISOString()

    await env.DB.prepare(
      'UPDATE cross_tables SET share_token = ?, is_public = 1, updated_at = ? WHERE id = ?'
    ).bind(shareToken, now, tableId).run()

    const url = new URL(request.url)
    return new Response(JSON.stringify({
      share_token: shareToken,
      url: `${url.origin}/public/cross-table/${shareToken}`,
    }), { status: 201, headers: corsHeaders })
  } catch (err: any) {
    console.error('[CrossTable Share] Error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), { status: 500, headers: corsHeaders })
  }
}
