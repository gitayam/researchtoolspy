/**
 * SLA Breach Detection
 *
 * Check for tasks that have exceeded their SLA deadline.
 * Intended to be called by a Cloudflare Cron Trigger every 15 minutes.
 *
 * Logic:
 * - Find tasks where sla_breached = 0, sla_started_at + sla_hours < now
 * - Mark them as breached (sla_breached = 1)
 * - Emit task.overdue event for each
 */
import { emitCopEvent } from './cop-events'
import { TASK_OVERDUE } from './cop-event-types'

interface SlaCheckResult {
  tasks_breached: number
}

/**
 * Check for SLA breaches across all active COP sessions.
 * Uses SQLite datetime arithmetic: datetime(sla_started_at, '+N hours') < datetime('now')
 */
export async function checkSlaBreaches(db: D1Database): Promise<SlaCheckResult> {
  const now = new Date().toISOString()
  let tasksBreach = 0

  try {
    // Find tasks that have exceeded their SLA deadline
    const overdueTasks = await db.prepare(`
      SELECT id, cop_session_id, title, assigned_to, sla_hours, sla_started_at
      FROM cop_tasks
      WHERE sla_breached = 0
        AND sla_started_at IS NOT NULL
        AND sla_hours IS NOT NULL
        AND status IN ('todo', 'in_progress')
        AND datetime(sla_started_at, '+' || sla_hours || ' hours') < datetime('now')
    `).all()

    for (const task of (overdueTasks.results || []) as any[]) {
      // Mark as breached
      await db.prepare(
        'UPDATE cop_tasks SET sla_breached = 1, updated_at = ? WHERE id = ?'
      ).bind(now, task.id).run()

      // Emit overdue event
      await emitCopEvent(db, {
        copSessionId: task.cop_session_id,
        eventType: TASK_OVERDUE,
        entityType: 'task',
        entityId: task.id,
        payload: {
          title: task.title,
          assigned_to: task.assigned_to,
          sla_hours: task.sla_hours,
          started_at: task.sla_started_at,
        },
        createdBy: 0, // System (cron)
      })

      tasksBreach++
    }

    if (tasksBreach > 0) {
      console.log(`[SLA Check] Marked ${tasksBreach} task(s) as SLA breached`)
    }
  } catch (error) {
    console.error('[SLA Check] Error checking task SLA breaches:', error)
  }

  return { tasks_breached: tasksBreach }
}
