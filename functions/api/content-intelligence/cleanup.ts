/**
 * Content Intelligence Cleanup API
 *
 * Deletes expired content analyses that haven't been saved permanently
 * Can be called periodically via cron or manually
 */

import { getUserFromRequest } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }

    // Delete expired, unsaved analyses
    const result = await context.env.DB.prepare(`
      DELETE FROM content_analysis
      WHERE expires_at IS NOT NULL
        AND expires_at < datetime('now')
        AND (is_saved = FALSE OR is_saved IS NULL)
    `).run()


    return new Response(JSON.stringify({
      success: true,
      deleted_count: result.meta.changes || 0,
      message: `Successfully deleted ${result.meta.changes || 0} expired content analyses`
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('[Cleanup] Error:', error)
    return new Response(JSON.stringify({
      error: 'Cleanup failed'

    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

// GET returns cleanup status info (no mutation, no auth required)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const result = await context.env.DB.prepare(`
      SELECT COUNT(*) as expired_count FROM content_analysis
      WHERE expires_at IS NOT NULL
        AND expires_at < datetime('now')
        AND (is_saved = FALSE OR is_saved IS NULL)
    `).first()

    return new Response(JSON.stringify({
      expired_count: result?.expired_count || 0,
      message: 'Use POST to trigger cleanup'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to check cleanup status' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
}
