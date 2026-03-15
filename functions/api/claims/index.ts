/**
 * Claims API - List all saved claims
 * GET /api/claims - List all claim adjustments for user's workspace
 */

import { requireAuth } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)

    // Get user's workspace
    const workspace = await context.env.DB.prepare(`
      SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1
    `).bind(userId).first()

    if (!workspace) {
      return new Response(JSON.stringify({
        claims: [],
        total: 0
      }), {
        headers: JSON_HEADERS
      })
    }

    const workspaceId = workspace.workspace_id as string

    // Get query parameters
    const url = new URL(context.request.url)
    const status = url.searchParams.get('status') || 'all'
    const category = url.searchParams.get('category')

    // Build query
    let query = `
      SELECT
        ca.*,
        u.username as adjusted_by_username,
        c.title as content_title,
        c.url as content_url
      FROM claim_adjustments ca
      LEFT JOIN users u ON ca.adjusted_by = u.id
      LEFT JOIN content_analysis c ON ca.content_analysis_id = c.id
      WHERE ca.workspace_id = ?
    `

    const bindings = [workspaceId]

    if (status && status !== 'all') {
      query += ` AND ca.verification_status = ?`
      bindings.push(status)
    }

    if (category) {
      query += ` AND ca.claim_category = ?`
      bindings.push(category)
    }

    query += ` ORDER BY ca.updated_at DESC LIMIT 500`

    const claims = await context.env.DB.prepare(query)
      .bind(...bindings)
      .all()

    // Parse JSON fields
    const parsed = (claims.results || []).map((claim: any) => ({
      ...claim,
      original_methods: claim.original_methods ? JSON.parse(claim.original_methods) : null,
      adjusted_methods: claim.adjusted_methods ? JSON.parse(claim.adjusted_methods) : null
    }))

    return new Response(JSON.stringify({
      claims: parsed,
      total: parsed.length
    }), {
      headers: JSON_HEADERS
    })
  } catch (error) {
    console.error('[claims] Error listing:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list claims'

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
