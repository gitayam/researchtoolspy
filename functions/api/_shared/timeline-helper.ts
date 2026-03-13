/**
 * Shared helper for creating timeline entries with dedup.
 * Called fire-and-forget from COP API endpoints to auto-generate
 * system timeline entries when investigation actions occur.
 */

export interface TimelineAutoEntry {
  event_date?: string       // defaults to current date
  title: string             // truncated to 200 chars by caller
  description?: string
  category?: string         // event, meeting, communication, financial, legal, etc.
  importance?: string       // low, normal, high, critical
  source_type: 'system'
  entity_type: string       // claim, evidence, entity, hypothesis, marker
  entity_id: string         // primary key of linked record, or hostname for batch
  action: string            // verified, disputed, created, promoted, extracted
}

/**
 * Create a timeline entry with dedup check.
 * Returns the new entry ID, or null if deduped.
 *
 * IMPORTANT: created_by is INTEGER in cop_timeline_entries (not TEXT like cop_claims).
 * Pass userId from getUserIdOrDefault() directly — do NOT cast to string.
 */
export async function createTimelineEntry(
  db: D1Database,
  sessionId: string,
  workspaceId: string,
  userId: number,
  entry: TimelineAutoEntry
): Promise<string | null> {
  // Dedup: skip if matching entry exists within last 5 minutes
  const existing = await db.prepare(
    `SELECT id FROM cop_timeline_entries
     WHERE cop_session_id = ? AND entity_type = ? AND entity_id = ? AND action = ?
       AND created_at > datetime('now', '-300 seconds')`
  ).bind(sessionId, entry.entity_type, entry.entity_id, entry.action).first<{ id: string }>()

  if (existing) return null

  const id = `tle-${crypto.randomUUID().slice(0, 12)}`
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO cop_timeline_entries
      (id, cop_session_id, workspace_id, event_date, title, description, category,
       source_type, importance, entity_type, entity_id, action, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, sessionId, workspaceId,
    entry.event_date || now.slice(0, 10),
    entry.title.slice(0, 200),
    entry.description ?? null,
    entry.category ?? 'event',
    'system',
    entry.importance ?? 'normal',
    entry.entity_type,
    entry.entity_id,
    entry.action,
    userId, // INTEGER — do not cast to string
    now, now,
  ).run()

  return id
}
