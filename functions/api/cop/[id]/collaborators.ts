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
import { getUserFromRequest } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { COLLABORATOR_ADDED, COLLABORATOR_REMOVED } from '../../_shared/cop-event-types'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
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
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[COP Collaborators] GET error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list collaborators',
    }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}

// POST - Invite a collaborator
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json() as {
      email?: string
      user_id?: number
      role?: 'viewer' | 'editor'
    }

    const id = crypto.randomUUID()
    const inviteToken = crypto.randomUUID()
    const invitedBy = userId
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

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: COLLABORATOR_ADDED,
      entityType: 'collaborator',
      entityId: id,
      payload: { email: body.email ?? null, role },
      createdBy: invitedBy,
    })

    return new Response(JSON.stringify({
      collaborator,
      invite_link: `/dashboard/cop/${sessionId}?invite=${inviteToken}`,
    }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[COP Collaborators] POST error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to invite collaborator',
    }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}

// PUT - Update collaborator skills/availability
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json() as {
      collaborator_id: string
      skills?: string
      max_concurrent?: number
      timezone?: string | null
      availability?: string
    }

    if (!body.collaborator_id) {
      return new Response(JSON.stringify({ error: 'collaborator_id is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    const updates: string[] = []
    const bindings: any[] = []

    if (body.skills !== undefined) {
      updates.push('skills = ?')
      bindings.push(body.skills)
    }
    if (body.max_concurrent !== undefined) {
      updates.push('max_concurrent = ?')
      bindings.push(body.max_concurrent)
    }
    if (body.timezone !== undefined) {
      updates.push('timezone = ?')
      bindings.push(body.timezone)
    }
    if (body.availability !== undefined) {
      updates.push('availability = ?')
      bindings.push(body.availability)
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    bindings.push(body.collaborator_id, sessionId)

    await env.DB.prepare(
      `UPDATE cop_collaborators SET ${updates.join(', ')} WHERE id = ? AND cop_session_id = ?`
    ).bind(...bindings).run()

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('[COP Collaborators] PUT error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update collaborator',
    }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}

// DELETE - Remove a collaborator
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json() as { collaborator_id: string }

    if (!body.collaborator_id) {
      return new Response(JSON.stringify({ error: 'collaborator_id is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    await env.DB.prepare(
      `DELETE FROM cop_collaborators WHERE id = ? AND cop_session_id = ?`
    ).bind(body.collaborator_id, sessionId).run()

    const removedBy = userId
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: COLLABORATOR_REMOVED,
      entityType: 'collaborator',
      entityId: body.collaborator_id,
      payload: {},
      createdBy: removedBy,
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[COP Collaborators] DELETE error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to remove collaborator',
    }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}
