/**
 * Process Submission to Evidence API
 * POST /api/research/submissions/process
 *
 * Convert a form submission into a research evidence entry
 */

interface Env {
  DB: D1Database
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
    const body = await context.request.json() as ProcessSubmissionRequest

    if (!body.submissionId) {
      return new Response(JSON.stringify({
        error: 'Missing required field: submissionId'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('[process-submission] Processing:', body.submissionId)

    // Get submission with form details
    const submission = await context.env.DB.prepare(`
      SELECT
        s.*,
        f.target_investigation_ids,
        f.target_research_question_ids,
        f.form_name
      FROM form_submissions s
      JOIN submission_forms f ON s.form_id = f.id
      WHERE s.id = ?
    `).bind(body.submissionId).first()

    if (!submission) {
      return new Response(JSON.stringify({
        error: 'Submission not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (submission.status === 'completed') {
      return new Response(JSON.stringify({
        error: 'Submission already processed',
        evidenceId: submission.evidence_id
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Determine evidence type
    let evidenceType = body.evidenceType || submission.content_type || 'source'

    // Map content types to evidence types
    const contentTypeMap: Record<string, string> = {
      'article': 'source',
      'video': 'media',
      'social_post': 'source',
      'document': 'document',
      'image': 'media',
      'podcast': 'media',
      'dataset': 'data',
      'other': 'source'
    }

    if (contentTypeMap[evidenceType]) {
      evidenceType = contentTypeMap[evidenceType]
    }

    // Create evidence entry
    const evidenceId = crypto.randomUUID()
    const now = new Date().toISOString()

    // Get target research questions
    const targetResearchQuestionIds = JSON.parse(submission.target_research_question_ids as string || '[]')
    const primaryQuestionId = targetResearchQuestionIds[0] || null

    // Parse metadata
    const metadata = submission.metadata ? JSON.parse(submission.metadata as string) : null

    // Build title from metadata or URL
    const title = metadata?.title ||
                 submission.content_description?.substring(0, 100) ||
                 submission.source_url ||
                 'Untitled Submission'

    // Build content description
    const contentParts = []
    if (submission.content_description) {
      contentParts.push(submission.content_description)
    }
    if (submission.submitter_comments) {
      contentParts.push(`\n\nSubmitter comments: ${submission.submitter_comments}`)
    }
    if (body.notes) {
      contentParts.push(`\n\nReviewer notes: ${body.notes}`)
    }
    const content = contentParts.join('\n')

    // Parse keywords
    const keywords = submission.keywords ? JSON.parse(submission.keywords as string) : []

    // Create chain of custody
    const chainOfCustody = [
      {
        actor: submission.submitter_name || 'anonymous',
        action: 'submitted',
        timestamp: submission.submitted_at,
        notes: `Submitted via form: ${submission.form_name}`
      },
      {
        actor: 'system',
        action: 'processed',
        timestamp: now,
        notes: body.notes || 'Processed into evidence collection'
      }
    ]

    await context.env.DB.prepare(`
      INSERT INTO research_evidence (
        id, research_question_id, investigation_packet_id, workspace_id,
        evidence_type, title, content, source_url,
        verification_status, credibility_score,
        chain_of_custody, tags, metadata, collected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      evidenceId,
      primaryQuestionId,
      null, // investigation_packet_id
      '1', // workspace_id
      evidenceType,
      title,
      content || null,
      submission.source_url || null,
      body.verificationStatus || 'unverified',
      body.credibilityScore || null,
      JSON.stringify(chainOfCustody),
      JSON.stringify(keywords),
      submission.metadata || null,
      now
    ).run()

    // Update submission status
    await context.env.DB.prepare(`
      UPDATE form_submissions
      SET status = 'completed',
          processed_at = ?,
          evidence_id = ?
      WHERE id = ?
    `).bind(now, evidenceId, body.submissionId).run()

    // Log activity for each target research question
    for (const questionId of targetResearchQuestionIds) {
      const activityId = crypto.randomUUID()
      await context.env.DB.prepare(`
        INSERT INTO research_activity (
          id, research_question_id, workspace_id,
          activity_type, actor, content, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        activityId,
        questionId,
        '1',
        'evidence_processed',
        'system',
        `Submission processed into evidence: ${title}`,
        now
      ).run()
    }

    console.log('[process-submission] Created evidence:', evidenceId)

    return new Response(JSON.stringify({
      success: true,
      evidenceId,
      submission: {
        id: body.submissionId,
        status: 'completed',
        processedAt: now
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[process-submission] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to process submission',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
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
