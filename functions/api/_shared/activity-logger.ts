/**
 * Activity Logger - Shared utility for logging workspace activity
 * Uses the canonical migration 023 activity_feed schema that is live in D1.
 */

export interface LogActivityParams {
  workspaceId: string
  actorUserId: string  // User ID as string, or user hash for guests
  actorUserHash?: string  // Optional hash for guests
  actorNickname?: string  // Display name
  actionType: 'CREATED' | 'UPDATED' | 'DELETED' | 'COMMENTED' | 'VOTED' | 'RATED' | 'SHARED' | 'FORKED' | 'PUBLISHED' | 'CLONED' | 'ENABLED' | 'DISABLED'
  entityType: 'FRAMEWORK' | 'ENTITY' | 'COMMENT' | 'WORKSPACE' | 'MEMBER' | 'INVESTIGATION' | 'RESEARCH_QUESTION' | 'SUBMISSION_FORM'
  entityId: string
  entityTitle?: string
  details?: Record<string, any>
}

/**
 * Log activity to the workspace activity feed
 */
export async function logActivity(
  db: D1Database,
  params: LogActivityParams
): Promise<void> {
  try {
    const activityId = crypto.randomUUID()
    const actorName = params.actorNickname || params.actorUserId
    const target = params.entityTitle || params.entityType.toLowerCase()
    const activityType = params.actionType.toLowerCase()
    const actionSummary = `${actorName} ${activityType} ${target}`

    await db.prepare(`
      INSERT INTO activity_feed (
        id, workspace_id, user_hash, user_name, activity_type,
        entity_type, entity_id, entity_title, action_summary, metadata, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      activityId,
      params.workspaceId,
      params.actorUserHash || params.actorUserId,
      params.actorNickname || null,
      activityType,
      params.entityType,
      params.entityId,
      params.entityTitle || null,
      actionSummary,
      params.details ? JSON.stringify(params.details) : null
    ).run()

  } catch (error) {
    // Don't fail the main operation if activity logging fails
    console.error('[activity] Failed to log activity:', error)
  }
}
