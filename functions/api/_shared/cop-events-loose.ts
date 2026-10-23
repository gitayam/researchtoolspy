/**
 * emitCopEvent for entity and event types the shared unions don't list yet
 * ('tag', 'upload', 'tag.applied', …). The cop_events columns are plain text; the
 * `/changes` feed passes entity_type through to clients, which refetch by it.
 */
import { emitCopEvent } from './cop-events'

export interface LooseCopEvent {
  copSessionId: string
  eventType: string
  entityType: string
  entityId?: string | null
  payload?: Record<string, unknown>
  createdBy: number
}

export async function emitCopEventLoose(db: D1Database, event: LooseCopEvent): Promise<void> {
  await emitCopEvent(db, event as unknown as Parameters<typeof emitCopEvent>[1])
}
