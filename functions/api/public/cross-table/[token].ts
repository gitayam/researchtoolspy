// GET /api/public/cross-table/:token — Public read-only view
import { computeRankings } from '../../../../src/lib/cross-table/engine/ranking'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

export async function onRequest(context: any) {
  const { request, env, params } = context
  const token = params.token as string

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
    const table = await env.DB.prepare(
      'SELECT * FROM cross_tables WHERE share_token = ? AND is_public = 1'
    ).bind(token).first()

    if (!table) {
      return new Response(JSON.stringify({ error: 'Cross table not found or not public' }), { status: 404, headers: corsHeaders })
    }

    const scoresResult = await env.DB.prepare(
      'SELECT * FROM cross_table_scores WHERE cross_table_id = ? ORDER BY round, row_id, col_id'
    ).bind(table.id).all()

    const config = typeof table.config === 'string' ? JSON.parse(table.config) : table.config
    const allScores = scoresResult.results || []

    // Compute consensus scores (median per cell) — never expose individual scorer data
    const cellGroups: Record<string, any[]> = {}
    for (const s of allScores as any[]) {
      const key = `${s.round}|${s.row_id}|${s.col_id}`
      if (!cellGroups[key]) cellGroups[key] = []
      cellGroups[key].push(s)
    }

    const consensusScores = Object.values(cellGroups).map((group) => {
      const numericScores = group.map((s: any) => s.score).filter((v: any) => typeof v === 'number')
      let medianScore = null
      if (numericScores.length > 0) {
        numericScores.sort((a: number, b: number) => a - b)
        const mid = Math.floor(numericScores.length / 2)
        medianScore = numericScores.length % 2 !== 0
          ? numericScores[mid]
          : (numericScores[mid - 1] + numericScores[mid]) / 2
      } else {
        // For string scores (traffic/ternary/binary/ach), take the most common value
        const counts: Record<string, number> = {}
        for (const s of group) {
          const val = String(s.score)
          counts[val] = (counts[val] || 0) + 1
        }
        let maxCount = 0
        for (const [val, count] of Object.entries(counts)) {
          if (count > maxCount) { maxCount = count; medianScore = val }
        }
      }
      const ref = group[0]
      return {
        cross_table_id: ref.cross_table_id,
        round: ref.round,
        row_id: ref.row_id,
        col_id: ref.col_id,
        score: medianScore,
      }
    })

    const results = computeRankings(config, consensusScores as any)

    return new Response(JSON.stringify({
      table: {
        ...table,
        config,
        is_public: Boolean(table.is_public),
      },
      scores: consensusScores,
      results,
    }), { headers: corsHeaders })
  } catch (err: any) {
    console.error('[CrossTable Public] Error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
}
