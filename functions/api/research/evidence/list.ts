/**
 * List Evidence API
 * GET /api/research/evidence/list?researchQuestionId=xxx
 *
 * List all evidence for a research question or investigation
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'
import {
  itemRowToResearchEvidence,
  verificationStatusToItemStatus,
} from '../_lib/research-evidence-mapping'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const userId = await getUserFromRequest(context.request, context.env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    const url = new URL(context.request.url)
    const researchQuestionId = url.searchParams.get('researchQuestionId')
    const investigationPacketId = url.searchParams.get('investigationPacketId')
    const evidenceType = url.searchParams.get('type')
    const verificationStatus = url.searchParams.get('status')

    if (!researchQuestionId && !investigationPacketId) {
      return new Response(JSON.stringify({
        error: 'Must provide researchQuestionId or investigationPacketId'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Read from the canonical `evidence_items` store (D-E8-3). The research links
    // (research_question_id / investigation_packet_id) are now real columns
    // (migration 110); the incoming verification-status filter is mapped through
    // the same status vocabulary the write path uses, and the per-row response is
    // rehydrated from the lossless `metadata` blob to preserve the frontend contract.
    let query = `
      SELECT * FROM evidence_items
      WHERE 1=1
    `
    const params: any[] = []

    if (researchQuestionId) {
      query += ` AND research_question_id = ?`
      params.push(researchQuestionId)
    }

    if (investigationPacketId) {
      query += ` AND investigation_packet_id = ?`
      params.push(investigationPacketId)
    }

    if (evidenceType) {
      query += ` AND evidence_type = ?`
      params.push(evidenceType)
    }

    if (verificationStatus) {
      query += ` AND status = ?`
      params.push(verificationStatusToItemStatus(verificationStatus))
    }

    query += ` ORDER BY created_at DESC LIMIT 500`

    const stmt = context.env.DB.prepare(query).bind(...params)
    const result = await stmt.all()

    const safeJSON = (val: any, fallback: any = []) => {
      if (!val) return fallback
      try { return JSON.parse(val) } catch { return fallback }
    }

    const evidence = (result.results || []).map((row: Record<string, unknown>) =>
      itemRowToResearchEvidence(row, safeJSON)
    )

    return new Response(JSON.stringify({
      success: true,
      evidence,
      count: evidence.length
    }), {
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[list-evidence] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list evidence'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
