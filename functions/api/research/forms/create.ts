/**
 * Create Submission Form API
 * POST /api/research/forms/create
 *
 * Create a new anonymous evidence submission form with hash URL
 */

interface Env {
  DB: D1Database
}

interface CreateFormRequest {
  formName: string
  formDescription?: string
  targetInvestigationIds?: string[]
  targetResearchQuestionIds?: string[]
  enabledFields: string[]
  requireUrl?: boolean
  requireContentType?: boolean
  allowAnonymous?: boolean
  autoArchive?: boolean
  collectSubmitterInfo?: boolean
  requireSubmissionPassword?: boolean
  submissionPassword?: string
  expiresAt?: string
}

// Generate 8-character hash for URL
function generateHashId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  const randomValues = new Uint8Array(8)
  crypto.getRandomValues(randomValues)

  for (let i = 0; i < 8; i++) {
    result += chars[randomValues[i] % chars.length]
  }

  return result
}

// Simple password hashing (in production, use bcrypt or similar)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as CreateFormRequest

    // Validation
    if (!body.formName || !body.enabledFields || body.enabledFields.length === 0) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: formName, enabledFields'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate enabled fields
    const validFields = [
      'source_url',
      'archived_url',
      'content_type',
      'content_description',
      'login_required',
      'keywords',
      'submitter_comments',
      'submitter_contact',
      'submitter_name'
    ]

    const invalidFields = body.enabledFields.filter(f => !validFields.includes(f))
    if (invalidFields.length > 0) {
      return new Response(JSON.stringify({
        error: `Invalid fields: ${invalidFields.join(', ')}`,
        validFields
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('[create-form] Creating new form:', body.formName)

    // Generate unique hash ID
    let hashId = generateHashId()
    let attempts = 0

    // Ensure uniqueness (very unlikely collision, but check anyway)
    while (attempts < 5) {
      const existing = await context.env.DB.prepare(`
        SELECT id FROM submission_forms WHERE hash_id = ?
      `).bind(hashId).first()

      if (!existing) break

      hashId = generateHashId()
      attempts++
    }

    if (attempts === 5) {
      return new Response(JSON.stringify({
        error: 'Failed to generate unique hash ID'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Hash password if provided
    let passwordHash: string | null = null
    if (body.requireSubmissionPassword && body.submissionPassword) {
      passwordHash = await hashPassword(body.submissionPassword)
    }

    const formId = crypto.randomUUID()
    const now = new Date().toISOString()

    await context.env.DB.prepare(`
      INSERT INTO submission_forms (
        id, hash_id, creator_workspace_id,
        form_name, form_description,
        target_investigation_ids, target_research_question_ids,
        enabled_fields,
        require_url, require_content_type, allow_anonymous, auto_archive,
        collect_submitter_info, require_submission_password, submission_password_hash,
        is_active, submission_count,
        created_at, updated_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      formId,
      hashId,
      '1', // TODO: Get from auth context
      body.formName,
      body.formDescription || null,
      JSON.stringify(body.targetInvestigationIds || []),
      JSON.stringify(body.targetResearchQuestionIds || []),
      JSON.stringify(body.enabledFields),
      body.requireUrl !== false ? 1 : 0,
      body.requireContentType !== false ? 1 : 0,
      body.allowAnonymous !== false ? 1 : 0,
      body.autoArchive !== false ? 1 : 0,
      body.collectSubmitterInfo === true ? 1 : 0,
      body.requireSubmissionPassword === true ? 1 : 0,
      passwordHash,
      1, // is_active
      0, // submission_count
      now,
      now,
      body.expiresAt || null
    ).run()

    console.log('[create-form] Form created:', formId, 'with hash:', hashId)

    return new Response(JSON.stringify({
      success: true,
      form: {
        id: formId,
        hashId: hashId,
        formName: body.formName,
        submissionUrl: `/submit/${hashId}`,
        createdAt: now
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[create-form] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create form',
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
