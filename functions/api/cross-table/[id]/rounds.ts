// POST /api/cross-table/:id/rounds — Start, advance, or stop a Delphi process
import { requireAuth } from '../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'


/**
 * An absent or unparseable body means "advance", which is what this endpoint did before it
 * took a body at all — a caller that predates the action field keeps working.
 */
async function readJsonBody(request: Request): Promise<{ action?: string }> {
  try {
    const parsed = await request.json()
    return parsed && typeof parsed === 'object' ? (parsed as { action?: string }) : {}
  } catch {
    return {}
  }
}

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

    const body = await readJsonBody(request)
    const action = body.action ?? 'advance'
    if (action !== 'start' && action !== 'advance' && action !== 'stop') {
      return new Response(
        JSON.stringify({ error: "action must be one of 'start', 'advance', 'stop'" }),
        { status: 400, headers: JSON_HEADERS },
      )
    }

    const config = typeof table.config === 'string' ? JSON.parse(table.config) : table.config

    if (!config.delphi) {
      config.delphi = { enabled: false, current_round: 1, results_released: false }
    }

    const currentRound = config.delphi.current_round || 1

    // 'start' turns the process on without moving the round, because advancing discards the
    // premise of round one: panellists have not yet seen each other's scores, so there is
    // nothing for a second round to react to. Advancing implies the process is running, so
    // it turns it on too — a facilitator who advances has plainly decided.
    let newRound = currentRound
    if (action === 'advance') {
      newRound = currentRound + 1
      config.delphi.current_round = newRound
    }
    config.delphi.enabled = action !== 'stop'

    const now = new Date().toISOString()
    await env.DB.prepare(
      'UPDATE cross_tables SET config = ?, updated_at = ? WHERE id = ?'
    ).bind(JSON.stringify(config), now, tableId).run()

    return new Response(JSON.stringify({
      enabled: config.delphi.enabled,
      previous_round: currentRound,
      current_round: newRound,
    }), { status: 201, headers: JSON_HEADERS })
  } catch (err: any) {
    if (err instanceof Response) return err
    console.error('[CrossTable Rounds] Error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: JSON_HEADERS })
  }
}
