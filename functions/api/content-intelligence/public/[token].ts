/**
 * Public Content Analysis View API
 * GET /api/content-intelligence/public/:token - View public content analysis (no auth required)
 */

interface Env {
  DB: D1Database
}

// GET /api/content-intelligence/public/:token - Get public content analysis
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { token } = context.params

    if (!token) {
      return new Response(JSON.stringify({ error: 'Share token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get analysis by share token (must be public)
    const analysis = await context.env.DB.prepare(
      'SELECT * FROM content_analysis WHERE share_token = ? AND is_public = 1'
    ).bind(token).first()

    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found or not public' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Increment view count
    await context.env.DB.prepare(
      'UPDATE content_analysis SET view_count = view_count + 1 WHERE id = ?'
    ).bind(analysis.id).run()

    // Parse JSON fields
    const parseJsonField = (field: any) => {
      if (!field) return null
      if (typeof field === 'string') {
        try {
          return JSON.parse(field)
        } catch (e) {
          return null
        }
      }
      return field
    }

    return new Response(JSON.stringify({
      ...analysis,
      word_frequency: parseJsonField(analysis.word_frequency),
      top_phrases: parseJsonField(analysis.top_phrases),
      entities: parseJsonField(analysis.entities),
      links_analysis: parseJsonField(analysis.links_analysis),
      sentiment_analysis: parseJsonField(analysis.sentiment_analysis),
      keyphrases: parseJsonField(analysis.keyphrases),
      topics: parseJsonField(analysis.topics),
      claim_analysis: parseJsonField(analysis.claim_analysis),
      dime_analysis: parseJsonField(analysis.dime_analysis),
      archive_urls: parseJsonField(analysis.archive_urls),
      bypass_urls: parseJsonField(analysis.bypass_urls)
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Public content analysis view error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch public analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
