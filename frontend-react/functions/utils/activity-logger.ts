// ============================================================================
// Activity Logger Utility - Helper functions for logging activities and notifications
// ============================================================================

interface ActivityLog {
  workspace_id: string
  user_hash: string
  user_name?: string
  activity_type: 'create' | 'update' | 'delete' | 'comment' | 'vote' | 'fork' | 'publish' | 'share' | 'invite'
  entity_type: 'framework' | 'library_item' | 'comment' | 'evidence' | 'entity'
  entity_id?: string
  entity_title?: string
  action_summary: string
  metadata?: Record<string, any>
}

interface NotificationOptions {
  target_user_hash: string
  workspace_id?: string
  notification_type: 'framework_update' | 'comment' | 'mention' | 'fork' | 'vote' | 'rating' | 'invite' | 'share'
  title: string
  message: string
  action_url?: string
  entity_type?: string
  entity_id?: string
  actor_hash: string
  actor_name?: string
}

export async function logActivity(db: D1Database, activity: ActivityLog): Promise<void> {
  try {
    const activityId = `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = new Date().toISOString()

    await db.prepare(`
      INSERT INTO activity_feed (
        id, workspace_id, user_hash, user_name, activity_type,
        entity_type, entity_id, entity_title, action_summary, metadata, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      activityId,
      activity.workspace_id,
      activity.user_hash,
      activity.user_name || null,
      activity.activity_type,
      activity.entity_type,
      activity.entity_id || null,
      activity.entity_title || null,
      activity.action_summary,
      activity.metadata ? JSON.stringify(activity.metadata) : null,
      now
    ).run()

    // Update daily summary
    const today = now.split('T')[0]
    await db.prepare(`
      INSERT INTO workspace_activity_summary (
        id, workspace_id, summary_date, total_activities
      )
      VALUES (?, ?, ?, 1)
      ON CONFLICT(workspace_id, summary_date) DO UPDATE SET
        total_activities = total_activities + 1
    `).bind(
      `summary-${activity.workspace_id}-${today}`,
      activity.workspace_id,
      today
    ).run()
  } catch (error) {
    console.error('[Activity Logger] Error:', error)
    // Don't throw - activity logging should not break the main flow
  }
}

export async function createNotification(db: D1Database, options: NotificationOptions): Promise<void> {
  try {
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
      options.target_user_hash,
      options.workspace_id || null,
      options.notification_type,
      options.title,
      options.message,
      options.action_url || null,
      options.entity_type || null,
      options.entity_id || null,
      options.actor_hash,
      options.actor_name || null,
      now
    ).run()
  } catch (error) {
    console.error('[Notification Creator] Error:', error)
    // Don't throw - notification creation should not break the main flow
  }
}

export async function notifySubscribers(
  db: D1Database,
  entity_type: string,
  entity_id: string,
  event_type: 'update' | 'comment' | 'fork' | 'vote' | 'rating',
  actor_hash: string,
  actor_name: string,
  entity_title: string,
  workspace_id?: string
): Promise<void> {
  try {
    // Find all subscribers for this entity who want notifications for this event type
    const field = `notify_on_${event_type}`
    const subscribers = await db.prepare(`
      SELECT user_hash, ${field} as enabled
      FROM subscription_preferences
      WHERE entity_type = ? AND entity_id = ? AND ${field} = TRUE AND user_hash != ?
    `).bind(entity_type, entity_id, actor_hash).all()

    if (!subscribers.results || subscribers.results.length === 0) {
      return
    }

    // Create notifications for each subscriber
    const notificationPromises = (subscribers.results as any[]).map(async (subscriber) => {
      const notificationTypeMap: Record<string, any> = {
        update: { type: 'framework_update', title: 'Framework Updated', message: `${actor_name} updated "${entity_title}"` },
        comment: { type: 'comment', title: 'New Comment', message: `${actor_name} commented on "${entity_title}"` },
        fork: { type: 'fork', title: 'Framework Forked', message: `${actor_name} forked "${entity_title}"` },
        vote: { type: 'vote', title: 'New Vote', message: `${actor_name} voted on "${entity_title}"` },
        rating: { type: 'rating', title: 'New Rating', message: `${actor_name} rated "${entity_title}"` }
      }

      const notifData = notificationTypeMap[event_type]
      await createNotification(db, {
        target_user_hash: subscriber.user_hash,
        workspace_id,
        notification_type: notifData.type,
        title: notifData.title,
        message: notifData.message,
        action_url: entity_type === 'framework' ? `/dashboard/frameworks/${entity_id}` : undefined,
        entity_type,
        entity_id,
        actor_hash,
        actor_name
      })
    })

    await Promise.all(notificationPromises)
  } catch (error) {
    console.error('[Notify Subscribers] Error:', error)
    // Don't throw - subscriber notification should not break the main flow
  }
}
