/**
 * ACH (Analysis of Competing Hypotheses) API
 * CRUD operations for ACH analyses
 */

interface Env {
  DB: D1Database
}

interface ACHAnalysis {
  id: string
  user_id: string
  title: string
  description?: string
  question: string
  analyst?: string
  organization?: string
  scale_type: 'logarithmic' | 'linear'
  status: 'draft' | 'in_progress' | 'completed'
  created_at: string
  updated_at: string
}

// GET /api/ach - List all ACH analyses
// GET /api/ach?id=xxx - Get specific analysis
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const id = url.searchParams.get('id')
    const userId = 'demo-user' // TODO: Get from auth

    if (id) {
      // Get specific analysis with hypotheses, evidence, and scores
      const analysis = await context.env.DB.prepare(
        'SELECT * FROM ach_analyses WHERE id = ? AND user_id = ?'
      ).bind(id, userId).first()

      if (!analysis) {
        return new Response(JSON.stringify({ error: 'Analysis not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Get hypotheses
      const hypotheses = await context.env.DB.prepare(
        'SELECT * FROM ach_hypotheses WHERE ach_analysis_id = ? ORDER BY order_num'
      ).bind(id).all()

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
      `).bind(id).all()

      // Get scores
      const scores = await context.env.DB.prepare(
        'SELECT * FROM ach_scores WHERE ach_analysis_id = ?'
      ).bind(id).all()

      return new Response(JSON.stringify({
        ...analysis,
        hypotheses: hypotheses.results || [],
        evidence: evidenceLinks.results || [],
        scores: scores.results || []
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      // List all analyses
      const analyses = await context.env.DB.prepare(
        'SELECT * FROM ach_analyses WHERE user_id = ? ORDER BY created_at DESC'
      ).bind(userId).all()

      return new Response(JSON.stringify({
        analyses: analyses.results || []
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('ACH GET error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch ACH analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// POST /api/ach - Create new analysis
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const data = await context.request.json() as Partial<ACHAnalysis>
    const userId = 'demo-user' // TODO: Get from auth

    if (!data.title || !data.question) {
      return new Response(JSON.stringify({
        error: 'Title and question are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await context.env.DB.prepare(`
      INSERT INTO ach_analyses (
        id, user_id, title, description, question, analyst, organization,
        scale_type, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      userId,
      data.title,
      data.description || null,
      data.question,
      data.analyst || null,
      data.organization || null,
      data.scale_type || 'logarithmic',
      data.status || 'draft',
      now,
      now
    ).run()

    return new Response(JSON.stringify({
      id,
      ...data,
      user_id: userId,
      created_at: now,
      updated_at: now
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('ACH POST error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create ACH analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// PUT /api/ach?id=xxx - Update analysis
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const id = url.searchParams.get('id')
    const userId = 'demo-user' // TODO: Get from auth

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const data = await context.request.json() as Partial<ACHAnalysis>

    // Verify ownership
    const existing = await context.env.DB.prepare(
      'SELECT id FROM ach_analyses WHERE id = ? AND user_id = ?'
    ).bind(id, userId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const now = new Date().toISOString()

    await context.env.DB.prepare(`
      UPDATE ach_analyses SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        question = COALESCE(?, question),
        analyst = COALESCE(?, analyst),
        organization = COALESCE(?, organization),
        scale_type = COALESCE(?, scale_type),
        status = COALESCE(?, status),
        updated_at = ?
      WHERE id = ?
    `).bind(
      data.title || null,
      data.description || null,
      data.question || null,
      data.analyst || null,
      data.organization || null,
      data.scale_type || null,
      data.status || null,
      now,
      id
    ).run()

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('ACH PUT error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update ACH analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// DELETE /api/ach?id=xxx - Delete analysis
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const id = url.searchParams.get('id')
    const userId = 'demo-user' // TODO: Get from auth

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify ownership
    const existing = await context.env.DB.prepare(
      'SELECT id FROM ach_analyses WHERE id = ? AND user_id = ?'
    ).bind(id, userId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Delete (CASCADE will handle related tables)
    await context.env.DB.prepare(
      'DELETE FROM ach_analyses WHERE id = ?'
    ).bind(id).run()

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('ACH DELETE error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete ACH analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
