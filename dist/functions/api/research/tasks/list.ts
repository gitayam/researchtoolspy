/**
 * List Tasks API
 * GET /api/research/tasks/list?researchQuestionId=xxx
 *
 * List all tasks for a research question or investigation
 */

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const researchQuestionId = url.searchParams.get('researchQuestionId')
    const investigationPacketId = url.searchParams.get('investigationPacketId')
    const status = url.searchParams.get('status')
    const stage = url.searchParams.get('stage')

    if (!researchQuestionId && !investigationPacketId) {
      return new Response(JSON.stringify({
        error: 'Must provide researchQuestionId or investigationPacketId'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let query = `
      SELECT * FROM research_tasks
      WHERE 1=1
    `
    const params: any[] = []

    if (researchQuestionId) {
      query += ` AND research_question_id = ?`
      params.push(researchQuestionId)
    }

    if (investigationPacketId) {
      query += ` AND investigation_packet_id = ?`
      params.push(investigationPacketId)
    }

    if (status) {
      query += ` AND status = ?`
      params.push(status)
    }

    if (stage) {
      query += ` AND workflow_stage = ?`
      params.push(stage)
    }

    query += ` ORDER BY created_at ASC`

    const stmt = context.env.DB.prepare(query).bind(...params)
    const result = await stmt.all()

    const tasks = result.results.map((row: any) => ({
      ...row,
      depends_on: row.depends_on ? JSON.parse(row.depends_on) : [],
      blocks: row.blocks ? JSON.parse(row.blocks) : [],
      related_evidence: row.related_evidence ? JSON.parse(row.related_evidence) : [],
      related_analysis: row.related_analysis ? JSON.parse(row.related_analysis) : []
    }))

    return new Response(JSON.stringify({
      success: true,
      tasks,
      count: tasks.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[list-tasks] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
