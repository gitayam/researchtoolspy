/**
 * researchtoolspy-cron — scheduled maintenance worker.
 *
 * Pages Functions have no native cron trigger, so this standalone Worker fires on a
 * schedule (see wrangler.toml [triggers]) and calls secret-guarded maintenance
 * endpoints on the Pages app.
 *
 * The jobs were previously three near-identical copy-pasted functions, which is how
 * functions/api/cron/cleanup-handoffs.ts came to document itself as driven by "the
 * standalone cron Worker (workers/cron)" while nothing actually called it. One table
 * of jobs makes adding the next one a single line, and makes an unwired endpoint
 * visible rather than implied.
 */

export interface Env {
  CLEANUP_URL: string
  UPLOADS_CLEANUP_URL: string
  GUEST_CLEANUP_URL: string
  HANDOFFS_CLEANUP_URL: string
  CRON_SECRET: string
}

/** Each job is a label and the env var holding its endpoint. */
const JOBS: ReadonlyArray<{ label: string; urlVar: keyof Env }> = [
  { label: 'content cleanup', urlVar: 'CLEANUP_URL' },
  { label: 'upload cleanup', urlVar: 'UPLOADS_CLEANUP_URL' },
  { label: 'guest cleanup', urlVar: 'GUEST_CLEANUP_URL' },
  { label: 'handoff payload sweep', urlVar: 'HANDOFFS_CLEANUP_URL' },
]

/** A scheduled invocation has a wall-clock budget; a hung endpoint must not consume it. */
const JOB_TIMEOUT_MS = 30_000

async function runJob(label: string, url: string | undefined, secret: string): Promise<void> {
  if (!url) {
    console.error(`[cron] ${label}: endpoint URL not configured — skipped`)
    return
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-Cron-Secret': secret },
      signal: AbortSignal.timeout(JOB_TIMEOUT_MS),
    })
    const body = await res.text()
    if (!res.ok) console.error(`[cron] ${label} failed: status=${res.status} body=${body}`)
    else console.log(`[cron] ${label} ok: ${body}`)
  } catch (err) {
    console.error(`[cron] ${label} threw:`, err)
  }
}

async function runMaintenance(env: Env): Promise<void> {
  if (!env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET not set — skipping all maintenance')
    return
  }
  // Sequential rather than parallel: these are D1 write sweeps against one
  // database, and a scheduled run has no deadline pressure worth the contention.
  for (const job of JOBS) {
    await runJob(job.label, env[job.urlVar] as string | undefined, env.CRON_SECRET)
  }
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runMaintenance(env))
  },

  // Not publicly useful; scheduled-only. Returns a liveness string.
  async fetch(): Promise<Response> {
    return new Response('researchtoolspy-cron: scheduled-only worker', { status: 200 })
  },
}
