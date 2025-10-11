/**
 * Content Analysis Sharing API
 * POST /api/content-intelligence/share - Generate or update share token for analysis
 */

import { getAuthFromCookie } from '../_shared/auth'
import crypto from 'crypto'

interface Env {
  DB: D1Database
}

// POST /api/content-intelligence/share - Make analysis public and get share link
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const auth = getAuthFromCookie(context.request)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { analysisId } = await context.request.json() as { analysisId: number }

    if (!analysisId) {
      return new Response(JSON.stringify({ error: 'Analysis ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify ownership
    const analysis = await context.env.DB.prepare(
      'SELECT id, user_id, share_token FROM content_analysis WHERE id = ?'
    ).bind(analysisId).first()

    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (analysis.user_id !== auth.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate share token if doesn't exist
    let shareToken = analysis.share_token as string | null
    if (!shareToken) {
      shareToken = crypto.randomBytes(16).toString('hex')
    }

    // Update analysis to be public
    await context.env.DB.prepare(
      'UPDATE content_analysis SET is_public = 1, share_token = ? WHERE id = ?'
    ).bind(shareToken, analysisId).run()

    return new Response(JSON.stringify({
      shareToken,
      shareUrl: `${new URL(context.request.url).origin}/public/content-analysis/${shareToken}`
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Share analysis error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to share analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
