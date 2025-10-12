/**
 * Content Intelligence Analysis Status API
 * GET /api/content-intelligence/status/[id]
 * Returns current processing status and partial results
 */

interface Env {
  DB: D1Database
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  'Content-Type': 'application/json',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, env } = context
  const analysisId = params.id as string

  try {
    // Get analysis from database
    const analysis = await env.DB.prepare(`
      SELECT * FROM content_analysis WHERE id = ?
    `).bind(analysisId).first()

    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: CORS_HEADERS
      })
    }

    // Parse JSON fields
    const result = {
      ...analysis,
      entities: JSON.parse(analysis.entities as string || '{}'),
      word_frequency: JSON.parse(analysis.word_frequency as string || '{}'),
      top_phrases: JSON.parse(analysis.top_phrases as string || '[]'),
      sentiment_analysis: analysis.sentiment_analysis ? JSON.parse(analysis.sentiment_analysis as string) : null,
      keyphrases: analysis.keyphrases ? JSON.parse(analysis.keyphrases as string) : null,
      topics: analysis.topics ? JSON.parse(analysis.topics as string) : null,
      claim_analysis: analysis.claim_analysis ? JSON.parse(analysis.claim_analysis as string) : null,
      archive_urls: JSON.parse(analysis.archive_urls as string || '{}'),
      bypass_urls: JSON.parse(analysis.bypass_urls as string || '{}'),
    }

    // Determine completion status for each component
    const status = {
      summary: result.summary ? 'complete' : 'pending',
      wordFrequency: (result.word_frequency && Object.keys(result.word_frequency).length > 0) ? 'complete' : 'pending',
      entities: (result.entities && (result.entities.people?.length || result.entities.organizations?.length || result.entities.locations?.length)) ? 'complete' : 'pending',
      sentiment: result.sentiment_analysis ? 'complete' : 'pending',
      keyphrases: (result.keyphrases && result.keyphrases.length > 0) ? 'complete' : 'pending',
      topics: (result.topics && result.topics.length > 0) ? 'complete' : 'pending',
      claims: result.claim_analysis ? 'complete' : 'pending',
      overall: 'processing' as 'processing' | 'complete' | 'error'
    }

    // Check if all core components are complete
    const allComplete = status.summary === 'complete' &&
                       status.wordFrequency === 'complete' &&
                       status.entities === 'complete' &&
                       status.sentiment === 'complete'

    if (allComplete) {
      status.overall = 'complete'
    }

    return new Response(JSON.stringify({
      analysis: result,
      status,
      progress: calculateProgress(status)
    }), {
      headers: CORS_HEADERS
    })

  } catch (error) {
    console.error('[Status API] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch analysis status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: CORS_HEADERS
  })
}

function calculateProgress(status: any): number {
  const components = [
    status.summary,
    status.wordFrequency,
    status.entities,
    status.sentiment,
    status.keyphrases,
    status.topics,
    status.claims
  ]

  const completed = components.filter(s => s === 'complete').length
  return Math.round((completed / components.length) * 100)
}
