// POST /api/cross-table/:id/rounds — Advance Delphi round
import { requireAuth } from '../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'


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

    const table = await env.DB.prepare(
      'SELECT * FROM cross_tables WHERE id = ? AND user_id = ?'
    ).bind(tableId, userId).first()

    if (!table) {
      return new Response(JSON.stringify({ error: 'Cross table not found' }), { status: 404, headers: JSON_HEADERS })
    }

    const config = typeof table.config === 'string' ? JSON.parse(table.config) : table.config

    if (!config.delphi) {
      config.delphi = { current_round: 1, results_released: false }
    }

    const currentRound = config.delphi.current_round || 1
    const newRound = currentRound + 1
    config.delphi.current_round = newRound

    const now = new Date().toISOString()
    await env.DB.prepare(
      'UPDATE cross_tables SET config = ?, updated_at = ? WHERE id = ?'
    ).bind(JSON.stringify(config), now, tableId).run()

    return new Response(JSON.stringify({
      previous_round: currentRound,
      current_round: newRound,
    }), { status: 201, headers: JSON_HEADERS })
  } catch (err: any) {
    if (err instanceof Response) return err
    console.error('[CrossTable Rounds] Error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: JSON_HEADERS })
  }
}
