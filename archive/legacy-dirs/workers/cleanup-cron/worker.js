/**
 * Cloudflare Worker - Scheduled Cleanup
 *
 * This worker runs on a cron schedule to clean up expired content analyses.
 * It calls the cleanup endpoint on the Pages application.
 *
 * Schedule: Daily at 3:00 AM UTC (0 3 * * *)
 */

export default {
  async scheduled(event, env, ctx) {
    try {
      console.log('[Cron] Starting scheduled cleanup at', new Date().toISOString())

      // Call the cleanup endpoint on the Pages application
      const response = await fetch('https://researchtoolspy.pages.dev/api/content-intelligence/cleanup', {
        method: 'POST',
        headers: {
          'User-Agent': 'Cloudflare-Worker-Cron/1.0',
          'X-Cleanup-Source': 'cron-worker'
        }
      })

      if (!response.ok) {
        throw new Error(`Cleanup endpoint returned ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('[Cron] Cleanup successful:', JSON.stringify(result))

      return result
    } catch (error) {
      console.error('[Cron] Cleanup failed:', error)

      // Don't throw - we don't want the cron to retry immediately
      // The next scheduled run will try again
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  }
}
