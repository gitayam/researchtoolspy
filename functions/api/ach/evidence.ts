/**
 * ACH Evidence Linking API
 * Link/unlink evidence from Evidence Library to ACH analyses
 */

import { getUserFromRequest } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface EvidenceLink {
  id: string
  ach_analysis_id: string
  evidence_id: string
  added_by?: string
  added_at: string
}

// POST /api/ach/evidence - Link evidence to analysis
export const onRequestPost: PagesFunction<Env> = async (context) => {

  try {
    const url = new URL(context.request.url)
    const data = await context.request.json() as Partial<EvidenceLink>

    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // Get workspace_id from query params, header, or default to '1'
    const workspaceId = url.searchParams.get('workspace_id') || context.request.headers.get('X-Workspace-ID') || null

    if (!data.ach_analysis_id || !data.evidence_id) {
      return new Response(JSON.stringify({
        error: 'ACH analysis ID and evidence ID are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // WORKSPACE ISOLATION: Verify ownership of analysis AND workspace
    const analysis = await context.env.DB.prepare(
      'SELECT id FROM ach_analyses WHERE id = ? AND user_id = ? AND workspace_id = ?'
    ).bind(data.ach_analysis_id, userId, workspaceId).first()

    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found in workspace' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Verify evidence exists
    const evidence = await context.env.DB.prepare(
      'SELECT id FROM evidence_items WHERE id = ?'
    ).bind(data.evidence_id).first()

    if (!evidence) {
      return new Response(JSON.stringify({ error: 'Evidence not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Check if already linked
    const existing = await context.env.DB.prepare(
      'SELECT id FROM ach_evidence_links WHERE ach_analysis_id = ? AND evidence_id = ?'
    ).bind(data.ach_analysis_id, data.evidence_id).first()

    if (existing) {
      return new Response(JSON.stringify({
        error: 'Evidence already linked to this analysis'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await context.env.DB.prepare(`
      INSERT INTO ach_evidence_links (
        id, ach_analysis_id, evidence_id, added_by, added_at
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      id,
      data.ach_analysis_id,
      data.evidence_id,
      userId,
      now
    ).run()

    return new Response(JSON.stringify({
      id,
      ach_analysis_id: data.ach_analysis_id,
      evidence_id: data.evidence_id,
      added_by: userId,
      added_at: now
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (error) {
    console.error('[ACH Evidence] Link error:', error)

    return new Response(JSON.stringify({
      error: 'Failed to link evidence'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}

// DELETE /api/ach/evidence?id=xxx - Unlink evidence from analysis
export const onRequestDelete: PagesFunction<Env> = async (context) => {

  try {
    const url = new URL(context.request.url)
    const id = url.searchParams.get('id')

    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // Get workspace_id from query params, header, or default to '1'
    const workspaceId = url.searchParams.get('workspace_id') || context.request.headers.get('X-Workspace-ID') || null

    if (!id) {
      return new Response(JSON.stringify({ error: 'Link ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // WORKSPACE ISOLATION: Verify ownership through analysis AND workspace
    const existing = await context.env.DB.prepare(`
      SELECT l.id
      FROM ach_evidence_links l
      JOIN ach_analyses a ON l.ach_analysis_id = a.id
      WHERE l.id = ? AND a.user_id = ? AND a.workspace_id = ?
    `).bind(id, userId, workspaceId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Evidence link not found in workspace' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Delete (CASCADE will handle scores)
    await context.env.DB.prepare(
      'DELETE FROM ach_evidence_links WHERE id = ?'
    ).bind(id).run()

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (error) {
    console.error('[ACH Evidence] Unlink error:', error)

    return new Response(JSON.stringify({
      error: 'Failed to unlink evidence'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}
