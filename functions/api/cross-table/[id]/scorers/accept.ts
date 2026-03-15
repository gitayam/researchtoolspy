// POST /api/cross-table/:id/scorers/accept — Accept invite
import { requireAuth } from '../../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../../_shared/api-utils'


export async function onRequest(context: any) {
  const { request, env, params } = context
  const tableId = params.id as string

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: JSON_HEADERS })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: JSON_HEADERS })
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: JSON_HEADERS })
  }

  try {
    const userId = await requireAuth(request, env)
    const body = await request.json() as any
    const { invite_token } = body

    if (!invite_token) {
      return new Response(JSON.stringify({ error: 'invite_token is required' }), { status: 400, headers: JSON_HEADERS })
    }

    // Find the scorer record
    const scorer = await env.DB.prepare(
      'SELECT * FROM cross_table_scorers WHERE cross_table_id = ? AND invite_token = ?'
    ).bind(tableId, invite_token).first()

    if (!scorer) {
      return new Response(JSON.stringify({ error: 'Invalid invite token' }), { status: 404, headers: JSON_HEADERS })
    }

    if (scorer.status === 'accepted') {
      return new Response(JSON.stringify({ error: 'Invite already accepted' }), { status: 409, headers: JSON_HEADERS })
    }

    const now = new Date().toISOString()
    await env.DB.prepare(
      'UPDATE cross_table_scorers SET user_id = ?, status = ?, accepted_at = ? WHERE id = ?'
    ).bind(userId, 'accepted', now, scorer.id).run()

    return new Response(JSON.stringify({
      scorer: { ...scorer, user_id: userId, status: 'accepted', accepted_at: now },
    }), { headers: JSON_HEADERS })
  } catch (err: any) {
    if (err instanceof Response) return err
    console.error('[CrossTable Accept] Error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: JSON_HEADERS })
  }
}
