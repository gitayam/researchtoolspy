import type { TimelineEvent } from '@/types/behavior'

function collectEventIds(events: TimelineEvent[], ids: Set<string>): void {
  for (const event of events) {
    if (event.id) ids.add(event.id)
    for (const fork of event.forks || []) collectEventIds(fork.path, ids)
  }
}

function allocateId(candidate: string, fallback: string, usedIds: Set<string>): string {
  const base = candidate.trim().slice(0, 160) || fallback
  let id = base
  let suffix = 2
  while (usedIds.has(id)) {
    const suffixText = `-${suffix}`
    id = `${base.slice(0, 160 - suffixText.length)}${suffixText}`
    suffix += 1
  }
  usedIds.add(id)
  return id
}

function rekeyEvents(events: TimelineEvent[], usedIds: Set<string>, path: string): TimelineEvent[] {
  return events.map((event, eventIndex) => {
    const eventPath = `${path}-${eventIndex + 1}`
    return {
      ...event,
      id: allocateId(event.id || '', eventPath, usedIds),
      ...(event.forks
        ? {
            forks: event.forks.map((fork, forkIndex) => ({
              ...fork,
              path: rekeyEvents(fork.path, usedIds, `${eventPath}-fork-${forkIndex + 1}`),
            })),
          }
        : {}),
    }
  })
}

/**
 * Return a cloned timeline whose event IDs are unique across the full tree and
 * do not collide with any existing events it will be merged into.
 */
export function ensureUniqueTimelineEventIds(
  events: TimelineEvent[],
  reservedEvents: TimelineEvent[] = [],
): TimelineEvent[] {
  const usedIds = new Set<string>()
  collectEventIds(reservedEvents, usedIds)
  return rekeyEvents(events, usedIds, 'ai-event')
}
