/**
 * Add Evidence API
 * POST /api/research/evidence/add
 *
 * Add evidence item to a research question or investigation
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'

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
        status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const body = await context.request.json() as AddEvidenceRequest

    // Validate required fields
    if (!body.title || !body.evidenceType) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: title, evidenceType'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    if (!body.researchQuestionId && !body.investigationPacketId) {
      return new Response(JSON.stringify({
        error: 'Must link to either researchQuestionId or investigationPacketId'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const evidenceId = crypto.randomUUID()
    const now = new Date().toISOString()
    const workspaceId = body.workspaceId || context.request.headers.get('X-Workspace-ID') || '1'

    await context.env.DB.prepare(`
      INSERT INTO research_evidence (
        id, research_question_id, investigation_packet_id, workspace_id,
        evidence_type, title, content, metadata,
        credibility_score, verification_status, chain_of_custody,
        tags, category, linked_evidence, entities,
        evidence_date, collected_at, collected_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      evidenceId,
      body.researchQuestionId || null,
      body.investigationPacketId || null,
      workspaceId,
      body.evidenceType,
      body.title,
      body.content || null,
      body.metadata ? JSON.stringify(body.metadata) : null,
      body.credibilityScore || null,
      body.verificationStatus || 'unverified',
      body.chainOfCustody ? JSON.stringify(body.chainOfCustody) : null,
      body.tags ? JSON.stringify(body.tags) : null,
      body.category || null,
      body.linkedEvidence ? JSON.stringify(body.linkedEvidence) : null,
      body.entities ? JSON.stringify(body.entities) : null,
      body.evidenceDate || null,
      now,
      body.collectedBy || null
    ).run()

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
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (error) {
    console.error('[add-evidence] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to add evidence'

    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
