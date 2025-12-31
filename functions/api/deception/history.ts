/**
 * Deception History API
 * Returns historical deception analyses for trend predictions
 */

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  'Content-Type': 'application/json',
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const url = new URL(request.url)
    const workspaceId = url.searchParams.get('workspace_id') || '1'
    const excludeId = url.searchParams.get('exclude_id') // Current analysis to exclude
    const limit = parseInt(url.searchParams.get('limit') || '20')

    // Query historical deception framework sessions
    let query = `
      SELECT
        id,
        title,
        data,
        created_at,
        updated_at
      FROM framework_sessions
      WHERE workspace_id = ?
        AND framework_type = 'deception'
        AND data IS NOT NULL
    `

    const bindings: any[] = [workspaceId]

    if (excludeId) {
      query += ` AND id != ?`
      bindings.push(excludeId)
    }

    query += ` ORDER BY updated_at DESC LIMIT ?`
    bindings.push(limit)

    const result = await env.DB.prepare(query).bind(...bindings).all()

    // Transform to historical data format for predictions
    const historicalData: Array<{
      id: string
      title: string
      timestamp: string
      likelihood: number
      scores: any
    }> = []

    for (const row of result.results || []) {
      try {
        let data: any = row.data

        // Parse JSON if it's a string
        if (typeof data === 'string') {
          data = JSON.parse(data)
        }

        // Skip if no valid data
        if (!data || typeof data !== 'object') continue

        // Extract likelihood and scores
        const likelihood = data.calculatedAssessment?.likelihood
          ?? data.aiAnalysis?.deceptionLikelihood
          ?? null

        const scores = data.scores

        // Only include if we have either likelihood or scores
        if (likelihood !== null || (scores && Object.keys(scores).length > 0)) {
          historicalData.push({
            id: String(row.id),
            title: row.title as string,
            timestamp: (row.updated_at || row.created_at) as string,
            likelihood: likelihood ?? 50, // Default to 50 if not calculated
            scores: scores || {}
          })
        }
      } catch (parseError) {
        // Skip entries with malformed data
        console.error('Failed to parse historical data for ID:', row.id, parseError)
        continue
      }
    }

    // Sort by timestamp ascending (oldest first) for trend analysis
    historicalData.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    return new Response(JSON.stringify({
      history: historicalData,
      count: historicalData.length,
      workspace_id: workspaceId
    }), {
      status: 200,
      headers: corsHeaders,
    })

  } catch (error) {
    console.error('Deception history error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch history',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
