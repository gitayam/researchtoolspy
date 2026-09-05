import type { PagesFunction } from '@cloudflare/workers-types'

import { requireAuth } from '../_shared/auth-helpers'
import { buildAnswerPacketGraph, parseCreateAnswerPacketInput, AnswerPacketInputError, type PromotableContentAnalysisRow } from '../_shared/answer-packet-builder'
import { persistAnswerPacketGraph } from '../_shared/answer-packet-repository'
import { JSON_HEADERS, optionsResponse, safeJsonParse } from '../_shared/api-utils'
import { checkWorkspaceAccess } from '../_shared/workspace-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface InvestigationRow {
  id: string
  workspace_id: string
  research_question_id: string | null
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

export const onRequestPost: PagesFunction<Env> = async context => {
  try {
    const userId = await requireAuth(context.request, context.env)
    const request = parseCreateAnswerPacketInput(await context.request.json())
    const analysis = await context.env.DB.prepare(`
      SELECT id, user_id, workspace_id, url, content_hash, title, author,
        publish_date, is_social_media, extracted_text, created_at
      FROM content_analysis
      WHERE id = ? AND user_id = ?
    `).bind(request.analysis_id, userId).first<PromotableContentAnalysisRow>()
    if (!analysis) return json({ error: 'Content analysis not found' }, 404)
    if (!analysis.workspace_id) {
      return json({ error: 'Analysis has no writable workspace context', code: 'analysis_workspace_missing' }, 409)
    }

    const investigation = await context.env.DB.prepare(`
      SELECT id, workspace_id, research_question_id
      FROM investigations WHERE id = ?
    `).bind(request.investigation_id).first<InvestigationRow>()
    if (!investigation || investigation.workspace_id !== analysis.workspace_id) {
      return json({ error: 'Investigation not found in the analysis workspace' }, 404)
    }
    if (!await checkWorkspaceAccess(investigation.workspace_id, userId, context.env, 'EDITOR')) {
      return json({ error: 'Editor access to the investigation workspace is required' }, 403)
    }

    const graph = await buildAnswerPacketGraph({
      packetId: crypto.randomUUID(),
      userId,
      analysis,
      request,
      investigationQuestionId: investigation.research_question_id,
    })
    await persistAnswerPacketGraph(context.env.DB, userId, {
      ...graph,
      legacyAttachment: { contentAnalysisId: analysis.id, userId },
    })

    return json({ success: true, ...graph }, 201)
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof AnswerPacketInputError) {
      const status = error.code === 'excerpt_not_found'
        ? 422
        : error.code.startsWith('analysis_') ? 409 : 400
      return json({ error: error.message, code: error.code }, status)
    }
    if (error instanceof SyntaxError) return json({ error: 'Request body must be valid JSON' }, 400)
    console.error('[Answer Packets] Create failed:', error)
    return json({ error: 'Failed to create Answer Packet' }, 500)
  }
}

export const onRequestGet: PagesFunction<Env> = async context => {
  try {
    const userId = await requireAuth(context.request, context.env)
    const url = new URL(context.request.url)
    const investigationId = url.searchParams.get('investigation_id')?.trim()
    if (!investigationId) return json({ error: 'investigation_id query parameter is required' }, 400)

    const investigation = await context.env.DB.prepare(`
      SELECT id, workspace_id FROM investigations WHERE id = ?
    `).bind(investigationId).first<{ id: string; workspace_id: string }>()
    if (!investigation) return json({ error: 'Investigation not found' }, 404)
    if (!await checkWorkspaceAccess(investigation.workspace_id, userId, context.env, 'VIEWER')) {
      return json({ error: 'Access denied to investigation workspace' }, 403)
    }

    const result = await context.env.DB.prepare(`
      SELECT ap.id, ap.schema_version, ap.workspace_id, ap.investigation_id,
        ap.primary_artifact_id, ap.question_id, ap.question, ap.answer,
        ap.limitations_json, ap.collection_gaps_json, ap.generated_at,
        ap.created_by, ap.expires_at, ap.created_at, ap.updated_at,
        COUNT(apc.id) AS claim_count
      FROM answer_packets ap
      LEFT JOIN answer_packet_claims apc ON apc.packet_id = ap.id
      WHERE ap.workspace_id = ? AND ap.investigation_id = ?
      GROUP BY ap.id
      ORDER BY ap.generated_at DESC
      LIMIT 100
    `).bind(investigation.workspace_id, investigation.id).all()
    const packets = (result.results || []).map(row => ({
      ...row,
      limitations: safeJsonParse(row.limitations_json, []),
      collection_gaps: safeJsonParse(row.collection_gaps_json, []),
      limitations_json: undefined,
      collection_gaps_json: undefined,
    }))
    return json({ packets })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[Answer Packets] List failed:', error)
    return json({ error: 'Failed to list Answer Packets' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
