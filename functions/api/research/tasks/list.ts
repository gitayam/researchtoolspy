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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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

    query += ` ORDER BY created_at ASC LIMIT 500`

    const stmt = context.env.DB.prepare(query).bind(...params)
    const result = await stmt.all()

    const safeParseJSON = (val: any, fallback: any = []) => {
      if (!val) return fallback
      try { return JSON.parse(val) } catch { return fallback }
    }

    const tasks = result.results.map((row: any) => ({
      ...row,
      depends_on: safeParseJSON(row.depends_on, []),
      blocks: safeParseJSON(row.blocks, []),
      related_evidence: safeParseJSON(row.related_evidence, []),
      related_analysis: safeParseJSON(row.related_analysis, [])
    }))

    return new Response(JSON.stringify({
      success: true,
      tasks,
      count: tasks.length
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (error) {
    console.error('[list-tasks] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list tasks'

    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
