/**
 * v1 ↔ v2 compatibility for `timeline-analysis`.
 *
 * The roadmap gates v2 on "v1 compatibility behavior" being reviewed, and this is it.
 * v1 stays supported for existing consumers, so both directions must be defined —
 * including the cases where v2 can say something v1 structurally cannot.
 *
 * Lifting v1 → v2 is total and lossless: a v1 event states exactly one time, which
 * becomes a single assertion with no working time, because no analyst chose it.
 *
 * Projecting v2 → v1 is lossy by construction, and the loss is the interesting part.
 * v1 has one `eventDate`, a three-value precision, no timezone, no interval, no
 * approximation and no way to represent disagreement. Rather than let that loss be
 * silent, every projection returns an explicit `losses` report alongside the events:
 *
 * - A relative or unknown time has no date v1 could carry. The event is OMITTED, never
 *   given a fabricated date, matching how the TimelineJS export refuses unknown dates.
 * - A sub-day point degrades to `day`; a timezone is dropped. Both are reported.
 * - An approximate date keeps its value but loses the qualifier, so a v1 consumer would
 *   read `1979` as exact. This is the most dangerous loss in the set and is always
 *   reported, so a caller can decide rather than be misled.
 * - Competing assertions collapse to the working time, or to the earliest assertion when
 *   no analyst chose one. The discarded variants are reported by count.
 */

import {
  type EvidenceLocatorV2,
  type SourceAssertionV2,
  type TemporalClaimV2,
  type TimelineAnalysisResponseV2,
  type TimelineEventV2,
  type TimePointV2,
  workingOrEarliestPoint,
} from './timeline-contract-v2'

export interface ProjectionLoss {
  eventId: string
  kind: 'omitted-no-date' | 'precision-reduced' | 'timezone-dropped' | 'approximation-dropped' | 'variants-discarded'
  detail: string
}

export interface ProjectedV1Event {
  eventDate: string
  datePrecision: 'day' | 'month' | 'year'
  title: string
  description: string | null
  category: string
  importance: string
}

export interface V1Projection {
  events: ProjectedV1Event[]
  losses: ProjectionLoss[]
}

function v1Precision(point: TimePointV2): 'day' | 'month' | 'year' {
  if (point.precision === 'year') return 'year'
  if (point.precision === 'month') return 'month'
  return 'day'
}

/** v1 carries calendar text only; anything finer than a day is truncated, not rounded. */
function v1Date(point: TimePointV2): string {
  return point.value.length > 10 ? point.value.slice(0, 10) : point.value
}

export function projectV2ToV1(response: TimelineAnalysisResponseV2): V1Projection {
  const events: ProjectedV1Event[] = []
  const losses: ProjectionLoss[] = []

  for (const event of response.events) {
    const point = workingOrEarliestPoint(event)
    if (!point) {
      losses.push({
        eventId: event.id,
        kind: 'omitted-no-date',
        detail: 'Relative or unknown time has no v1 representation; the event is omitted rather than given an invented date.',
      })
      continue
    }

    if (point.precision !== 'year' && point.precision !== 'month' && point.precision !== 'day') {
      losses.push({ eventId: event.id, kind: 'precision-reduced', detail: `${point.precision} precision reduced to day for v1.` })
    }
    if (point.timezone) {
      losses.push({ eventId: event.id, kind: 'timezone-dropped', detail: `Named timezone ${point.timezone} dropped; v1 has no timezone field.` })
    }
    if (point.approximate) {
      losses.push({
        eventId: event.id,
        kind: 'approximation-dropped',
        detail: `“${v1Date(point)}” was recorded as approximate. v1 cannot carry that qualifier, so a v1 consumer reads it as exact.`,
      })
    }
    const distinct = new Set(event.assertions.map(a => JSON.stringify(a.claim)))
    if (distinct.size > 1) {
      losses.push({
        eventId: event.id,
        kind: 'variants-discarded',
        detail: `${distinct.size} competing source times collapse to one v1 date; the other ${distinct.size - 1} are not representable.`,
      })
    }

    events.push({
      eventDate: v1Date(point),
      datePrecision: v1Precision(point),
      title: event.title,
      description: event.description,
      category: event.category,
      importance: event.importance,
    })
  }

  return { events, losses }
}

export interface LiftableV1Event {
  eventDate: string
  datePrecision: 'day' | 'month' | 'year'
  title: string
  description: string | null
  category: string
  importance: string
}

/**
 * Lifts a v1 event into v2 without inventing anything.
 *
 * The single v1 date becomes one assertion attributed to the analysed article. No working
 * time is set: v1 records no analyst choice, and inventing one would misrepresent a
 * machine-extracted date as a reviewed judgement.
 */
export function liftV1EventToV2(event: LiftableV1Event, id: string, locator?: EvidenceLocatorV2): TimelineEventV2 {
  const at: TimePointV2 = { value: event.eventDate, precision: event.datePrecision }
  const claim: TemporalClaimV2 = { kind: 'instant', at }
  const assertion: SourceAssertionV2 = { id: `${id}-a1`, claim, ...(locator ? { locator } : {}) }
  return {
    id,
    title: event.title,
    description: event.description,
    category: event.category,
    importance: event.importance,
    assertions: [assertion],
  }
}

/** True when projecting this response to v1 would mislead rather than merely simplify. */
export function projectionMisleads(projection: V1Projection): boolean {
  return projection.losses.some(loss => loss.kind === 'approximation-dropped' || loss.kind === 'variants-discarded')
}
