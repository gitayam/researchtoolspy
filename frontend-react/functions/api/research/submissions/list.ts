/**
 * List Submissions API
 * GET /api/research/submissions/list?formId=xxx&status=pending
 *
 * List submissions for review
 */

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const formId = url.searchParams.get('formId')
    const status = url.searchParams.get('status')
    const researchQuestionId = url.searchParams.get('researchQuestionId')

    let query = `
      SELECT
        s.id, s.form_id, s.source_url, s.archived_url,
        s.content_type, s.content_description, s.login_required,
        s.keywords, s.submitter_comments, s.submitter_contact,
        s.submitter_name, s.metadata, s.status, s.processed_at,
        s.evidence_id, s.rejection_reason, s.submitted_at,
        f.form_name, f.hash_id as form_hash
      FROM form_submissions s
      JOIN submission_forms f ON s.form_id = f.id
      WHERE 1=1
    `

    const params: any[] = []

    if (formId) {
      query += ` AND s.form_id = ?`
      params.push(formId)
    }

    if (status) {
      query += ` AND s.status = ?`
      params.push(status)
    }

    if (researchQuestionId) {
      // Filter by forms that target this research question
      query += ` AND json_array_length(json_extract(f.target_research_question_ids, '$')) > 0`
      query += ` AND json_extract(f.target_research_question_ids, '$') LIKE ?`
      params.push(`%"${researchQuestionId}"%`)
    }

    query += ` ORDER BY s.submitted_at DESC`

    const result = await context.env.DB.prepare(query).bind(...params).all()

    const submissions = result.results.map((row: any) => ({
      ...row,
      keywords: row.keywords ? JSON.parse(row.keywords) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      loginRequired: row.login_required === 1
    }))

    return new Response(JSON.stringify({
      success: true,
      submissions,
      count: submissions.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[list-submissions] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list submissions',
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
