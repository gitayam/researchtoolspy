/**
 * Auto-Assignment Algorithm
 *
 * Finds the least-loaded collaborator with matching skills for a task.
 * Respects max_concurrent limits and availability status.
 * Emits task.assigned or task.unassignable events.
 */
import { emitCopEvent } from './cop-events'
import { TASK_ASSIGNED, TASK_UNASSIGNABLE } from './cop-event-types'

interface AssignmentResult {
  assigned: boolean
  assignee?: string
}

/**
 * Auto-assign a task to the least-loaded collaborator with matching skills.
 * Returns { assigned: true, assignee } or { assigned: false }.
 *
 * Algorithm:
 * 1. Fetch all non-offline collaborators for the session
 * 2. Filter by skill match (task_type in skills array, or 'general' wildcard)
 * 3. Count each collaborator's open tasks (todo + in_progress)
 * 4. Filter out collaborators at max_concurrent capacity
 * 5. Sort by current load ascending (least-loaded first)
 * 6. Assign to the first (least-loaded) collaborator
 */
export async function autoAssignTask(
  db: D1Database,
  sessionId: string,
  taskId: string,
  taskType: string,
  userId: number
): Promise<AssignmentResult> {
  // Get eligible collaborators with matching skills
  const collabs = await db.prepare(`
    SELECT c.id, c.email, c.skills, c.max_concurrent, c.availability
    FROM cop_collaborators c
    WHERE c.cop_session_id = ? AND c.availability != 'offline'
  `).bind(sessionId).all()

  const eligible = (collabs.results || []).filter((c: any) => {
    let skills: string[] = []
    try { skills = JSON.parse(c.skills || '[]') } catch { skills = [] }
    // Match if collaborator has the specific task type skill or 'general' wildcard
    return skills.length === 0 || skills.includes(taskType) || skills.includes('general')
  })

  if (eligible.length === 0) {
    await emitCopEvent(db, {
      copSessionId: sessionId,
      eventType: TASK_UNASSIGNABLE,
      entityType: 'task',
      entityId: taskId,
      payload: { task_type: taskType, reason: 'no_eligible_collaborators' },
      createdBy: userId,
    })
    return { assigned: false }
  }

  // Count current open tasks per collaborator
  const loadPromises = eligible.map(async (c: any) => {
    const count = await db.prepare(
      "SELECT COUNT(*) as cnt FROM cop_tasks WHERE cop_session_id = ? AND assigned_to = ? AND status IN ('todo', 'in_progress')"
    ).bind(sessionId, c.email).first() as any
    return { ...c, current_load: count?.cnt || 0 }
  })

  const withLoad = await Promise.all(loadPromises)

  // Filter by max_concurrent and sort by load (least-loaded first)
  const available = withLoad
    .filter((c: any) => c.current_load < (c.max_concurrent || 5))
    .sort((a: any, b: any) => a.current_load - b.current_load)

  if (available.length === 0) {
    await emitCopEvent(db, {
      copSessionId: sessionId,
      eventType: TASK_UNASSIGNABLE,
      entityType: 'task',
      entityId: taskId,
      payload: { task_type: taskType, reason: 'all_at_capacity' },
      createdBy: userId,
    })
    return { assigned: false }
  }

  const assignee = available[0].email

  await db.prepare(
    'UPDATE cop_tasks SET assigned_to = ?, updated_at = ? WHERE id = ?'
  ).bind(assignee, new Date().toISOString(), taskId).run()

  await emitCopEvent(db, {
    copSessionId: sessionId,
    eventType: TASK_ASSIGNED,
    entityType: 'task',
    entityId: taskId,
    payload: { assigned_to: assignee, strategy: 'least_loaded', current_load: available[0].current_load },
    createdBy: userId,
  })

  return { assigned: true, assignee }
}
