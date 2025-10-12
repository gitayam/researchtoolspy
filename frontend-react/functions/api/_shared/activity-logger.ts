/**
 * Activity Logger - Shared utility for logging workspace activity
 * Based on migration 024 schema (activity_feed table)
 */

export interface LogActivityParams {
  workspaceId: string
  actorUserId: string  // User ID as string, or user hash for guests
  actorUserHash?: string  // Optional hash for guests
  actorNickname?: string  // Display name
  actionType: 'CREATED' | 'UPDATED' | 'DELETED' | 'COMMENTED' | 'VOTED' | 'RATED' | 'SHARED' | 'FORKED' | 'PUBLISHED' | 'CLONED'
  entityType: 'FRAMEWORK' | 'ENTITY' | 'COMMENT' | 'WORKSPACE' | 'MEMBER' | 'INVESTIGATION' | 'RESEARCH_QUESTION'
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

    await db.prepare(`
      INSERT INTO activity_feed (
        id, workspace_id, actor_user_id, actor_user_hash, actor_nickname,
        action_type, entity_type, entity_id, entity_title, details
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      activityId,
      params.workspaceId,
      params.actorUserId,
      params.actorUserHash || null,
      params.actorNickname || null,
      params.actionType,
      params.entityType,
      params.entityId,
      params.entityTitle || null,
      params.details ? JSON.stringify(params.details) : null
    ).run()

    console.log(`[activity] Logged ${params.actionType} for ${params.entityType}:${params.entityId}`)
  } catch (error) {
    // Don't fail the main operation if activity logging fails
    console.error('[activity] Failed to log activity:', error)
  }
}

/**
 * Update workspace activity summary (for analytics)
 */
export async function updateWorkspaceActivitySummary(
  db: D1Database,
  workspaceId: string,
  increment: {
    frameworksCreated?: number
    frameworksPublished?: number
    totalComments?: number
    totalVotesReceived?: number
    totalRatingsReceived?: number
  }
): Promise<void> {
  try {
    const updates: string[] = []
    const values: any[] = []

    if (increment.frameworksCreated) {
      updates.push('frameworks_created = frameworks_created + ?')
      values.push(increment.frameworksCreated)
    }
    if (increment.frameworksPublished) {
      updates.push('frameworks_published = frameworks_published + ?')
      values.push(increment.frameworksPublished)
    }
    if (increment.totalComments) {
      updates.push('total_comments = total_comments + ?')
      values.push(increment.totalComments)
    }
    if (increment.totalVotesReceived) {
      updates.push('total_votes_received = total_votes_received + ?')
      values.push(increment.totalVotesReceived)
    }
    if (increment.totalRatingsReceived) {
      updates.push('total_ratings_received = total_ratings_received + ?')
      values.push(increment.totalRatingsReceived)
    }

    if (updates.length === 0) return

    updates.push('last_activity_at = datetime(\'now\')')
    updates.push('updated_at = datetime(\'now\')')

    // Use INSERT OR REPLACE to handle both insert and update
    await db.prepare(`
      INSERT INTO workspace_activity_summary (
        workspace_id, ${updates.map((_, i) => `field${i}`).join(', ')}
      )
      VALUES (?, ${values.map(() => '?').join(', ')})
      ON CONFLICT(workspace_id) DO UPDATE SET
        ${updates.join(', ')}
    `).bind(workspaceId, ...values).run()
  } catch (error) {
    console.error('[activity] Failed to update workspace summary:', error)
  }
}
