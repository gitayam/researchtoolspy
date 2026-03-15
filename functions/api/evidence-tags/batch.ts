/**
 * Bulk Evidence Tags API
 *
 * POST /api/evidence-tags/batch
 * Body: { evidence_ids: string[] }   (max 100)
 * Response: { tags: Record<string, Array<{ id, evidence_id, tag_category, tag_value, confidence, created_by, created_at }>> }
 *
 * Eliminates the N+1 problem of fetching tags one evidence item at a time.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

const MAX_IDS = 100

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    const body = await request.json() as { evidence_ids?: string[] }
    const evidenceIds = body.evidence_ids

    if (!Array.isArray(evidenceIds)) {
      return new Response(JSON.stringify({ error: 'evidence_ids must be an array' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    if (evidenceIds.length === 0) {
      return new Response(JSON.stringify({ tags: {} }), { headers: JSON_HEADERS })
    }

    if (evidenceIds.length > MAX_IDS) {
      return new Response(JSON.stringify({
        error: `evidence_ids exceeds maximum of ${MAX_IDS}`,
      }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Validate that all IDs are non-empty strings
    const cleanIds = evidenceIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
    if (cleanIds.length === 0) {
      return new Response(JSON.stringify({ tags: {} }), { headers: JSON_HEADERS })
    }

    // Build parameterized IN clause
    const placeholders = cleanIds.map(() => '?').join(',')
    const query = `SELECT * FROM cop_evidence_tags WHERE evidence_id IN (${placeholders}) ORDER BY tag_category, tag_value`

    const result = await env.DB.prepare(query).bind(...cleanIds).all()
    const rows = result.results ?? []

    // Group by evidence_id
    const tags: Record<string, any[]> = {}
    for (const id of cleanIds) {
      tags[id] = []
    }
    for (const row of rows) {
      const eid = row.evidence_id as string
      if (!tags[eid]) tags[eid] = []
      tags[eid].push(row)
    }

    return new Response(JSON.stringify({ tags }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Evidence Tags Batch] error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch evidence tags in batch',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}

export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
