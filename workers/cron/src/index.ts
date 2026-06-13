/**
 * researchtoolspy-cron — scheduled maintenance worker.
 *
 * Pages Functions have no native cron trigger, so this standalone Worker fires on a
 * schedule (see wrangler.toml [triggers]) and calls secret-guarded maintenance
 * endpoints on the Pages app. Today it drives the cascade-safe content-analysis
 * cleanup; add more calls to runMaintenance() as other jobs are wired up.
 */

export interface Env {
  CLEANUP_URL: string
  CRON_SECRET: string
}

async function runContentCleanup(env: Env): Promise<void> {
  if (!env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET not set — skipping content cleanup')
    return
  }
  try {
    const res = await fetch(env.CLEANUP_URL, {
      method: 'POST',
      headers: { 'X-Cron-Secret': env.CRON_SECRET },
    })
    const body = await res.text()
    if (!res.ok) {
      console.error(`[cron] content cleanup failed: status=${res.status} body=${body}`)
    } else {
      console.log(`[cron] content cleanup ok: ${body}`)
    }
  } catch (err) {
    console.error('[cron] content cleanup threw:', err)
  }
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runContentCleanup(env))
  },

  // Not publicly useful; scheduled-only. Returns a liveness string.
  async fetch(): Promise<Response> {
    return new Response('researchtoolspy-cron: scheduled-only worker', { status: 200 })
  },
}
