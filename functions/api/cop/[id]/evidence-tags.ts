/**
 * COP Evidence Tags API - List, Create, Delete
 *
 * GET    /api/cop/:id/evidence-tags?evidence_id=xxx - List tags for an evidence item
 * POST   /api/cop/:id/evidence-tags                 - Create a tag
 * DELETE  /api/cop/:id/evidence-tags?tag_id=xxx      - Remove a tag
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { EVIDENCE_TAGGED } from '../../_shared/cop-event-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `etg-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const evidenceId = url.searchParams.get('evidence_id')

  try {
    if (!evidenceId) {
      return new Response(JSON.stringify({ error: 'evidence_id query parameter is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const tags = await env.DB.prepare(`
      SELECT * FROM cop_evidence_tags WHERE evidence_id = ? ORDER BY tag_category, tag_value
    `).bind(evidenceId).all()

    return new Response(JSON.stringify({ tags: tags.results }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Evidence Tags] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list evidence tags',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context

  try {
    const userId = await getUserIdOrDefault(request, env)
    const body = await request.json() as any

    if (!body.evidence_id?.trim()) {
      return new Response(JSON.stringify({ error: 'evidence_id is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    if (!body.tag_category?.trim()) {
      return new Response(JSON.stringify({ error: 'tag_category is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    if (!body.tag_value?.trim()) {
      return new Response(JSON.stringify({ error: 'tag_value is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const id = generateId()
    const now = new Date().toISOString()
    const confidence = Math.min(Math.max(body.confidence ?? 100, 0), 100)

    await env.DB.prepare(`
      INSERT INTO cop_evidence_tags (id, evidence_id, tag_category, tag_value, confidence, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, body.evidence_id.trim(), body.tag_category.trim(), body.tag_value.trim(), confidence, userId, now).run()

    const sessionId = params.id as string
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: EVIDENCE_TAGGED,
      entityType: 'evidence',
      entityId: body.evidence_id,
      payload: { tag_category: body.tag_category, tag_value: body.tag_value, confidence },
      createdBy: userId,
    })

    return new Response(JSON.stringify({ id, message: 'Evidence tag created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Evidence Tags] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create evidence tag',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)
  const tagId = url.searchParams.get('tag_id')

  try {
    if (!tagId) {
      return new Response(JSON.stringify({ error: 'tag_id query parameter is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Look up workspace from session for scoped delete
    const session = await env.DB.prepare(
      'SELECT workspace_id FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first() as any
    const workspaceId = session?.workspace_id || sessionId

    // Only delete if the tag belongs to evidence in this session's workspace
    await env.DB.prepare(`
      DELETE FROM cop_evidence_tags WHERE id = ? AND evidence_id IN (
        SELECT id FROM evidence_items WHERE workspace_id = ?
      )
    `).bind(tagId, workspaceId).run()

    return new Response(JSON.stringify({ message: 'Evidence tag deleted' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Evidence Tags] Delete error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete evidence tag',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
