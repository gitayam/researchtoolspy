/**
 * Content Intelligence Cleanup API
 *
 * Deletes expired content analyses that haven't been saved permanently
 * Can be called periodically via cron or manually
 */

interface Env {
  DB: D1Database
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    console.log('[Cleanup] Starting content analysis cleanup...')

    // Delete expired, unsaved analyses
    const result = await context.env.DB.prepare(`
      DELETE FROM content_analysis
      WHERE expires_at IS NOT NULL
        AND expires_at < datetime('now')
        AND (is_saved = FALSE OR is_saved IS NULL)
    `).run()

    console.log(`[Cleanup] Deleted ${result.meta.changes || 0} expired analyses`)

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
      error: 'Cleanup failed',
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

// Also support GET for manual triggering
export const onRequestGet: PagesFunction<Env> = async (context) => {
  return onRequestPost(context)
}
