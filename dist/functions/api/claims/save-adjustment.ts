/**
 * Save Claim Adjustment API
 * POST /api/claims/save-adjustment
 * Saves user's adjusted risk score and comments for a specific claim
 */

import { requireAuth } from '../_shared/auth-helpers'
import crypto from 'node:crypto'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface SaveAdjustmentRequest {
  content_analysis_id: number
  claim_index: number
  claim_text: string
  claim_category?: string

  // Original AI analysis
  original_risk_score: number
  original_overall_risk: string
  original_methods?: Record<string, { score: number; reasoning: string }>

  // User adjustments
  adjusted_risk_score: number
  adjusted_claim_text?: string | null // User-edited claim wording
  adjusted_methods?: Record<string, { score: number; reasoning: string }> // User-edited method scores
  user_comment: string
  verification_status?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const auth = await requireAuth(context)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await context.request.json() as SaveAdjustmentRequest

    // Validate required fields
    if (!body.content_analysis_id || body.claim_index === undefined) {
      return new Response(JSON.stringify({
        error: 'content_analysis_id and claim_index are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (body.adjusted_risk_score === undefined || !body.claim_text) {
      return new Response(JSON.stringify({
        error: 'adjusted_risk_score and claim_text are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify ownership of content analysis
    const analysis = await context.env.DB.prepare(
      'SELECT id, user_id FROM content_analysis WHERE id = ?'
    ).bind(body.content_analysis_id).first()

    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (analysis.user_id !== auth.user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const now = new Date().toISOString()

    // Check if adjustment already exists
    const existing = await context.env.DB.prepare(
      'SELECT id FROM claim_adjustments WHERE content_analysis_id = ? AND claim_index = ?'
    ).bind(body.content_analysis_id, body.claim_index).first()

    if (existing) {
      // Update existing adjustment
      await context.env.DB.prepare(`
        UPDATE claim_adjustments SET
          claim_text = ?,
          claim_category = ?,
          original_risk_score = ?,
          original_overall_risk = ?,
          original_methods = ?,
          adjusted_risk_score = ?,
          adjusted_claim_text = ?,
          adjusted_methods = ?,
          user_comment = ?,
          verification_status = ?,
          updated_at = ?
        WHERE id = ?
      `).bind(
        body.claim_text,
        body.claim_category || null,
        body.original_risk_score,
        body.original_overall_risk,
        JSON.stringify(body.original_methods || {}),
        body.adjusted_risk_score,
        body.adjusted_claim_text || null,
        body.adjusted_methods ? JSON.stringify(body.adjusted_methods) : null,
        body.user_comment || null,
        body.verification_status || 'pending',
        now,
        existing.id
      ).run()

      return new Response(JSON.stringify({
        success: true,
        id: existing.id,
        updated: true
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      // Create new adjustment
      const id = crypto.randomUUID()

      await context.env.DB.prepare(`
        INSERT INTO claim_adjustments (
          id, content_analysis_id, claim_index, claim_text, claim_category,
          original_risk_score, original_overall_risk, original_methods,
          adjusted_risk_score, adjusted_claim_text, adjusted_methods,
          user_comment, verification_status,
          adjusted_by, workspace_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.content_analysis_id,
        body.claim_index,
        body.claim_text,
        body.claim_category || null,
        body.original_risk_score,
        body.original_overall_risk,
        JSON.stringify(body.original_methods || {}),
        body.adjusted_risk_score,
        body.adjusted_claim_text || null,
        body.adjusted_methods ? JSON.stringify(body.adjusted_methods) : null,
        body.user_comment || null,
        body.verification_status || 'pending',
        auth.user.id,
        '1', // Default workspace
        now,
        now
      ).run()

      return new Response(JSON.stringify({
        success: true,
        id,
        created: true
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('[Save Claim Adjustment] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to save claim adjustment',
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
