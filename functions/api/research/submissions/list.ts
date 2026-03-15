/**
 * List Submissions API
 * GET /api/research/submissions/list?formId=xxx&status=pending
 *
 * List submissions for review
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../../_shared/auth-helpers'
import { CORS_HEADERS, JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const userId = await getUserFromRequest(context.request, context.env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

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

    query += ` ORDER BY s.submitted_at DESC LIMIT 500`

    const result = await context.env.DB.prepare(query).bind(...params).all()

    const safeJSON = (val: any, fallback: any = []) => {
      if (!val) return fallback
      try { return JSON.parse(val) } catch { return fallback }
    }

    const submissions = (result.results || []).map((row: any) => ({
      ...row,
      keywords: safeJSON(row.keywords, []),
      metadata: safeJSON(row.metadata, null),
      loginRequired: row.login_required === 1
    }))

    return new Response(JSON.stringify({
      success: true,
      submissions,
      count: submissions.length
    }), {
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[list-submissions] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list submissions'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
