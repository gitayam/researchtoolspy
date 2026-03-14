/**
 * COP Batch Evidence API - Create multiple evidence items in one request
 *
 * POST /api/cop/:id/evidence/batch - Insert up to 100 evidence items via D1 batch
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../../../_shared/auth-helpers'

interface Env {
  DB: D1Database
}

const MAX_BATCH_SIZE = 100

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

interface EvidenceInput {
  title: string
  url?: string
  description?: string
  evidence_type?: string
  source_type?: string
}

async function getSessionWorkspaceId(db: D1Database, sessionId: string): Promise<string | null> {
  const row = await db.prepare(
    `SELECT workspace_id FROM cop_sessions WHERE id = ?`
  ).bind(sessionId).first<{ workspace_id: string }>()
  return row?.workspace_id ?? null
}

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
    const workspaceId = await getSessionWorkspaceId(env.DB, sessionId)
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const body = await request.json() as any

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return new Response(JSON.stringify({ error: 'items array is required and must not be empty' }), {
        status: 400, headers: corsHeaders,
      })
    }

    if (body.items.length > MAX_BATCH_SIZE) {
      return new Response(JSON.stringify({
        error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} items`,
      }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Validate all items have a title before inserting any
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i] as EvidenceInput
      if (!item.title?.trim()) {
        return new Response(JSON.stringify({
          error: `Item at index ${i} is missing a required title`,
        }), {
          status: 400, headers: corsHeaders,
        })
      }
    }

    const now = new Date().toISOString()

    // Build prepared statements for D1 batch insert
    const statements = body.items.map((item: EvidenceInput) => {
      return env.DB.prepare(`
        INSERT INTO evidence_items (
          title, description, source_url, evidence_type, confidence_level,
          credibility, reliability,
          status, workspace_id, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
      `).bind(
        item.title.trim(),
        (item.description ?? '').trim(),
        item.url ?? null,
        item.source_type ?? 'observation',
        'medium',
        'unverified',
        'unknown',
        workspaceId,
        userId,
        now,
        now
      )
    })

    const results = await env.DB.batch(statements)

    // Build response items with auto-incremented IDs from each insert result
    const items = body.items.map((item: EvidenceInput, i: number) => ({
      id: (results[i] as any).meta?.last_row_id ?? 0,
      title: item.title.trim(),
      url: item.url ?? null,
      description: (item.description ?? '').trim(),
      evidence_type: item.source_type ?? 'observation',
      credibility: 'unverified',
      reliability: 'unknown',
      workspace_id: workspaceId,
      created_by: userId,
      created_at: now,
    }))

    return new Response(JSON.stringify({
      created: items.length,
      items,
    }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Evidence Batch API] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create evidence batch',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
