/**
 * Get Claim Adjustments API
 * GET /api/claims/get-adjustments/:content_analysis_id
 * Returns all user adjustments for a specific content analysis
 */

import { getUserIdOrDefault } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }

  try {
    // Get user ID (supports hash-based auth and session auth)
    const userId = await getUserIdOrDefault(context.request, context.env)

    // Get content_analysis_id from URL path parameter
    const contentAnalysisId = context.params.id as string

    if (!contentAnalysisId) {
      return new Response(JSON.stringify({
        error: 'content_analysis_id is required in URL path'
      }), {
        status: 400,
        headers: corsHeaders
      })
    }

    console.log('[Get Claim Adjustments] Fetching adjustments for analysis:', contentAnalysisId)

    // Verify ownership of content analysis
    const analysis = await context.env.DB.prepare(
      'SELECT id, user_id FROM content_analysis WHERE id = ?'
    ).bind(contentAnalysisId).first()

    if (!analysis) {
      console.error('[Get Claim Adjustments] Analysis not found:', contentAnalysisId)
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: corsHeaders
      })
    }

    // Allow access if user owns the analysis
    if (analysis.user_id !== userId) {
      console.error('[Get Claim Adjustments] Unauthorized access attempt for analysis:', contentAnalysisId, 'by user:', userId)
      return new Response(JSON.stringify({ error: 'Unauthorized - you can only view your own adjustments' }), {
        status: 403,
        headers: corsHeaders
      })
    }

    // Get all adjustments for this analysis
    const adjustments = await context.env.DB.prepare(`
      SELECT
        id,
        claim_index,
        claim_text,
        claim_category,
        original_risk_score,
        original_overall_risk,
        original_methods,
        adjusted_risk_score,
        user_comment,
        verification_status,
        adjusted_by,
        created_at,
        updated_at
      FROM claim_adjustments
      WHERE content_analysis_id = ?
      ORDER BY claim_index ASC
    `).bind(contentAnalysisId).all()

    // Parse JSON fields
    const adjustmentsWithParsedData = (adjustments.results || []).map(adj => {
      let parsedMethods = null
      try {
        parsedMethods = adj.original_methods ? JSON.parse(adj.original_methods as string) : null
      } catch (e) {
        console.warn('[Get Claim Adjustments] Failed to parse original_methods for adjustment:', adj.id)
      }
      return {
        ...adj,
        original_methods: parsedMethods
      }
    })

    console.log('[Get Claim Adjustments] Found', adjustmentsWithParsedData.length, 'adjustments')

    return new Response(JSON.stringify({
      success: true,
      adjustments: adjustmentsWithParsedData,
      count: adjustmentsWithParsedData.length
    }), {
      headers: corsHeaders
    })
  } catch (error) {
    console.error('[Get Claim Adjustments] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to load claim adjustments',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: corsHeaders
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
