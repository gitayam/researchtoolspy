/**
 * List Forms API
 * GET /api/research/forms/list?workspaceId=xxx
 *
 * List all submission forms for a workspace
 */

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const workspaceId = url.searchParams.get('workspaceId') || '1'
    const activeOnly = url.searchParams.get('activeOnly') === 'true'

    let query = `
      SELECT
        id, hash_id, form_name, form_description,
        target_investigation_ids, target_research_question_ids,
        enabled_fields, is_active, submission_count,
        created_at, updated_at, expires_at
      FROM submission_forms
      WHERE creator_workspace_id = ?
    `

    const params: any[] = [workspaceId]

    if (activeOnly) {
      query += ` AND is_active = 1`
    }

    query += ` ORDER BY created_at DESC`

    const result = await context.env.DB.prepare(query).bind(...params).all()

    const forms = result.results.map((row: any) => ({
      ...row,
      targetInvestigationIds: JSON.parse(row.target_investigation_ids || '[]'),
      targetResearchQuestionIds: JSON.parse(row.target_research_question_ids || '[]'),
      enabledFields: JSON.parse(row.enabled_fields || '[]'),
      submissionUrl: `/submit/${row.hash_id}`
    }))

    return new Response(JSON.stringify({
      success: true,
      forms,
      count: forms.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[list-forms] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list forms',
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
