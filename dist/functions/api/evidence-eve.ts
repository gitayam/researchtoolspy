/**
 * Evidence EVE Assessment API
 * Manages EVE (Evaluation of Evidence) deception assessment for evidence items
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

// Helper to get user from session
async function getUserFromRequest(request: Request, env: Env): Promise<number | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const sessionData = await env.SESSIONS.get(token)

  if (!sessionData) {
    return null
  }

  const session = JSON.parse(sessionData)
  return session.user_id
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const method = request.method

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse evidence ID from path: /api/evidence-eve/:evidenceId
    const pathMatch = url.pathname.match(/^\/api\/evidence-eve\/(\d+)$/)

    if (!pathMatch) {
      return new Response(
        JSON.stringify({ error: 'Evidence ID required in path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const evidenceId = parseInt(pathMatch[1])

    // GET /api/evidence-eve/:id - Get EVE assessment
    if (method === 'GET') {
      const evidence = await env.DB.prepare(`
        SELECT eve_assessment, workspace_id FROM evidence WHERE id = ?
      `).bind(evidenceId).first()

      if (!evidence) {
        return new Response(
          JSON.stringify({ error: 'Evidence not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check workspace access if evidence has workspace
      if (evidence.workspace_id) {
        const workspace = await env.DB.prepare(`
          SELECT owner_id, is_public FROM workspaces WHERE id = ?
        `).bind(evidence.workspace_id).first()

        if (workspace) {
          const isOwner = workspace.owner_id === userId
          const isMember = await env.DB.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
          `).bind(evidence.workspace_id, userId).first()

          if (!isOwner && !isMember && !workspace.is_public) {
            return new Response(
              JSON.stringify({ error: 'Access denied' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      }

      const eveAssessment = evidence.eve_assessment
        ? JSON.parse(evidence.eve_assessment as string)
        : null

      return new Response(
        JSON.stringify(eveAssessment),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /api/evidence-eve/:id - Update EVE assessment
    if (method === 'PUT') {
      const body = await request.json() as any

      const evidence = await env.DB.prepare(`
        SELECT workspace_id FROM evidence WHERE id = ?
      `).bind(evidenceId).first()

      if (!evidence) {
        return new Response(
          JSON.stringify({ error: 'Evidence not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check edit access if evidence has workspace
      if (evidence.workspace_id) {
        const workspace = await env.DB.prepare(`
          SELECT owner_id FROM workspaces WHERE id = ?
        `).bind(evidence.workspace_id).first()

        if (workspace) {
          const isOwner = workspace.owner_id === userId
          const member = await env.DB.prepare(`
            SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
          `).bind(evidence.workspace_id, userId).first()

          const canEdit = isOwner || (member && (member.role === 'EDITOR' || member.role === 'ADMIN'))

          if (!canEdit) {
            return new Response(
              JSON.stringify({ error: 'Insufficient permissions' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      }

      // Validate EVE assessment fields
      if (body.internal_consistency === undefined ||
          body.external_corroboration === undefined ||
          body.anomaly_detection === undefined) {
        return new Response(
          JSON.stringify({
            error: 'Missing required fields: internal_consistency, external_corroboration, anomaly_detection'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const eveAssessment = {
        internal_consistency: body.internal_consistency, // 0-5 (INVERTED)
        external_corroboration: body.external_corroboration, // 0-5 (INVERTED)
        anomaly_detection: body.anomaly_detection, // 0-5
        notes: body.notes || '',
        assessed_at: new Date().toISOString()
      }

      const now = new Date().toISOString()
      await env.DB.prepare(`
        UPDATE evidence
        SET eve_assessment = ?, updated_at = ?
        WHERE id = ?
      `).bind(JSON.stringify(eveAssessment), now, evidenceId).run()

      return new Response(
        JSON.stringify(eveAssessment),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /api/evidence-eve/:id - Remove EVE assessment
    if (method === 'DELETE') {
      const evidence = await env.DB.prepare(`
        SELECT workspace_id FROM evidence WHERE id = ?
      `).bind(evidenceId).first()

      if (!evidence) {
        return new Response(
          JSON.stringify({ error: 'Evidence not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check edit access
      if (evidence.workspace_id) {
        const workspace = await env.DB.prepare(`
          SELECT owner_id FROM workspaces WHERE id = ?
        `).bind(evidence.workspace_id).first()

        if (workspace) {
          const isOwner = workspace.owner_id === userId
          const member = await env.DB.prepare(`
            SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
          `).bind(evidence.workspace_id, userId).first()

          const canEdit = isOwner || (member && (member.role === 'EDITOR' || member.role === 'ADMIN'))

          if (!canEdit) {
            return new Response(
              JSON.stringify({ error: 'Insufficient permissions' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      }

      const now = new Date().toISOString()
      await env.DB.prepare(`
        UPDATE evidence
        SET eve_assessment = NULL, updated_at = ?
        WHERE id = ?
      `).bind(now, evidenceId).run()

      return new Response(
        JSON.stringify({ message: 'EVE assessment removed successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Evidence EVE API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
