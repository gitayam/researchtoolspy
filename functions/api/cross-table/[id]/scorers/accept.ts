// POST /api/cross-table/:id/scorers/accept — Accept invite
import { requireAuth } from '../../../_shared/auth-helpers'

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

  try {
    const userId = await requireAuth(request, env)
    const body = await request.json() as any
    const { invite_token } = body

    if (!invite_token) {
      return new Response(JSON.stringify({ error: 'invite_token is required' }), { status: 400, headers: corsHeaders })
    }

    // Find the scorer record
    const scorer = await env.DB.prepare(
      'SELECT * FROM cross_table_scorers WHERE cross_table_id = ? AND invite_token = ?'
    ).bind(tableId, invite_token).first()

    if (!scorer) {
      return new Response(JSON.stringify({ error: 'Invalid invite token' }), { status: 404, headers: corsHeaders })
    }

    if (scorer.status === 'accepted') {
      return new Response(JSON.stringify({ error: 'Invite already accepted' }), { status: 409, headers: corsHeaders })
    }

    const now = new Date().toISOString()
    await env.DB.prepare(
      'UPDATE cross_table_scorers SET user_id = ?, status = ?, accepted_at = ? WHERE id = ?'
    ).bind(userId, 'accepted', now, scorer.id).run()

    return new Response(JSON.stringify({
      scorer: { ...scorer, user_id: userId, status: 'accepted', accepted_at: now },
    }), { headers: corsHeaders })
  } catch (err: any) {
    if (err instanceof Response) return err
    console.error('[CrossTable Accept] Error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
}
