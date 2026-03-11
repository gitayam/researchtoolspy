import type { CopEventType, CopEventEntityType } from './cop-event-types'

interface EmitCopEventParams {
  copSessionId: string
  eventType: CopEventType
  entityType: CopEventEntityType
  entityId?: string | null
  payload?: Record<string, unknown>
  createdBy: number
}

/**
 * Generate a ULID-like sortable ID.
 * Uses timestamp prefix (base36) + random suffix for uniqueness.
 * Lexicographic order = chronological order.
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(36).padStart(9, '0')
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return `evt-${timestamp}-${random}`
}

/**
 * Emit a structured event to the cop_events bus.
 * Called after every COP mutation. Fire-and-forget — errors are logged
 * but never block the primary response.
 */
export async function emitCopEvent(
  db: D1Database,
  params: EmitCopEventParams
): Promise<void> {
  try {
    const id = generateEventId()
    const payloadStr = JSON.stringify(params.payload ?? {})

    await db.prepare(`
      INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, entity_id, payload, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      params.copSessionId,
      params.eventType,
      params.entityType,
      params.entityId ?? null,
      payloadStr,
      params.createdBy
    ).run()
  } catch (error) {
    // Fire-and-forget: log but never block the primary operation
    console.error('[COP Events] Failed to emit event:', params.eventType, error)
  }
}
