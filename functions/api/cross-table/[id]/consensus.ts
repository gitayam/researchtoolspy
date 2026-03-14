// GET /api/cross-table/:id/consensus — Compute Delphi consensus metrics
import { requireAuth } from '../../_shared/auth-helpers'
import { computeDelphiConsensus } from '../../../../src/lib/cross-table/engine/delphi'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  'Content-Type': 'application/json',
}

export async function onRequest(context: any) {
  const { request, env, params } = context
  const tableId = params.id as string

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: corsHeaders })
  }

  try {
    const userId = await requireAuth(request, env)

    const table = await env.DB.prepare(
      'SELECT * FROM cross_tables WHERE id = ? AND user_id = ?'
    ).bind(tableId, userId).first()

    if (!table) {
      return new Response(JSON.stringify({ error: 'Cross table not found' }), { status: 404, headers: corsHeaders })
    }

    const config = typeof table.config === 'string' ? JSON.parse(table.config) : table.config
    const round = config.delphi?.current_round || 1

    // Get round parameter from query string if provided
    const url = new URL(request.url)
    const queryRound = url.searchParams.get('round')
    const targetRound = queryRound ? parseInt(queryRound, 10) : round

    const scoresResult = await env.DB.prepare(
      'SELECT * FROM cross_table_scores WHERE cross_table_id = ?'
    ).bind(tableId).all()

    const scores = scoresResult.results || []
    const consensus = computeDelphiConsensus(config, scores as any, targetRound)

    return new Response(JSON.stringify({ consensus }), { headers: corsHeaders })
  } catch (err: any) {
    if (err instanceof Response) return err
    console.error('[CrossTable Consensus] Error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
}
