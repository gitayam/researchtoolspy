/**
 * ACH Scoring API
 * Manage scores for hypothesis-evidence pairs in ACH matrix
 */

interface Env {
  DB: D1Database
}

interface ACHScore {
  id: string
  ach_analysis_id: string
  hypothesis_id: string
  evidence_id: string
  score: number
  credibility?: number  // 1-5
  relevance?: number    // 1-5
  notes?: string
  scored_by?: string
  scored_at: string
}

// POST /api/ach/scores - Add/update score
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const data = await context.request.json() as Partial<ACHScore>
    const userId = 'demo-user' // TODO: Get from auth

    if (!data.ach_analysis_id || !data.hypothesis_id || !data.evidence_id || data.score === undefined) {
      return new Response(JSON.stringify({
        error: 'ACH analysis ID, hypothesis ID, evidence ID, and score are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify ownership of analysis
    const analysis = await context.env.DB.prepare(
      'SELECT id FROM ach_analyses WHERE id = ? AND user_id = ?'
    ).bind(data.ach_analysis_id, userId).first()

    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify hypothesis belongs to analysis
    const hypothesis = await context.env.DB.prepare(
      'SELECT id FROM ach_hypotheses WHERE id = ? AND ach_analysis_id = ?'
    ).bind(data.hypothesis_id, data.ach_analysis_id).first()

    if (!hypothesis) {
      return new Response(JSON.stringify({ error: 'Hypothesis not found in this analysis' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify evidence is linked to analysis
    const evidenceLink = await context.env.DB.prepare(
      'SELECT id FROM ach_evidence_links WHERE evidence_id = ? AND ach_analysis_id = ?'
    ).bind(data.evidence_id, data.ach_analysis_id).first()

    if (!evidenceLink) {
      return new Response(JSON.stringify({ error: 'Evidence not linked to this analysis' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const now = new Date().toISOString()

    // Check if score already exists (UPDATE) or create new (INSERT)
    const existing = await context.env.DB.prepare(
      'SELECT id FROM ach_scores WHERE hypothesis_id = ? AND evidence_id = ?'
    ).bind(data.hypothesis_id, data.evidence_id).first() as { id: string } | null

    if (existing) {
      // Update existing score
      await context.env.DB.prepare(`
        UPDATE ach_scores SET
          score = ?,
          credibility = COALESCE(?, credibility),
          relevance = COALESCE(?, relevance),
          notes = COALESCE(?, notes),
          scored_by = ?,
          scored_at = ?
        WHERE id = ?
      `).bind(
        data.score,
        data.credibility ?? null,
        data.relevance ?? null,
        data.notes || null,
        userId,
        now,
        existing.id
      ).run()

      return new Response(JSON.stringify({
        id: existing.id,
        ...data,
        scored_by: userId,
        scored_at: now
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      // Insert new score
      const id = crypto.randomUUID()

      await context.env.DB.prepare(`
        INSERT INTO ach_scores (
          id, ach_analysis_id, hypothesis_id, evidence_id,
          score, credibility, relevance, notes, scored_by, scored_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        data.ach_analysis_id,
        data.hypothesis_id,
        data.evidence_id,
        data.score,
        data.credibility ?? null,
        data.relevance ?? null,
        data.notes || null,
        userId,
        now
      ).run()

      return new Response(JSON.stringify({
        id,
        ...data,
        scored_by: userId,
        scored_at: now
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('Score POST error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to save score',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// DELETE /api/ach/scores?id=xxx - Delete score
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const id = url.searchParams.get('id')
    const userId = 'demo-user' // TODO: Get from auth

    if (!id) {
      return new Response(JSON.stringify({ error: 'Score ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify ownership through analysis
    const existing = await context.env.DB.prepare(`
      SELECT s.id
      FROM ach_scores s
      JOIN ach_analyses a ON s.ach_analysis_id = a.id
      WHERE s.id = ? AND a.user_id = ?
    `).bind(id, userId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Score not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    await context.env.DB.prepare(
      'DELETE FROM ach_scores WHERE id = ?'
    ).bind(id).run()

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Score DELETE error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete score',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
