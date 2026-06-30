/**
 * Process Submission to Evidence API
 * POST /api/research/submissions/process
 *
 * Convert a reviewed form submission into a research evidence entry.
 *
 * System A (E-4b-2): submissions now live in `survey_responses` (the modern
 * builder + public submit page write here). The legacy `form_submissions` table
 * (System B) holds only abandoned test data, so this handler reads
 * `survey_responses` JOINed to `survey_drops`, scoped to the owner
 * (`d.created_by = userId`) exactly like the reviewer list (E-4b-1). The field
 * mapping reuses the shared `buildEvidenceFromResponse` adapter so the promote
 * extraction stays unit-testable and the submitter's IP hash can never leak into
 * evidence (E-1 privacy).
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'
import { buildEvidenceFromResponse, extractEnrichedCitation } from '../_lib/systema-adapter'
import { buildEvidenceItemsInsert } from '../_lib/research-evidence-mapping'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface ProcessSubmissionRequest {
  submissionId: string
  verificationStatus?: 'verified' | 'probable' | 'unverified' | 'disproven'
  credibilityScore?: number
  evidenceType?: string
  notes?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const body = await context.request.json() as ProcessSubmissionRequest
    const workspaceId = context.request.headers.get('X-Workspace-ID') || null

    if (!body.submissionId) {
      return new Response(JSON.stringify({
        error: 'Missing required field: submissionId'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }


    // Get the System-A submission scoped to the owner's surveys (mirrors the
    // reviewer list scoping in E-4b-1). The submitter's IP hash is deliberately
    // NOT selected (E-1 privacy) and never reaches the evidence row.
    const submission = await context.env.DB.prepare(`
      SELECT
        s.id, s.survey_id, s.form_data,
        s.submitter_name, s.submitter_contact,
        s.status, s.linked_evidence_id,
        s.created_at,
        d.title AS form_name,
        d.workspace_id AS survey_workspace_id
      FROM survey_responses s
      JOIN survey_drops d ON s.survey_id = d.id
      WHERE s.id = ? AND d.created_by = ?
    `).bind(body.submissionId, userId).first()

    if (!submission) {
      return new Response(JSON.stringify({
        error: 'Submission not found'
      }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    // Already-processed guard: an accepted response (or one already linked to
    // evidence) returns the existing evidence id instead of creating a duplicate.
    if (submission.linked_evidence_id || submission.status === 'accepted') {
      return new Response(JSON.stringify({
        success: true,
        alreadyProcessed: true,
        evidenceId: submission.linked_evidence_id || null
      }), {
        headers: JSON_HEADERS
      })
    }

    // Derive title / source_url / description / content_type from the submitted
    // answers via the shared adapter (kept pure + unit-tested).
    const fields = buildEvidenceFromResponse(submission.form_data)
    const enrichedCitation = extractEnrichedCitation(submission.form_data)

    // Determine evidence type from the form-supplied content type (or default).
    let evidenceType = body.evidenceType || fields.content_type || 'source'

    // Map content types to evidence types
    const contentTypeMap: Record<string, string> = {
      'article': 'source',
      'video': 'media',
      'social_post': 'source',
      'document': 'document',
      'image': 'media',
      'podcast': 'media',
      'dataset': 'data',
      'source': 'source',
      'other': 'source'
    }

    if (contentTypeMap[evidenceType]) {
      evidenceType = contentTypeMap[evidenceType]
    }

    // Create evidence entry
    const now = new Date().toISOString()
    const title = fields.title

    // Build content description (submission narrative + reviewer notes)
    const contentParts: string[] = []
    if (fields.description) {
      contentParts.push(fields.description)
    }
    if (body.notes) {
      contentParts.push(`\n\nReviewer notes: ${body.notes}`)
    }
    const content = contentParts.join('\n')

    // Prefer the explicit workspace header; fall back to the survey's workspace.
    const evidenceWorkspaceId = workspaceId || (submission.survey_workspace_id as string | null)

    // Create chain of custody
    const chainOfCustody = [
      {
        actor: submission.submitter_name || 'anonymous',
        action: 'submitted',
        timestamp: submission.created_at,
        notes: `Submitted via form: ${submission.form_name}`
      },
      {
        actor: 'system',
        action: 'processed',
        timestamp: now,
        notes: body.notes || 'Processed into evidence collection'
      }
    ]

    // Write to the canonical `evidence_items` store (D-E8-3). The submission's
    // `source_url` has no first-class column here, so it rides along in the
    // metadata blob (lossless). The new INTEGER PK becomes the stringified
    // evidence id stored back on the submission as `linked_evidence_id`.
    const insert = buildEvidenceItemsInsert(
      {
        researchQuestionId: null, // no question link in System A submissions
        investigationPacketId: null,
        workspaceId: evidenceWorkspaceId, // header, else survey workspace
        evidenceType,
        title,
        content: content || null,
        metadata: {
          source_url: fields.source_url || null,
          ...(enrichedCitation !== null ? { citation: enrichedCitation } : {}),
        },
        credibilityScore: typeof body.credibilityScore === 'number' ? body.credibilityScore : null,
        verificationStatus: body.verificationStatus || 'unverified',
        chainOfCustody,
        tags: [],
        category: null,
        linkedEvidence: null,
        entities: null,
        evidenceDate: null,
        collectedAt: now,
        collectedBy: submission.submitter_name || null,
      },
      { userId }
    )

    const placeholders = insert.columns.map(() => '?').join(', ')
    const result = await context.env.DB.prepare(`
      INSERT INTO evidence_items (${insert.columns.join(', ')})
      VALUES (${placeholders})
    `).bind(...insert.values).run()

    const evidenceId = String(result.meta.last_row_id)

    // Mark the System-A response accepted + link the evidence (no migration:
    // status/triaged_by/linked_evidence_id already exist on survey_responses).
    await context.env.DB.prepare(`
      UPDATE survey_responses
      SET status = 'accepted',
          triaged_by = ?,
          linked_evidence_id = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(userId, evidenceId, body.submissionId).run()

    return new Response(JSON.stringify({
      success: true,
      evidenceId,
      submission: {
        id: body.submissionId,
        status: 'completed',
        processedAt: now
      }
    }), {
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[process-submission] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to process submission'

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
