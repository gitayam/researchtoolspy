/**
 * Public ACH Analysis Clone API
 * POST /api/ach/public/:token/clone - Clone public analysis to user's workspace
 */

interface Env {
  DB: D1Database
}

// POST /api/ach/public/:token/clone - Clone public analysis
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { token } = context.params
    const userId = 'demo-user' // TODO: Get from auth

    if (!token) {
      return new Response(JSON.stringify({ error: 'Share token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get public analysis
    const sourceAnalysis = await context.env.DB.prepare(
      'SELECT * FROM ach_analyses WHERE share_token = ? AND is_public = 1'
    ).bind(token).first()

    if (!sourceAnalysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found or not public' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create new analysis (clone)
    const newId = crypto.randomUUID()
    const now = new Date().toISOString()

    await context.env.DB.prepare(`
      INSERT INTO ach_analyses (
        id, user_id, title, description, question, analyst, organization,
        scale_type, status, domain, tags, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      newId,
      userId,
      `${sourceAnalysis.title} (Clone)`,
      sourceAnalysis.description || null,
      sourceAnalysis.question,
      sourceAnalysis.analyst || null,
      sourceAnalysis.organization || null,
      sourceAnalysis.scale_type,
      'draft', // Reset to draft
      sourceAnalysis.domain || null,
      sourceAnalysis.tags || null,
      now,
      now
    ).run()

    // Clone hypotheses
    const hypotheses = await context.env.DB.prepare(
      'SELECT * FROM ach_hypotheses WHERE ach_analysis_id = ? ORDER BY order_num'
    ).bind(sourceAnalysis.id).all()

    for (const hyp of (hypotheses.results || [])) {
      const hypId = crypto.randomUUID()
      await context.env.DB.prepare(`
        INSERT INTO ach_hypotheses (
          id, ach_analysis_id, text, order_num, rationale, source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        hypId,
        newId,
        hyp.text,
        hyp.order_num,
        hyp.rationale || null,
        hyp.source || null,
        now
      ).run()
    }

    // Clone evidence links (but not scores - user starts fresh)
    const evidenceLinks = await context.env.DB.prepare(
      'SELECT * FROM ach_evidence_links WHERE ach_analysis_id = ?'
    ).bind(sourceAnalysis.id).all()

    for (const link of (evidenceLinks.results || [])) {
      const linkId = crypto.randomUUID()
      await context.env.DB.prepare(`
        INSERT INTO ach_evidence_links (
          id, ach_analysis_id, evidence_id, added_by, added_at
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        linkId,
        newId,
        link.evidence_id,
        userId,
        now
      ).run()
    }

    // Increment clone count on source analysis
    await context.env.DB.prepare(
      'UPDATE ach_analyses SET clone_count = clone_count + 1 WHERE id = ?'
    ).bind(sourceAnalysis.id).run()

    return new Response(JSON.stringify({
      success: true,
      id: newId,
      title: `${sourceAnalysis.title} (Clone)`,
      message: 'Analysis cloned successfully. You can now score the evidence.'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('ACH clone error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to clone analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
