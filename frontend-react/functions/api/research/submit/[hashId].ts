/**
 * Public Submission API
 * GET /api/research/submit/[hashId] - Get form configuration
 * POST /api/research/submit/[hashId] - Submit data to form
 *
 * No authentication required for public evidence submission
 */

interface Env {
  DB: D1Database
}

interface SubmitDataRequest {
  sourceUrl?: string
  archivedUrl?: string
  contentType?: string
  contentDescription?: string
  loginRequired?: boolean
  keywords?: string[]
  submitterComments?: string
  submitterContact?: string
  submitterName?: string
  password?: string
}

// Password verification
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const computedHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return computedHash === hash
}

// Auto-archive URL using Wayback Machine
async function autoArchiveUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(`https://web.archive.org/save/${url}`, {
      method: 'GET',
      redirect: 'follow'
    })

    if (response.ok) {
      return response.url
    }
  } catch (error) {
    console.error('[auto-archive] Failed:', error)
  }

  return null
}

// Extract metadata from URL
async function extractMetadata(url: string): Promise<any> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ResearchToolsPy/1.0 (Evidence Collection Bot)'
      }
    })

    if (!response.ok) {
      return null
    }

    const html = await response.text()

    // Extract Open Graph and basic metadata
    const metadata: any = {}

    // Title
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/) ||
                      html.match(/<title>([^<]+)<\/title>/)
    if (titleMatch) metadata.title = titleMatch[1]

    // Description
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/) ||
                     html.match(/<meta name="description" content="([^"]+)"/)
    if (descMatch) metadata.description = descMatch[1]

    // Author
    const authorMatch = html.match(/<meta name="author" content="([^"]+)"/)
    if (authorMatch) metadata.author = authorMatch[1]

    // Site name
    const siteMatch = html.match(/<meta property="og:site_name" content="([^"]+)"/)
    if (siteMatch) metadata.siteName = siteMatch[1]

    // Type
    const typeMatch = html.match(/<meta property="og:type" content="([^"]+)"/)
    if (typeMatch) metadata.contentType = typeMatch[1]

    // Image
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/)
    if (imageMatch) metadata.imageUrl = imageMatch[1]

    // Publish date
    const dateMatch = html.match(/<meta property="article:published_time" content="([^"]+)"/)
    if (dateMatch) metadata.publishDate = dateMatch[1]

    return metadata
  } catch (error) {
    console.error('[extract-metadata] Failed:', error)
    return null
  }
}

