/**
 * Notification Logger Utility
 * Shared helper for creating user notifications across APIs
 */

export interface CreateNotificationParams {
  targetUserHash: string  // User hash to receive notification
  workspaceId?: string    // Optional workspace context
  notificationType: 'INVESTIGATION_CREATED' | 'INVESTIGATION_UPDATED' | 'INVESTIGATION_DELETED' |
                    'COMMENT_CREATED' | 'COMMENT_MENTIONED' | 'FRAMEWORK_SHARED' |
                    'FRAMEWORK_CLONED' | 'WORKSPACE_INVITATION' | 'MEMBER_JOINED' |
                    'RESEARCH_QUESTION_GENERATED' | 'EVIDENCE_ADDED'
  title: string           // Notification title
  message: string         // Notification message
  actionUrl?: string      // Optional URL to navigate to
  entityType?: string     // Type of entity (investigation, framework, etc.)
  entityId?: string       // ID of entity
  actorHash?: string      // User hash of actor (who triggered the notification)
  actorName?: string      // Display name of actor
}

/**
 * Create a user notification
 * Gracefully handles errors without breaking main operations
 */
export async function createNotification(
  db: D1Database,
  params: CreateNotificationParams
): Promise<void> {
  try {
    // Don't create notifications for guest users
    if (params.targetUserHash === 'guest' || !params.targetUserHash) {
      return
    }

    const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = new Date().toISOString()

    await db.prepare(`
      INSERT INTO user_notifications (
        id, user_hash, workspace_id, notification_type, title, message,
        action_url, entity_type, entity_id, actor_hash, actor_name, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      notificationId,
      params.targetUserHash,
      params.workspaceId || null,
      params.notificationType,
      params.title,
      params.message,
      params.actionUrl || null,
      params.entityType || null,
      params.entityId || null,
      params.actorHash || null,
      params.actorName || null,
      now
    ).run()

    console.log(`[notification] Created ${params.notificationType} for ${params.targetUserHash}`)
  } catch (error) {
    // Don't fail the main operation if notification creation fails
    console.error('[notification] Failed to create notification:', error)
  }
}

/**
 * Notify all workspace members except the actor
 * Useful for team collaboration notifications
 */
export async function notifyWorkspaceMembers(
  db: D1Database,
  workspaceId: string,
  excludeUserHash: string,
  params: Omit<CreateNotificationParams, 'targetUserHash' | 'workspaceId'>
): Promise<void> {
  try {
    // Get all workspace members except the actor
    const members = await db.prepare(`
      SELECT DISTINCT u.account_hash
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ? AND u.account_hash != ? AND u.account_hash IS NOT NULL
    `).bind(workspaceId, excludeUserHash).all()

    if (!members.results || members.results.length === 0) {
      console.log(`[notification] No workspace members to notify for ${workspaceId}`)
      return
    }

    // Create notification for each member
    for (const member of members.results) {
      const userHash = (member as any).account_hash
      if (userHash && userHash !== 'guest') {
        await createNotification(db, {
          targetUserHash: userHash,
          workspaceId,
          ...params
        })
      }
    }

    console.log(`[notification] Notified ${members.results.length} workspace members`)
  } catch (error) {
    console.error('[notification] Failed to notify workspace members:', error)
  }
}
