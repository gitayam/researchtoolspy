/**
 * COP Collaborators API
 *
 * GET    /api/cop/:id/collaborators - List collaborators for a COP session
 * POST   /api/cop/:id/collaborators - Invite a collaborator
 * DELETE /api/cop/:id/collaborators - Remove a collaborator
 *
 * Manages collaborator invitations and access for COP workspace sessions.
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function getUserId(request: Request): number {
  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) {
    try { return JSON.parse(atob(auth.split('.')[1])).sub ?? 1 } catch { return 1 }
  }
  return parseInt(request.headers.get('X-User-Hash') ?? '1', 10) || 1
}

// GET - List collaborators for a COP session
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM cop_collaborators WHERE cop_session_id = ? ORDER BY invited_at DESC`
    ).bind(sessionId).all()

    return new Response(JSON.stringify({ collaborators: results ?? [] }), {
      headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Collaborators] GET error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list collaborators',
    }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// POST - Invite a collaborator
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const body = await request.json() as {
      email?: string
      user_id?: number
      role?: 'viewer' | 'editor'
    }

    const id = crypto.randomUUID()
    const inviteToken = crypto.randomUUID()
    const invitedBy = getUserId(request)
    const role = body.role ?? 'viewer'

    await env.DB.prepare(
      `INSERT INTO cop_collaborators (id, cop_session_id, user_id, email, role, invite_token, invited_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      sessionId,
      body.user_id ?? null,
      body.email ?? null,
      role,
      inviteToken,
      invitedBy,
    ).run()

    const collaborator = {
      id,
      cop_session_id: sessionId,
      user_id: body.user_id ?? null,
      email: body.email ?? null,
      role,
      invite_token: inviteToken,
      invited_by: invitedBy,
      invited_at: new Date().toISOString(),
      accepted_at: null,
    }

    return new Response(JSON.stringify({
      collaborator,
      invite_link: `/dashboard/cop/${sessionId}?invite=${inviteToken}`,
    }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Collaborators] POST error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to invite collaborator',
    }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// DELETE - Remove a collaborator
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const body = await request.json() as { collaborator_id: string }

    if (!body.collaborator_id) {
      return new Response(JSON.stringify({ error: 'collaborator_id is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    await env.DB.prepare(
      `DELETE FROM cop_collaborators WHERE id = ? AND cop_session_id = ?`
    ).bind(body.collaborator_id, sessionId).run()

    return new Response(JSON.stringify({ success: true }), {
      headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Collaborators] DELETE error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to remove collaborator',
    }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
