/**
 * Add Evidence API
 * POST /api/research/evidence/add
 *
 * Add evidence item to a research question or investigation
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'
import { buildEvidenceItemsInsert } from '../_lib/research-evidence-mapping'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface AddEvidenceRequest {
  researchQuestionId?: string
  investigationPacketId?: string
  workspaceId?: string

  evidenceType: 'source' | 'document' | 'interview' | 'observation' | 'data' | 'media'
  title: string
  content?: string

  metadata?: Record<string, any>

  credibilityScore?: number
  verificationStatus?: 'verified' | 'probable' | 'unverified' | 'disproven'

  chainOfCustody?: Array<{
    actor: string
    action: string
    timestamp: string
    notes?: string
  }>

  tags?: string[]
  category?: string

  linkedEvidence?: string[]
  entities?: Array<{
    type: string
    name: string
    id?: string
  }>

  evidenceDate?: string
  collectedBy?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const body = await context.request.json() as AddEvidenceRequest

    // Validate required fields
    if (!body.title || !body.evidenceType) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: title, evidenceType'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    if (!body.researchQuestionId && !body.investigationPacketId) {
      return new Response(JSON.stringify({
        error: 'Must link to either researchQuestionId or investigationPacketId'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    const now = new Date().toISOString()
    const workspaceId = body.workspaceId || context.request.headers.get('X-Workspace-ID') || null

    // Write to the canonical `evidence_items` store (D-E8-3). First-class fields
    // map to real columns; research-specific originals are stashed in `metadata`
    // so the list-evidence read path is a lossless round-trip. The INTEGER PK is
    // captured via meta.last_row_id and returned stringified (research_evidence
    // used a TEXT uuid; callers treat the id as an opaque string).
    const insert = buildEvidenceItemsInsert(
      {
        researchQuestionId: body.researchQuestionId || null,
        investigationPacketId: body.investigationPacketId || null,
        workspaceId,
        evidenceType: body.evidenceType,
        title: body.title,
        content: body.content || null,
        metadata: body.metadata ?? null,
        credibilityScore: typeof body.credibilityScore === 'number' ? body.credibilityScore : null,
        verificationStatus: body.verificationStatus || 'unverified',
        chainOfCustody: body.chainOfCustody ?? null,
        tags: body.tags ?? null,
        category: body.category || null,
        linkedEvidence: body.linkedEvidence ?? null,
        entities: body.entities ?? null,
        evidenceDate: body.evidenceDate || null,
        collectedAt: now,
        collectedBy: body.collectedBy || null,
      },
      { userId }
    )

    const placeholders = insert.columns.map(() => '?').join(', ')
    const result = await context.env.DB.prepare(`
      INSERT INTO evidence_items (${insert.columns.join(', ')})
      VALUES (${placeholders})
    `).bind(...insert.values).run()

    const evidenceId = String(result.meta.last_row_id)

    // Log activity
    const activityId = crypto.randomUUID()
    await context.env.DB.prepare(`
      INSERT INTO research_activity (
        id, research_question_id, investigation_packet_id, workspace_id,
        activity_type, actor, target_type, target_id, content, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      activityId,
      body.researchQuestionId || null,
      body.investigationPacketId || null,
      workspaceId,
      'evidence_added',
      body.collectedBy || 'system',
      'evidence',
      evidenceId,
      `Added evidence: ${body.title}`,
      now
    ).run()


    return new Response(JSON.stringify({
      success: true,
      evidenceId,
      evidence: {
        id: evidenceId,
        ...body,
        collectedAt: now
      }
    }), {
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[add-evidence] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to add evidence'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
