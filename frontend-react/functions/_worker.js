/**
 * Advanced Worker for Cloudflare Pages
 *
 * This worker handles:
 * 1. Scheduled events (cron triggers) for automated cleanup
 * 2. Passes through all HTTP requests to Pages Functions
 */

export default {
  /**
   * Scheduled handler for cron triggers
   * Runs daily at 3 AM UTC to clean up expired content analyses
   */
  async scheduled(event, env, ctx) {
    try {
      console.log('[Cron] Starting scheduled cleanup task at', new Date().toISOString())

      // Delete expired, unsaved analyses
      const result = await env.DB.prepare(`
        DELETE FROM content_analysis
        WHERE expires_at IS NOT NULL
          AND expires_at < datetime('now')
          AND (is_saved = FALSE OR is_saved IS NULL)
      `).run()

      const deletedCount = result.meta.changes || 0
      console.log(`[Cron] Successfully deleted ${deletedCount} expired content analyses`)

      // Also clean up old guest sessions (older than 30 days)
      const guestResult = await env.DB.prepare(`
        DELETE FROM guest_sessions
        WHERE created_at < datetime('now', '-30 days')
      `).run()

      const deletedGuests = guestResult.meta.changes || 0
      console.log(`[Cron] Successfully deleted ${deletedGuests} old guest sessions`)

      return {
        success: true,
        deleted_analyses: deletedCount,
        deleted_guests: deletedGuests,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('[Cron] Cleanup error:', error)

      // Still return success so the cron doesn't retry (we'll fix issues manually)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    }
  },

  /**
   * HTTP fetch handler
   * Passes all requests through to Pages Functions
   */
  async fetch(request, env, ctx) {
    // Import and use the default Pages Functions handler
    // This ensures all existing Pages Functions continue to work
    return env.ASSETS.fetch(request)
  }
}
