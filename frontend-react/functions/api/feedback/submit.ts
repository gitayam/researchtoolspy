/**
 * Feedback Submission API
 *
 * Allows users to submit feedback with optional screenshots
 * POST /api/feedback/submit
 */

interface Env {
  DB: D1Database
  UPLOADS: R2Bucket
}

interface FeedbackRequest {
  toolName?: string
  toolUrl?: string
  description?: string
  screenshot?: string // base64 encoded image
  pageUrl?: string
  userAgent?: string
}

/**
 * POST /api/feedback/submit
 * Submit user feedback with optional screenshot
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const data = await context.request.json() as FeedbackRequest

    // Generate unique ID for this feedback
    const feedbackId = crypto.randomUUID()

    // Handle screenshot upload if provided
    let screenshotUrl: string | null = null
    let screenshotFilename: string | null = null

    if (data.screenshot) {
      try {
        // Extract base64 data (remove data:image/...;base64, prefix)
        const base64Match = data.screenshot.match(/^data:image\/(\w+);base64,(.+)$/)

        if (base64Match) {
          const [, imageType, base64Data] = base64Match
          const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

          // Store in R2 with unique filename
          screenshotFilename = `feedback/${feedbackId}.${imageType}`
          await context.env.UPLOADS.put(screenshotFilename, imageBuffer, {
            httpMetadata: {
              contentType: `image/${imageType}`
            }
          })

          // Generate public URL (assuming R2 bucket has public access or custom domain)
          screenshotUrl = `/uploads/${screenshotFilename}`
        }
      } catch (uploadError) {
        console.error('Screenshot upload failed:', uploadError)
        // Continue without screenshot rather than failing the entire submission
      }
    }

    // Insert feedback into database
    const result = await context.env.DB.prepare(`
      INSERT INTO feedback (
        id,
        tool_name,
        tool_url,
        description,
        screenshot_url,
        screenshot_filename,
        page_url,
        user_agent,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `).bind(
      feedbackId,
      data.toolName || null,
      data.toolUrl || null,
      data.description || null,
      screenshotUrl,
      screenshotFilename,
      data.pageUrl || null,
      data.userAgent || null
    ).run()

    if (!result.success) {
      throw new Error('Failed to insert feedback into database')
    }

    return Response.json({
      success: true,
      feedbackId,
      message: 'Thank you for your feedback! We\'ll review it and use it to improve the platform.'
    }, { status: 201 })

  } catch (error) {
    console.error('Feedback submission error:', error)

    return Response.json({
      success: false,
      error: 'Failed to submit feedback',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET /api/feedback/submit
 * Return API info
 */
export const onRequestGet: PagesFunction = async () => {
  return Response.json({
    endpoint: '/api/feedback/submit',
    method: 'POST',
    description: 'Submit user feedback with optional screenshot',
    fields: {
      toolName: 'string (optional) - Name of the tool or service',
      toolUrl: 'string (optional) - URL or link to the tool',
      description: 'string (optional) - Description of the issue or feedback',
      screenshot: 'string (optional) - Base64 encoded image',
      pageUrl: 'string (optional) - Current page URL',
      userAgent: 'string (optional) - User agent string'
    }
  })
}
