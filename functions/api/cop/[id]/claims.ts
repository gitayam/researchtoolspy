/**
 * COP Claims API — List, Create, Update, and Promote claims
 *
 * GET    /api/cop/:id/claims          - List all claims for session
 * POST   /api/cop/:id/claims          - Bulk-create claims from URL extraction
 * PUT    /api/cop/:id/claims/:claimId - Update claim status (verify/dispute/promote)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../../_shared/auth-helpers'
import { createTimelineEntry } from '../../_shared/timeline-helper'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `clm-${crypto.randomUUID().slice(0, 12)}`
}

// GET — list claims for a session
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const url = new URL(request.url)
  const status = url.searchParams.get('status')

  try {
    let query = `SELECT * FROM cop_claims WHERE cop_session_id = ?`
    const bindings: any[] = [sessionId]

    if (status) {
      query += ` AND status = ?`
      bindings.push(status)
    }

    query += ` ORDER BY created_at DESC LIMIT 500`

    const results = await env.DB.prepare(query).bind(...bindings).all()

    return new Response(JSON.stringify({ claims: results.results }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Claims] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list claims' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// POST — bulk-create claims from a URL extraction
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    const body = await request.json() as any

    if (!Array.isArray(body.claims) || body.claims.length === 0) {
      return new Response(JSON.stringify({ error: 'claims[] is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const claims = body.claims.slice(0, 100)

    // Look up session's workspace
    const session = await env.DB.prepare(
      `SELECT workspace_id FROM cop_sessions WHERE id = ?`
    ).bind(sessionId).first<{ workspace_id: string }>()
    const workspaceId = session?.workspace_id ?? sessionId

    const now = new Date().toISOString()
    const ids: string[] = []

    const stmts = claims.map((claim: any) => {
      const id = generateId()
      ids.push(id)
      return env.DB.prepare(`
        INSERT INTO cop_claims (id, cop_session_id, workspace_id, url, url_title, url_domain, claim_text, category, confidence, summary, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, sessionId, workspaceId,
        body.url || null, body.title ?? null, body.domain ?? null,
        claim.claim ?? claim.text ?? '',
        claim.category ?? null,
        claim.confidence ?? 50,
        body.summary ?? null,
        userId, now, now,
      )
    })

    await env.DB.batch(stmts)

    try {
      const domain = body.url ? new URL(body.url).hostname.replace(/^www\./, '') : 'unknown'
      await createTimelineEntry(env.DB, sessionId, workspaceId, userId, {
        title: `Extracted ${ids.length} claims from ${body.domain || domain}`,
        category: 'publication',
        importance: 'normal',
        source_type: 'system',
        entity_type: 'claim',
        entity_id: body.domain || domain,
        action: 'extracted',
      })
    } catch (e) { console.error('[COP Claims] Timeline entry failed:', e) }

    return new Response(JSON.stringify({
      message: `${ids.length} claims saved`,
      ids,
    }), { status: 201, headers: corsHeaders })
  } catch (error) {
    console.error('[COP Claims] Create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to save claims' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// PUT — update a claim's status or promote to evidence
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    const body = await request.json() as any
    const claimId = body.claim_id

    if (!claimId) {
      return new Response(JSON.stringify({ error: 'claim_id is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const session = await env.DB.prepare(
      `SELECT workspace_id FROM cop_sessions WHERE id = ?`
    ).bind(sessionId).first<{ workspace_id: string }>()
    const workspaceId = session?.workspace_id ?? sessionId

    const now = new Date().toISOString()

    // If promoting to evidence, create an evidence_item
    if (body.status === 'verified' && body.promote_to_evidence) {
      const claim = await env.DB.prepare(
        `SELECT * FROM cop_claims WHERE id = ? AND cop_session_id = ?`
      ).bind(claimId, sessionId).first<any>()

      if (!claim) {
        return new Response(JSON.stringify({ error: 'Claim not found' }), {
          status: 404, headers: corsHeaders,
        })
      }

      // Create evidence item from verified claim
      const evidenceRes = await env.DB.prepare(`
        INSERT INTO evidence_items (title, description, url, source_type, confidence_level, credibility, reliability, workspace_id, created_by, created_at, updated_at)
        VALUES (?, ?, ?, 'verified_claim', 'high', 'confirmed', 'usually_reliable', ?, ?, ?, ?)
      `).bind(
        `Verified: ${claim.claim_text.substring(0, 100)}`,
        claim.claim_text,
        claim.url,
        claim.workspace_id,
        userId, now, now,
      ).run()

      const evidenceId = evidenceRes.meta?.last_row_id

      // Update claim with evidence link
      await env.DB.prepare(`
        UPDATE cop_claims SET status = 'verified', evidence_item_id = ?, updated_at = ?
        WHERE id = ? AND cop_session_id = ?
      `).bind(evidenceId, now, claimId, sessionId).run()

      try {
        await createTimelineEntry(env.DB, sessionId, workspaceId, userId, {
          title: `Claim verified: ${claim.claim_text.substring(0, 160)}`,
          category: 'legal',
          importance: 'high',
          source_type: 'system',
          entity_type: 'claim',
          entity_id: claimId,
          action: 'verified',
        })
      } catch { /* non-fatal */ }

      return new Response(JSON.stringify({
        message: 'Claim verified and promoted to evidence',
        evidence_item_id: evidenceId,
      }), { headers: corsHeaders })
    }

    // Simple status update
    const validStatuses = ['unverified', 'verified', 'disputed', 'false']
    if (body.status && !validStatuses.includes(body.status)) {
      return new Response(JSON.stringify({ error: `status must be one of: ${validStatuses.join(', ')}` }), {
        status: 400, headers: corsHeaders,
      })
    }

    const updateResult = await env.DB.prepare(`
      UPDATE cop_claims SET status = ?, updated_at = ?
      WHERE id = ? AND cop_session_id = ?
    `).bind(body.status, now, claimId, sessionId).run()

    if (!updateResult.meta.changes || updateResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Claim not found in this session' }), {
        status: 404, headers: corsHeaders,
      })
    }

    if (body.status === 'verified' || body.status === 'disputed') {
      try {
        const claim = await env.DB.prepare(
          `SELECT claim_text FROM cop_claims WHERE id = ? AND cop_session_id = ?`
        ).bind(claimId, sessionId).first<{ claim_text: string }>()
        if (claim) {
          await createTimelineEntry(env.DB, sessionId, workspaceId, userId, {
            title: `Claim ${body.status}: ${claim.claim_text.substring(0, 160)}`,
            category: body.status === 'verified' ? 'legal' : 'event',
            importance: body.status === 'verified' ? 'high' : 'normal',
            source_type: 'system',
            entity_type: 'claim',
            entity_id: claimId,
            action: body.status,
          })
        }
      } catch (e) { console.error('[COP Claims] Timeline entry failed:', e) }
    }

    return new Response(JSON.stringify({ message: 'Claim updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Claims] Update error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update claim' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// OPTIONS — CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
