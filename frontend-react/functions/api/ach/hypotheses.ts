/**
 * ACH Hypotheses Management API
 * CRUD operations for hypotheses within an ACH analysis
 */

interface Env {
  DB: D1Database
}

interface Hypothesis {
  id: string
  ach_analysis_id: string
  text: string
  order_num: number
  rationale?: string
  source?: string
  created_at: string
}

// POST /api/ach/hypotheses - Add new hypothesis
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const data = await context.request.json() as Partial<Hypothesis>
    const userId = 'demo-user' // TODO: Get from auth

    if (!data.ach_analysis_id || !data.text) {
      return new Response(JSON.stringify({
        error: 'ACH analysis ID and hypothesis text are required'
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

    // Get next order_num
    const maxOrder = await context.env.DB.prepare(
      'SELECT MAX(order_num) as max_order FROM ach_hypotheses WHERE ach_analysis_id = ?'
    ).bind(data.ach_analysis_id).first() as { max_order: number | null }

    const orderNum = data.order_num ?? ((maxOrder?.max_order ?? -1) + 1)

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await context.env.DB.prepare(`
      INSERT INTO ach_hypotheses (
        id, ach_analysis_id, text, order_num, rationale, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      data.ach_analysis_id,
      data.text,
      orderNum,
      data.rationale || null,
      data.source || null,
      now
    ).run()

    return new Response(JSON.stringify({
      id,
      ...data,
      order_num: orderNum,
      created_at: now
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Hypothesis POST error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create hypothesis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// PUT /api/ach/hypotheses?id=xxx - Update hypothesis
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const id = url.searchParams.get('id')
    const userId = 'demo-user' // TODO: Get from auth

    if (!id) {
      return new Response(JSON.stringify({ error: 'Hypothesis ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const data = await context.request.json() as Partial<Hypothesis>

    // Verify ownership through analysis
    const existing = await context.env.DB.prepare(`
      SELECT h.id
      FROM ach_hypotheses h
      JOIN ach_analyses a ON h.ach_analysis_id = a.id
      WHERE h.id = ? AND a.user_id = ?
    `).bind(id, userId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Hypothesis not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    await context.env.DB.prepare(`
      UPDATE ach_hypotheses SET
        text = COALESCE(?, text),
        order_num = COALESCE(?, order_num),
        rationale = COALESCE(?, rationale),
        source = COALESCE(?, source)
      WHERE id = ?
    `).bind(
      data.text || null,
      data.order_num ?? null,
      data.rationale || null,
      data.source || null,
      id
    ).run()

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Hypothesis PUT error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update hypothesis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// DELETE /api/ach/hypotheses?id=xxx - Delete hypothesis
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const id = url.searchParams.get('id')
    const userId = 'demo-user' // TODO: Get from auth

    if (!id) {
      return new Response(JSON.stringify({ error: 'Hypothesis ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify ownership through analysis
    const existing = await context.env.DB.prepare(`
      SELECT h.id
      FROM ach_hypotheses h
      JOIN ach_analyses a ON h.ach_analysis_id = a.id
      WHERE h.id = ? AND a.user_id = ?
    `).bind(id, userId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Hypothesis not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Delete (CASCADE will handle scores)
    await context.env.DB.prepare(
      'DELETE FROM ach_hypotheses WHERE id = ?'
    ).bind(id).run()

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Hypothesis DELETE error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete hypothesis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
