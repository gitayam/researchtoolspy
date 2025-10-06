/**
 * Public ACH Analysis View API
 * GET /api/ach/public/:token - View public ACH analysis (no auth required)
 */

interface Env {
  DB: D1Database
}

// GET /api/ach/public/:token - Get public ACH analysis
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
      'SELECT * FROM ach_analyses WHERE share_token = ? AND is_public = 1'
    ).bind(token).first()

    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found or not public' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Increment view count
    await context.env.DB.prepare(
      'UPDATE ach_analyses SET view_count = view_count + 1 WHERE id = ?'
    ).bind(analysis.id).run()

    // Get hypotheses
    const hypotheses = await context.env.DB.prepare(
      'SELECT * FROM ach_hypotheses WHERE ach_analysis_id = ? ORDER BY order_num'
    ).bind(analysis.id).all()

    // Get evidence links with evidence details
    const evidenceLinks = await context.env.DB.prepare(`
      SELECT
        ael.id as link_id,
        ael.evidence_id,
        e.title as evidence_title,
        e.content as evidence_content,
        e.source,
        e.date,
        e.credibility_score
      FROM ach_evidence_links ael
      JOIN evidence e ON ael.evidence_id = e.id
      WHERE ael.ach_analysis_id = ?
    `).bind(analysis.id).all()

    // Get scores
    const scores = await context.env.DB.prepare(
      'SELECT * FROM ach_scores WHERE ach_analysis_id = ?'
    ).bind(analysis.id).all()

    // Parse tags if present
    let tags = null
    if (analysis.tags && typeof analysis.tags === 'string') {
      try {
        tags = JSON.parse(analysis.tags as string)
      } catch (e) {
        console.error('Failed to parse tags:', e)
      }
    }

    return new Response(JSON.stringify({
      ...analysis,
      tags,
      hypotheses: hypotheses.results || [],
      evidence: evidenceLinks.results || [],
      scores: scores.results || []
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Public ACH view error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch public analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
