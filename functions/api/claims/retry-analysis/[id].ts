/**
 * Retry Claim Analysis API (dynamic route)
 * POST /api/claims/retry-analysis/:content_analysis_id
 * Re-runs AI deception analysis for claims in a content analysis
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'
import { analyzeClaimsForDeception } from '../../_shared/deception-analysis'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    // Get user ID
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: JSON_HEADERS,
      })
    }

    const contentAnalysisId = context.params.id as string

    if (!contentAnalysisId) {
      return new Response(JSON.stringify({
        error: 'content_analysis_id is required in URL path'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Get the content analysis
    const analysis = await context.env.DB.prepare(`
      SELECT id, user_id, extracted_text, title, claim_analysis
      FROM content_analysis
      WHERE id = ?
    `).bind(contentAnalysisId).first()

    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    // Verify ownership
    if (analysis.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: JSON_HEADERS
      })
    }

    // Parse existing claim analysis
    let claimAnalysis
    try {
      claimAnalysis = analysis.claim_analysis ? JSON.parse(analysis.claim_analysis as string) : null
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to parse existing claim analysis' }), {
        status: 500,
        headers: JSON_HEADERS
      })
    }

    if (!claimAnalysis?.claims || claimAnalysis.claims.length === 0) {
      return new Response(JSON.stringify({ error: 'No claims found to retry analysis' }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Extract claims without deception_analysis
    const claims = claimAnalysis.claims.map((c: any) => ({
      claim: c.claim,
      category: c.category,
      source: c.source,
      confidence: c.confidence || 0.8,
      supporting_text: c.supporting_text
    }))


    // Re-run deception analysis
    const newAnalysis = await analyzeClaimsForDeception(
      claims,
      analysis.extracted_text as string || '',
      context.env,
      {
        source: 'content-intelligence',
        operation: 'retry-claim-analysis',
        timeout: 30000
      }
    )

    // Update database with new analysis
    await context.env.DB.prepare(`
      UPDATE content_analysis
      SET claim_analysis = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      JSON.stringify(newAnalysis),
      contentAnalysisId
    ).run()

    return new Response(JSON.stringify({
      success: true,
      claim_analysis: newAnalysis,
      message: 'Claim analysis re-run successfully'
    }), {
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Retry Claim Analysis] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to retry claim analysis'
    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

/**
 * Analyze claims for deception using multiple methods
 */
// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
