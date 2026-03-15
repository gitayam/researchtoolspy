/**
 * Link Claim to Evidence API
 * POST /api/claims/link-evidence
 * Creates a relationship between a claim adjustment and an evidence item
 */

import { requireAuth } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'
import crypto from 'node:crypto'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface LinkEvidenceRequest {
  claim_adjustment_id: string
  evidence_id: string
  relationship: 'supports' | 'contradicts' | 'provides_context'
  relevance_score?: number // 0-100
  confidence?: number // 0-100
  notes?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const authUserId = await requireAuth(context.request, context.env)

    const body = await context.request.json() as LinkEvidenceRequest

    // Validate required fields
    if (!body.claim_adjustment_id || !body.evidence_id || !body.relationship) {
      return new Response(JSON.stringify({
        error: 'claim_adjustment_id, evidence_id, and relationship are required'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Validate relationship type
    const validRelationships = ['supports', 'contradicts', 'provides_context']
    if (!validRelationships.includes(body.relationship)) {
      return new Response(JSON.stringify({
        error: 'relationship must be one of: supports, contradicts, provides_context'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Verify ownership of claim adjustment
    const claimAdjustment = await context.env.DB.prepare(`
      SELECT ca.id, ca.adjusted_by, co.user_id as content_owner
      FROM claim_adjustments ca
      JOIN content_analysis co ON ca.content_analysis_id = co.id
      WHERE ca.id = ?
    `).bind(body.claim_adjustment_id).first()

    if (!claimAdjustment) {
      return new Response(JSON.stringify({ error: 'Claim adjustment not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    // Only the user who owns the content analysis can link evidence
    if (claimAdjustment.content_owner !== authUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized to link evidence to this claim' }), {
        status: 403,
        headers: JSON_HEADERS
      })
    }

    // Verify evidence exists and user has access
    const evidence = await context.env.DB.prepare(`
      SELECT id, user_id
      FROM evidence
      WHERE id = ?
    `).bind(body.evidence_id).first()

    if (!evidence) {
      return new Response(JSON.stringify({ error: 'Evidence not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    // User must own the evidence or it must be shared with them
    if (evidence.user_id !== authUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized to link this evidence' }), {
        status: 403,
        headers: JSON_HEADERS
      })
    }

    // Check if link already exists
    const existing = await context.env.DB.prepare(`
      SELECT id
      FROM claim_evidence_links
      WHERE claim_adjustment_id = ? AND evidence_id = ?
    `).bind(body.claim_adjustment_id, body.evidence_id).first()

    if (existing) {
      return new Response(JSON.stringify({
        error: 'This evidence is already linked to this claim',
        existing_link_id: existing.id
      }), {
        status: 409,
        headers: JSON_HEADERS
      })
    }

    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    // Create the link
    await context.env.DB.prepare(`
      INSERT INTO claim_evidence_links (
        id, claim_adjustment_id, evidence_id,
        relationship, relevance_score, confidence,
        notes, linked_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.claim_adjustment_id,
      body.evidence_id,
      body.relationship,
      body.relevance_score ?? 50,
      body.confidence ?? 50,
      body.notes || null,
      authUserId,
      now
    ).run()

    return new Response(JSON.stringify({
      success: true,
      id,
      message: 'Evidence linked to claim successfully'
    }), {
      headers: JSON_HEADERS
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[Link Evidence] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to link evidence to claim'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

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
