/**
 * Cloudflare Cron Trigger Handler
 *
 * Runs on a schedule (every 60 seconds when configured).
 * Executes the playbook engine and SLA breach checker.
 *
 * Note: For Pages projects, cron triggers must be configured via
 * Cloudflare Dashboard or a separate Worker proxy. See wrangler.toml comments.
 */

import { runPlaybookEngine } from './api/_shared/playbook-engine'
import { checkSlaBreaches } from './api/_shared/sla-check'

interface Env {
  DB: D1Database
}

export const onSchedule: PagesFunction<Env> = async (context) => {
  const { env } = context

  try {
    // Run playbook engine (every 60s)
    const engineResult = await runPlaybookEngine(env.DB)
    console.log('[Cron] Playbook engine:', JSON.stringify(engineResult))

    // Run SLA checker
    const slaResult = await checkSlaBreaches(env.DB)
    console.log('[Cron] SLA check:', JSON.stringify(slaResult))
  } catch (error) {
    console.error('[Cron] Error:', error)
  }
}
