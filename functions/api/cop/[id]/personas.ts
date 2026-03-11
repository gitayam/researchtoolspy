/**
 * COP Personas API - List, Create, Update, and Link
 *
 * GET  /api/cop/:id/personas       - List all personas for session (with links)
 * POST /api/cop/:id/personas       - Create or update a persona
 * POST /api/cop/:id/personas/link  - Create a persona link (handled via ?action=link query param)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { PERSONA_CREATED, PERSONA_LINKED } from '../../_shared/cop-event-types'

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
  return `per-${crypto.randomUUID().slice(0, 12)}`
}

function generateLinkId(): string {
  return `pln-${crypto.randomUUID().slice(0, 12)}`
}

const VALID_PLATFORMS = ['twitter', 'telegram', 'reddit', 'onlyfans', 'instagram', 'tiktok', 'other']
const VALID_STATUSES = ['active', 'suspended', 'deleted', 'unknown']
const VALID_LINK_TYPES = ['alias', 'operator', 'affiliated', 'unknown']

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const personas = await env.DB.prepare(`
      SELECT * FROM cop_personas WHERE cop_session_id = ? ORDER BY created_at DESC
    `).bind(sessionId).all()

    // Fetch all links involving these personas
    const personaIds = personas.results.map((p: any) => p.id)
    let links: any[] = []
    if (personaIds.length > 0) {
      const placeholders = personaIds.map(() => '?').join(',')
      const linkResults = await env.DB.prepare(`
        SELECT * FROM cop_persona_links
        WHERE persona_a_id IN (${placeholders}) OR persona_b_id IN (${placeholders})
        ORDER BY created_at DESC
      `).bind(...personaIds, ...personaIds).all()
      links = linkResults.results
    }

    // Group links by persona id
    const linksByPersona: Record<string, any[]> = {}
    for (const link of links) {
      const aId = (link as any).persona_a_id
      const bId = (link as any).persona_b_id
      if (!linksByPersona[aId]) linksByPersona[aId] = []
      if (!linksByPersona[bId]) linksByPersona[bId] = []
      linksByPersona[aId].push(link)
      if (aId !== bId) linksByPersona[bId].push(link)
    }

    const enriched = personas.results.map((p: any) => ({
      ...p,
      links: linksByPersona[p.id] || [],
    }))

    return new Response(JSON.stringify({ personas: enriched }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Personas] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list personas',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)
  const action = url.searchParams.get('action')

  try {
    const userId = await getUserIdOrDefault(request, env)
    const workspaceId = request.headers.get('X-Workspace-ID') || '1'
    const body = await request.json() as any

    // Handle persona link creation
    if (action === 'link') {
      if (!body.persona_a_id || !body.persona_b_id) {
        return new Response(JSON.stringify({ error: 'persona_a_id and persona_b_id are required' }), {
          status: 400, headers: corsHeaders,
        })
      }

      const linkType = VALID_LINK_TYPES.includes(body.link_type) ? body.link_type : 'alias'
      const confidence = Math.min(Math.max(body.confidence ?? 50, 0), 100)
      const id = generateLinkId()
      const now = new Date().toISOString()

      await env.DB.prepare(`
        INSERT INTO cop_persona_links (id, persona_a_id, persona_b_id, link_type, confidence, evidence_id, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, body.persona_a_id, body.persona_b_id, linkType, confidence, body.evidence_id ?? null, userId, now).run()

      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: PERSONA_LINKED,
        entityType: 'persona',
        entityId: body.persona_a_id,
        payload: { link_id: id, persona_b_id: body.persona_b_id, link_type: linkType, confidence },
        createdBy: userId,
      })

      return new Response(JSON.stringify({ id, message: 'Persona link created' }), {
        status: 201, headers: corsHeaders,
      })
    }

    // Handle persona update
    if (body.id) {
      const updates: string[] = []
      const bindings: any[] = []

      if (body.display_name !== undefined) { updates.push('display_name = ?'); bindings.push(body.display_name.trim()) }
      if (body.platform !== undefined && VALID_PLATFORMS.includes(body.platform)) { updates.push('platform = ?'); bindings.push(body.platform) }
      if (body.handle !== undefined) { updates.push('handle = ?'); bindings.push(body.handle) }
      if (body.profile_url !== undefined) { updates.push('profile_url = ?'); bindings.push(body.profile_url) }
      if (body.status !== undefined && VALID_STATUSES.includes(body.status)) { updates.push('status = ?'); bindings.push(body.status) }
      if (body.linked_actor_id !== undefined) { updates.push('linked_actor_id = ?'); bindings.push(body.linked_actor_id) }
      if (body.notes !== undefined) { updates.push('notes = ?'); bindings.push(body.notes) }

      if (updates.length === 0) {
        return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
          status: 400, headers: corsHeaders,
        })
      }

      updates.push('updated_at = ?')
      bindings.push(new Date().toISOString())
      bindings.push(body.id)
      bindings.push(sessionId)

      await env.DB.prepare(`
        UPDATE cop_personas SET ${updates.join(', ')} WHERE id = ? AND cop_session_id = ?
      `).bind(...bindings).run()

      return new Response(JSON.stringify({ id: body.id, message: 'Persona updated' }), { headers: corsHeaders })
    }

    // Handle persona creation
    if (!body.display_name?.trim()) {
      return new Response(JSON.stringify({ error: 'display_name is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    if (!body.platform || !VALID_PLATFORMS.includes(body.platform)) {
      return new Response(JSON.stringify({ error: `platform must be one of: ${VALID_PLATFORMS.join(', ')}` }), {
        status: 400, headers: corsHeaders,
      })
    }

    const id = generateId()
    const now = new Date().toISOString()
    const status = VALID_STATUSES.includes(body.status) ? body.status : 'active'

    await env.DB.prepare(`
      INSERT INTO cop_personas (id, cop_session_id, display_name, platform, handle, profile_url, status, linked_actor_id, notes, created_by, workspace_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, sessionId, body.display_name.trim(), body.platform,
      body.handle ?? null, body.profile_url ?? null, status,
      body.linked_actor_id ?? null, body.notes ?? null,
      userId, workspaceId, now, now,
    ).run()

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: PERSONA_CREATED,
      entityType: 'persona',
      entityId: id,
      payload: { display_name: body.display_name, platform: body.platform },
      createdBy: userId,
    })

    return new Response(JSON.stringify({ id, message: 'Persona created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Personas] Create/Update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create/update persona',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