// GET - Retrieve form configuration
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const hashId = context.params.hashId as string

    const form = await context.env.DB.prepare(`
      SELECT
        id, hash_id, form_name, form_description,
        enabled_fields, require_url, require_content_type,
        allow_anonymous, require_submission_password,
        is_active, expires_at
      FROM submission_forms
      WHERE hash_id = ?
    `).bind(hashId).first()

    if (!form) {
      return new Response(JSON.stringify({
        error: 'Form not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!form.is_active) {
      return new Response(JSON.stringify({
        error: 'Form is no longer active'
      }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check expiration
    if (form.expires_at && new Date(form.expires_at) < new Date()) {
      return new Response(JSON.stringify({
        error: 'Form has expired'
      }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      form: {
        hashId: form.hash_id,
        formName: form.form_name,
        formDescription: form.form_description,
        enabledFields: JSON.parse(form.enabled_fields as string),
        requireUrl: form.require_url === 1,
        requireContentType: form.require_content_type === 1,
        requirePassword: form.require_submission_password === 1
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[get-form] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to retrieve form',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// POST - Submit data to form
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const hashId = context.params.hashId as string
    const body = await context.request.json() as SubmitDataRequest

    console.log('[submit-form] Received submission for:', hashId)

    // Get form configuration
    const form = await context.env.DB.prepare(`
      SELECT * FROM submission_forms WHERE hash_id = ?
    `).bind(hashId).first()

    if (!form) {
      return new Response(JSON.stringify({
        error: 'Form not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!form.is_active) {
      return new Response(JSON.stringify({
        error: 'Form is no longer active'
      }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check expiration
    if (form.expires_at && new Date(form.expires_at as string) < new Date()) {
      return new Response(JSON.stringify({
        error: 'Form has expired'
      }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify password if required
    if (form.require_submission_password && form.submission_password_hash) {
      if (!body.password) {
        return new Response(JSON.stringify({
          error: 'Password required'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const isValid = await verifyPassword(body.password, form.submission_password_hash as string)
      if (!isValid) {
        return new Response(JSON.stringify({
          error: 'Invalid password'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Validate required fields
    if (form.require_url && !body.sourceUrl) {
      return new Response(JSON.stringify({
        error: 'Source URL is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (form.require_content_type && !body.contentType) {
      return new Response(JSON.stringify({
        error: 'Content type is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Collect submitter info if enabled
    let submitterIp = null
    let userAgent = null

    if (form.collect_submitter_info) {
      submitterIp = context.request.headers.get('CF-Connecting-IP') ||
                    context.request.headers.get('X-Forwarded-For')
      userAgent = context.request.headers.get('User-Agent')
    }

    // Create submission immediately with provided data
    const submissionId = crypto.randomUUID()
    const now = new Date().toISOString()
    const archivedUrl = body.archivedUrl || null

    await context.env.DB.prepare(`
      INSERT INTO form_submissions (
        id, form_id,
        source_url, archived_url, content_type, content_description,
        login_required, keywords, submitter_comments,
        submitter_contact, submitter_name,
        metadata, status,
        submitter_ip, user_agent, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      submissionId,
      form.id,
      body.sourceUrl || null,
      archivedUrl,
      body.contentType || null,
      body.contentDescription || null,
      body.loginRequired ? 1 : 0,
      body.keywords ? JSON.stringify(body.keywords) : null,
      body.submitterComments || null,
      body.submitterContact || null,
      body.submitterName || null,
      null, // metadata - will be updated async
      'pending',
      submitterIp,
      userAgent,
      now
    ).run()

    // Process archiving and metadata extraction in background
    if (body.sourceUrl) {
      context.waitUntil(
        (async () => {
          try {
            // Auto-archive if enabled and not already provided
            let autoArchivedUrl = null
            if (form.auto_archive && !body.archivedUrl) {
              console.log('[submit-form] Background: Auto-archiving URL:', body.sourceUrl)
              autoArchivedUrl = await autoArchiveUrl(body.sourceUrl!)
            }

            // Extract metadata
            console.log('[submit-form] Background: Extracting metadata from:', body.sourceUrl)
            const metadata = await extractMetadata(body.sourceUrl!)

            // Update submission with extracted data
            await context.env.DB.prepare(`
              UPDATE form_submissions
              SET archived_url = COALESCE(?, archived_url),
                  metadata = ?
              WHERE id = ?
            `).bind(
              autoArchivedUrl,
              metadata ? JSON.stringify(metadata) : null,
              submissionId
            ).run()

            console.log('[submit-form] Background: Updated submission', submissionId, 'with metadata')
          } catch (error) {
            console.error('[submit-form] Background processing failed:', error)
            // Don't fail the submission - just log the error
          }
        })()
      )
    }

    // Increment submission count
    await context.env.DB.prepare(`
      UPDATE submission_forms
      SET submission_count = submission_count + 1,
          updated_at = ?
      WHERE id = ?
    `).bind(now, form.id).run()

    // Log activity for each target research question
    const targetResearchQuestionIds = JSON.parse(form.target_research_question_ids as string || '[]')

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
        'evidence_submitted',
        body.submitterName || 'anonymous',
        `New submission via "${form.form_name}": ${body.contentDescription || body.sourceUrl || 'Untitled'}`,
        now
      ).run()
    }

    console.log('[submit-form] Submission created:', submissionId)

    return new Response(JSON.stringify({
      success: true,
      submission: {
        id: submissionId,
        status: 'pending',
        archivedUrl: archivedUrl || undefined,
        submittedAt: now
      },
      message: 'Thank you for your submission. It will be reviewed shortly.'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[submit-form] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to submit data',
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
