/**
 * Content Analysis Sharing API
 * POST /api/content-intelligence/share - Generate or update share token for analysis
 */

import { getUserIdOrDefault } from '../_shared/auth-helpers'
import crypto from 'node:crypto'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

// POST /api/content-intelligence/share - Make analysis public and get share link
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    // Get user ID (supports hash-based auth and session auth)
    const userId = await getUserIdOrDefault(context.request, context.env)

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

    // Allow sharing if user owns the analysis
    if (analysis.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized - you can only share your own analyses' }), {
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
