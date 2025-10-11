/**
 * Save Content Analysis Permanently
 *
 * Marks a content analysis as saved, preventing automatic deletion
 * Generates a shareable token if requested
 */

import { getUserFromRequest } from '../_shared/auth-helpers'
import { randomBytes } from 'crypto'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface SaveRequest {
  analysis_id: string
  generate_share_link?: boolean
  note?: string
  tags?: string[]
}

function generateShareToken(): string {
  return randomBytes(16).toString('hex')
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)

    if (!userId) {
      return new Response(JSON.stringify({
        error: 'Authentication required to save analyses'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    const body = await context.request.json() as SaveRequest

    if (!body.analysis_id) {
      return new Response(JSON.stringify({
        error: 'Missing analysis_id'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Verify ownership
    const existing = await context.env.DB.prepare(
      'SELECT user_id FROM content_analysis WHERE id = ?'
    ).bind(body.analysis_id).first()

    if (!existing) {
      return new Response(JSON.stringify({
        error: 'Analysis not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    if (existing.user_id !== userId) {
      return new Response(JSON.stringify({
        error: 'Access denied'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Generate share token if requested
    const shareToken = body.generate_share_link ? generateShareToken() : null

    // Save permanently (remove expiration)
    await context.env.DB.prepare(`
      UPDATE content_analysis
      SET is_saved = TRUE,
          expires_at = NULL,
          share_token = COALESCE(?, share_token),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      shareToken,
      body.analysis_id
    ).run()

    // Update saved_link if exists
    if (existing.saved_link_id && (body.note || body.tags)) {
      await context.env.DB.prepare(`
        UPDATE saved_links
        SET note = COALESCE(?, note),
            tags = COALESCE(?, tags),
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        body.note || null,
        body.tags ? JSON.stringify(body.tags) : null,
        existing.saved_link_id
      ).run()
    }

    console.log(`[Save] Permanently saved analysis ${body.analysis_id}`)

    return new Response(JSON.stringify({
      success: true,
      analysis_id: body.analysis_id,
      share_token: shareToken,
      share_url: shareToken ? `/share/content/${shareToken}` : null,
      message: 'Analysis saved permanently'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('[Save] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to save analysis',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}
