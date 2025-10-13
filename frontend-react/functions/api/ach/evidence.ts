/**
 * ACH Evidence Linking API
 * Link/unlink evidence from Evidence Library to ACH analyses
 */

import { getUserIdOrDefault } from '../_shared/auth-helpers'

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
  console.log('🔵 [ACH EVIDENCE POST] ========== REQUEST START ==========')
  console.log('🔵 [ACH EVIDENCE POST] URL:', context.request.url)
  console.log('🔵 [ACH EVIDENCE POST] Headers:', Object.fromEntries(context.request.headers))

  try {
    const url = new URL(context.request.url)
    const data = await context.request.json() as Partial<EvidenceLink>
    console.log('🔵 [ACH EVIDENCE POST] Request body:', JSON.stringify(data, null, 2))

    const userId = await getUserIdOrDefault(context.request, context.env)
    console.log('🔵 [ACH EVIDENCE POST] User ID:', userId)

    // Get workspace_id from query params or default to '1'
    const workspaceId = url.searchParams.get('workspace_id') || '1'
    console.log('🔵 [ACH EVIDENCE POST] Workspace ID:', workspaceId)

    if (!data.ach_analysis_id || !data.evidence_id) {
      console.log('🔴 [ACH EVIDENCE POST] Missing required fields - ach_analysis_id:', data.ach_analysis_id, 'evidence_id:', data.evidence_id)
      return new Response(JSON.stringify({
        error: 'ACH analysis ID and evidence ID are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // WORKSPACE ISOLATION: Verify ownership of analysis AND workspace
    console.log('🔵 [ACH EVIDENCE POST] Checking analysis ownership - analysis_id:', data.ach_analysis_id, 'user_id:', userId, 'workspace_id:', workspaceId)
    const analysis = await context.env.DB.prepare(
      'SELECT id FROM ach_analyses WHERE id = ? AND user_id = ? AND workspace_id = ?'
    ).bind(data.ach_analysis_id, userId, workspaceId).first()
    console.log('🔵 [ACH EVIDENCE POST] Analysis found:', analysis ? 'Yes' : 'No')

    if (!analysis) {
      console.log('🔴 [ACH EVIDENCE POST] Analysis not found or not authorized')
      return new Response(JSON.stringify({ error: 'Analysis not found in workspace' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify evidence exists
    console.log('🔵 [ACH EVIDENCE POST] Checking evidence exists - evidence_id:', data.evidence_id)
    const evidence = await context.env.DB.prepare(
      'SELECT id FROM evidence_items WHERE id = ?'
    ).bind(data.evidence_id).first()
    console.log('🔵 [ACH EVIDENCE POST] Evidence found:', evidence ? 'Yes' : 'No')

    if (!evidence) {
      console.log('🔴 [ACH EVIDENCE POST] Evidence not found')
      return new Response(JSON.stringify({ error: 'Evidence not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if already linked
    console.log('🔵 [ACH EVIDENCE POST] Checking if already linked')
    const existing = await context.env.DB.prepare(
      'SELECT id FROM ach_evidence_links WHERE ach_analysis_id = ? AND evidence_id = ?'
    ).bind(data.ach_analysis_id, data.evidence_id).first()
    console.log('🔵 [ACH EVIDENCE POST] Already linked:', existing ? 'Yes' : 'No')

    if (existing) {
      console.log('🔴 [ACH EVIDENCE POST] Evidence already linked')
      return new Response(JSON.stringify({
        error: 'Evidence already linked to this analysis'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    console.log('🔵 [ACH EVIDENCE POST] Creating link - id:', id)

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
    console.log('🔵 [ACH EVIDENCE POST] Link created successfully')

    return new Response(JSON.stringify({
      id,
      ach_analysis_id: data.ach_analysis_id,
      evidence_id: data.evidence_id,
      added_by: userId,
      added_at: now
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('🔴 [ACH EVIDENCE POST] ========== ERROR ==========')
    console.error('🔴 [ACH EVIDENCE POST] Error:', error)
    console.error('🔴 [ACH EVIDENCE POST] Error message:', error instanceof Error ? error.message : 'Unknown')
    console.error('🔴 [ACH EVIDENCE POST] Error stack:', error instanceof Error ? error.stack : 'N/A')
    console.error('🔴 [ACH EVIDENCE POST] ========== ERROR END ==========')

    return new Response(JSON.stringify({
      error: 'Failed to link evidence',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// DELETE /api/ach/evidence?id=xxx - Unlink evidence from analysis
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  console.log('🔵 [ACH EVIDENCE DELETE] ========== REQUEST START ==========')
  console.log('🔵 [ACH EVIDENCE DELETE] URL:', context.request.url)

  try {
    const url = new URL(context.request.url)
    const id = url.searchParams.get('id')
    console.log('🔵 [ACH EVIDENCE DELETE] Link ID:', id)

    const userId = await getUserIdOrDefault(context.request, context.env)
    console.log('🔵 [ACH EVIDENCE DELETE] User ID:', userId)

    // Get workspace_id from query params or default to '1'
    const workspaceId = url.searchParams.get('workspace_id') || '1'
    console.log('🔵 [ACH EVIDENCE DELETE] Workspace ID:', workspaceId)

    if (!id) {
      console.log('🔴 [ACH EVIDENCE DELETE] Missing link ID')
      return new Response(JSON.stringify({ error: 'Link ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // WORKSPACE ISOLATION: Verify ownership through analysis AND workspace
    console.log('🔵 [ACH EVIDENCE DELETE] Verifying link ownership')
    const existing = await context.env.DB.prepare(`
      SELECT l.id
      FROM ach_evidence_links l
      JOIN ach_analyses a ON l.ach_analysis_id = a.id
      WHERE l.id = ? AND a.user_id = ? AND a.workspace_id = ?
    `).bind(id, userId, workspaceId).first()
    console.log('🔵 [ACH EVIDENCE DELETE] Link found:', existing ? 'Yes' : 'No')

    if (!existing) {
      console.log('🔴 [ACH EVIDENCE DELETE] Link not found or not authorized')
      return new Response(JSON.stringify({ error: 'Evidence link not found in workspace' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Delete (CASCADE will handle scores)
    console.log('🔵 [ACH EVIDENCE DELETE] Deleting link')
    await context.env.DB.prepare(
      'DELETE FROM ach_evidence_links WHERE id = ?'
    ).bind(id).run()
    console.log('🔵 [ACH EVIDENCE DELETE] Link deleted successfully')

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('🔴 [ACH EVIDENCE DELETE] ========== ERROR ==========')
    console.error('🔴 [ACH EVIDENCE DELETE] Error:', error)
    console.error('🔴 [ACH EVIDENCE DELETE] Error message:', error instanceof Error ? error.message : 'Unknown')
    console.error('🔴 [ACH EVIDENCE DELETE] Error stack:', error instanceof Error ? error.stack : 'N/A')
    console.error('🔴 [ACH EVIDENCE DELETE] ========== ERROR END ==========')

    return new Response(JSON.stringify({
      error: 'Failed to unlink evidence',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
