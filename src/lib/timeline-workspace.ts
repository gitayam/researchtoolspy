import type { TimelineWorkspaceEvent, TimelineEventPlacement, TimelineWorkspaceState } from '../types/timeline-workspace'

export const timelineEventAnchor = (id: string) => `timeline-event-${encodeURIComponent(id)}`
export const timelineChapterAnchor = (id: string) => `timeline-chapter-${encodeURIComponent(id)}`

/** Defaults only missing presentation metadata; original extraction and identity are untouched. */
export function withTimelineNarrativeDefaults(workspace: TimelineWorkspaceState, title: string): TimelineWorkspaceState {
  const ordered = orderTimelineEvents(workspace.events)
  const positions = new Map(ordered.map((event, index) => [event.id, index]))
  return {
    ...workspace,
    presentation: workspace.presentation ?? 'analyst',
    sortDirection: workspace.sortDirection ?? 'oldest',
    narrative: workspace.narrative ?? {
      title, framing: '', question: '', intendedUse: '', scope: '', timezone: '', dataThrough: '', chapters: [],
    },
    events: workspace.events.map(event => ({
      ...event,
      narrativeIncluded: event.narrativeIncluded ?? (positions.get(event.id)! < 20),
      narrativeOrder: event.narrativeOrder ?? positions.get(event.id)!,
      whyItMatters: event.whyItMatters ?? '',
      transition: event.transition ?? '',
    })),
  }
}

export function narrativeTimelineEvents(events: TimelineWorkspaceEvent[]): TimelineWorkspaceEvent[] {
  return events.filter(event => event.narrativeIncluded).sort((a, b) =>
    (a.narrativeOrder ?? 0) - (b.narrativeOrder ?? 0) || a.id.localeCompare(b.id))
}

function validSequence(value: number | undefined): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function temporalKey(event: TimelineWorkspaceEvent): string {
  if (event.eventDate) return `0:${event.eventDate}:${event.eventTime || ''}`
  if (event.eventTime) return `1:${event.eventTime}`
  return '2:'
}

export function compareTimelineEventTime(
  left: TimelineWorkspaceEvent,
  right: TimelineWorkspaceEvent,
): number {
  return temporalKey(left).localeCompare(temporalKey(right))
    || left.title.localeCompare(right.title)
    || left.id.localeCompare(right.id)
}

export function orderTimelineEvents(events: TimelineWorkspaceEvent[]): TimelineWorkspaceEvent[] {
  const hasCompleteSequence = events.length > 0 && events.every(event => validSequence(event.sequenceOrder))
  return events
    .map((event, originalIndex) => ({ event, originalIndex }))
    .sort((left, right) => {
      if (hasCompleteSequence) {
        const sequenceDifference = Number(left.event.sequenceOrder) - Number(right.event.sequenceOrder)
        if (sequenceDifference !== 0) return sequenceDifference
      } else {
        const temporalDifference = compareTimelineEventTime(left.event, right.event)
        if (temporalDifference !== 0) return temporalDifference
      }
      return left.originalIndex - right.originalIndex
    })
    .map(({ event }) => event)
}

export function normalizeTimelineEventOrder(events: TimelineWorkspaceEvent[]): TimelineWorkspaceEvent[] {
  return orderTimelineEvents(events).map((event, sequenceOrder) => ({ ...event, sequenceOrder }))
}

function absoluteInsertionIndex(
  ordered: TimelineWorkspaceEvent[],
  nextEvent: TimelineWorkspaceEvent,
): number {
  const insertionIndex = ordered.length
  for (let index = 0; index < ordered.length; index += 1) {
    const candidate = ordered[index]
    const candidateMode = candidate.placement?.mode || 'absolute'
    if (candidateMode !== 'absolute') continue
    if (compareTimelineEventTime(nextEvent, candidate) < 0) return index
  }
  return insertionIndex
}

function relativeInsertionIndex(
  ordered: TimelineWorkspaceEvent[],
  placement: Extract<TimelineEventPlacement, { mode: 'relative' }>,
): number {
  const anchorIndex = ordered.findIndex(event => event.id === placement.anchorEventId)
  if (anchorIndex < 0) return ordered.length
  if (placement.relation === 'before') return anchorIndex

  let insertionIndex = anchorIndex + 1
  while (insertionIndex < ordered.length) {
    const candidatePlacement = ordered[insertionIndex].placement
    if (candidatePlacement?.mode !== 'relative'
      || candidatePlacement.relation !== 'after'
      || candidatePlacement.anchorEventId !== placement.anchorEventId) break
    insertionIndex += 1
  }
  return insertionIndex
}

/**
 * Inserts or moves an event in the analyst's working sequence. Relative and
 * numbered placements are resolved at save time; sequenceOrder then preserves
 * that exact order even if an anchor is later removed.
 */
export function placeTimelineEvent(
  events: TimelineWorkspaceEvent[],
  nextEvent: TimelineWorkspaceEvent,
  placement: TimelineEventPlacement,
): TimelineWorkspaceEvent[] {
  const ordered = orderTimelineEvents(events.filter(event => event.id !== nextEvent.id))
  let insertionIndex: number
  if (placement.mode === 'absolute') {
    insertionIndex = absoluteInsertionIndex(ordered, nextEvent)
  } else if (placement.mode === 'relative') {
    insertionIndex = relativeInsertionIndex(ordered, placement)
  } else {
    insertionIndex = Math.max(0, Math.min(ordered.length, placement.position - 1))
  }

  const inserted = [...ordered]
  inserted.splice(insertionIndex, 0, { ...nextEvent, placement })
  return inserted.map((event, sequenceOrder) => ({ ...event, sequenceOrder }))
}

export function removeTimelineEvent(
  events: TimelineWorkspaceEvent[],
  eventId: string,
): TimelineWorkspaceEvent[] {
  return orderTimelineEvents(events)
    .filter(event => event.id !== eventId)
    .map((event, sequenceOrder) => {
      if (event.placement?.mode !== 'relative' || event.placement.anchorEventId !== eventId) {
        return { ...event, sequenceOrder }
      }
      return {
        ...event,
        sequenceOrder,
        placement: { mode: 'position', position: sequenceOrder + 1 } as const,
      }
    })
}

export function timelineEventTemporalLabel(event: TimelineWorkspaceEvent): string {
  if (event.eventDate && event.eventTime) return `${event.eventDate} ${event.eventTime}`
  if (event.eventDate) return event.eventDate
  if (event.eventTime) return `${event.eventTime} (date unknown)`
  return `Position ${(event.sequenceOrder ?? 0) + 1} (date unknown)`
}
