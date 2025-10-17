/**
 * Shared Content Analysis Viewer
 *
 * Public endpoint to view shared content analyses via share token
 * No authentication required
 */

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const token = context.params.token as string

    if (!token) {
      return new Response(JSON.stringify({
        error: 'Missing share token'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // Fetch analysis by share token
    const analysis = await context.env.DB.prepare(`
      SELECT
        id, url, url_normalized, title, author, publish_date,
        domain, is_social_media, social_platform, summary,
        word_count, word_frequency, top_phrases, entities, links_analysis,
        sentiment_analysis, claim_analysis, dime_analysis,
        created_at, updated_at
      FROM content_analysis
      WHERE share_token = ?
        AND is_saved = TRUE
    `).bind(token).first()

    if (!analysis) {
      return new Response(JSON.stringify({
        error: 'Shared analysis not found or has expired'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // Parse JSON fields
    const result = {
      ...analysis,
      word_frequency: analysis.word_frequency ? JSON.parse(analysis.word_frequency as string) : null,
      top_phrases: analysis.top_phrases ? JSON.parse(analysis.top_phrases as string) : null,
      entities: analysis.entities ? JSON.parse(analysis.entities as string) : null,
      links_analysis: analysis.links_analysis ? JSON.parse(analysis.links_analysis as string) : [],
      sentiment_analysis: analysis.sentiment_analysis ? JSON.parse(analysis.sentiment_analysis as string) : null,
      claim_analysis: analysis.claim_analysis ? JSON.parse(analysis.claim_analysis as string) : null,
      dime_analysis: analysis.dime_analysis ? JSON.parse(analysis.dime_analysis as string) : null
    }

    return new Response(JSON.stringify({
      success: true,
      analysis: result,
      is_shared: true
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    })

  } catch (error) {
    console.error('[Share] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to load shared analysis',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}
