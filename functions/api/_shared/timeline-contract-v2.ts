/**
 * `timeline-analysis.v2` — rich temporal claims and evidence locators.
 *
 * NOT YET SERVED. The roadmap gates release: "Release timeline-analysis.v2 only after
 * its JSON Schema, v1 compatibility behavior, evidence-locator semantics, and migration
 * guide are reviewed." This module is the reviewable implementation of that contract; the
 * extract-timeline endpoint still answers v1 and capability discovery still advertises
 * v1 only. Nothing here changes what an existing consumer receives.
 *
 * v2 exists because v1 flattens time. A v1 event carries `eventDate` plus a three-value
 * `datePrecision` (day/month/year), which cannot express a timestamp to milliseconds, a
 * named timezone, a bounded interval, an approximate date, a purely relative placement,
 * or an explicit unknown. It also collapses disagreement: if two sources date the same
 * event differently, v1 has one field, so one of them is silently discarded.
 *
 * Two rules drive the shape below:
 *
 * 1. Recorded precision is preserved, never upgraded. A point carries the precision its
 *    source actually stated. Nothing here promotes `1979` to a day or an instant.
 * 2. Disagreement is retained, not resolved. Every source assertion keeps its own claim.
 *    An analyst's working time is an additional, citing layer — it never overwrites the
 *    variants it was chosen from.
 */

export const TIMELINE_ANALYSIS_V2_SCHEMA_VERSION = 'timeline-analysis.v2' as const

export const TIME_PRECISIONS = ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond'] as const
export type TimePrecision = typeof TIME_PRECISIONS[number]

/** Calendar text expected at each precision, used for validation rather than parsing. */
const PRECISION_SHAPES: Record<TimePrecision, RegExp> = {
  year: /^\d{4}$/,
  month: /^\d{4}-\d{2}$/,
  day: /^\d{4}-\d{2}-\d{2}$/,
  hour: /^\d{4}-\d{2}-\d{2}T\d{2}$/,
  minute: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
  second: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
  millisecond: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/,
}

export interface TimePointV2 {
  /** Calendar text at exactly `precision`. Never padded out to a finer shape. */
  value: string
  precision: TimePrecision
  /**
   * IANA zone name, only when the source stated one. Absent means the source did not say,
   * which is different from UTC — v2 never infers a zone.
   */
  timezone?: string
  /** The source's own wording, preserved verbatim for display. */
  displayText?: string
  /** The source qualified this as approximate (circa). */
  approximate?: boolean
}

/**
 * Why a time is unknown. Required, because an untyped unknown collapses distinctions the
 * record depends on: the roadmap's rule that "not observed" must stay different from
 * "observed absent" and "not collected" applies with particular force to testimony.
 *
 * - `not_asked`    — the question was never put. Silence is not an answer, and an account
 *                    that never covered a topic must never read as one that omitted it.
 * - `declined`     — asked, and the answer was withheld. This is a positive act with its
 *                    own legal weight and must never be recorded as ignorance.
 * - `not_recalled` — asked, and the person stated they do not know or remember. This is a
 *                    claim ABOUT memory, and it is evidence in its own right.
 * - `not_recorded` — an answer may have been given, but the source document does not
 *                    capture it. This separates a gap in our record from a gap in theirs.
 */
export const UNKNOWN_BASES = ['not_asked', 'declined', 'not_recalled', 'not_recorded'] as const
export type UnknownBasis = typeof UNKNOWN_BASES[number]

export type TemporalClaimV2 =
  | { kind: 'instant'; at: TimePointV2 }
  | { kind: 'interval'; start: TimePointV2; end: TimePointV2 }
  | { kind: 'relative'; relation: 'before' | 'after' | 'during'; anchorRef: string; displayText?: string }
  | { kind: 'unknown'; basis: UnknownBasis; displayText?: string; note?: string }

/**
 * Where in the source a claim came from. `text-quote` is preferred because it survives
 * reformatting; `text-position` offsets do not, and are only meaningful alongside the
 * exact retrieved content they were computed against.
 */
export type EvidenceLocatorV2 =
  | { kind: 'text-quote'; exact: string; prefix?: string; suffix?: string }
  | { kind: 'text-position'; start: number; end: number }
  | { kind: 'page'; page: number }
  | { kind: 'media-timestamp'; at: string }

export interface SourceAssertionV2 {
  id: string
  /** Which source said it. Absent for the analysed article itself. */
  sourceRef?: string
  claim: TemporalClaimV2
  locator?: EvidenceLocatorV2
}

export interface TimelineEventV2 {
  id: string
  title: string
  description: string | null
  category: string
  importance: string
  /** Every source's claim, retained as stated. Two assertions may disagree; both stand. */
  assertions: SourceAssertionV2[]
  /**
   * The analyst's chosen time. It must cite the assertions it rests on and never edits
   * them, so the disagreement it was selected from stays inspectable.
   */
  workingTime?: { claim: TemporalClaimV2; citesAssertionIds: string[]; rationale?: string }
}

export interface TimelineAnalysisResponseV2 {
  schemaVersion: typeof TIMELINE_ANALYSIS_V2_SCHEMA_VERSION
  requestId: string
  outcome: 'events' | 'no_events'
  article: { url: string; title: string; domain: string; publishedAt?: string }
  events: TimelineEventV2[]
  extraction: unknown
  model: unknown
}

export function isUnknownBasis(value: unknown): value is UnknownBasis {
  return typeof value === 'string' && (UNKNOWN_BASES as readonly string[]).includes(value)
}

/** True when an unknown time carries information rather than merely lacking it. */
export function unknownIsInformative(basis: UnknownBasis): boolean {
  // Someone declining, or stating they cannot recall, told us something. Nobody asking,
  // or our own record failing to capture it, did not.
  return basis === 'declined' || basis === 'not_recalled'
}

export function isTimePrecision(value: unknown): value is TimePrecision {
  return typeof value === 'string' && (TIME_PRECISIONS as readonly string[]).includes(value)
}

/** Validates that a point's text matches the precision it declares. */
export function validateTimePoint(point: TimePointV2): { ok: true } | { ok: false; reason: string } {
  if (!isTimePrecision(point.precision)) return { ok: false, reason: `unknown precision “${String(point.precision)}”` }
  if (typeof point.value !== 'string' || !PRECISION_SHAPES[point.precision].test(point.value)) {
    return { ok: false, reason: `value “${String(point.value)}” does not match ${point.precision} precision` }
  }
  if (point.timezone !== undefined && (typeof point.timezone !== 'string' || point.timezone === '')) {
    return { ok: false, reason: 'timezone must be a non-empty IANA name when present' }
  }
  return { ok: true }
}

/**
 * Deterministic sort key for an event, independent of display.
 *
 * Sorting must not require inventing a time, so the key is derived from the coarse
 * calendar text only: a year sorts at the start of that year. Callers that need a
 * conservative window use the temporal helpers instead — this is ordering, not truth.
 * Events with no usable point sort last, deterministically, rather than being dropped.
 */
export function eventSortKey(event: TimelineEventV2): string {
  const point = workingOrEarliestPoint(event)
  if (!point) return '9999-12-31T23:59:59.999'
  const padded = point.value.length === 4 ? `${point.value}-01-01T00:00:00.000`
    : point.value.length === 7 ? `${point.value}-01T00:00:00.000`
      : point.value.length === 10 ? `${point.value}T00:00:00.000`
        : point.value.padEnd(23, point.value.includes('.') ? '0' : ':00:00.000'.slice(point.value.length - 13))
  return padded.slice(0, 23)
}

function claimPoint(claim: TemporalClaimV2): TimePointV2 | null {
  if (claim.kind === 'instant') return claim.at
  if (claim.kind === 'interval') return claim.start
  return null
}

/** The working time's point when set, else the earliest assertion's, else none. */
export function workingOrEarliestPoint(event: TimelineEventV2): TimePointV2 | null {
  if (event.workingTime) {
    const point = claimPoint(event.workingTime.claim)
    if (point) return point
  }
  const points = event.assertions.map(a => claimPoint(a.claim)).filter((p): p is TimePointV2 => p !== null)
  if (points.length === 0) return null
  return points.reduce((earliest, point) => (point.value < earliest.value ? point : earliest))
}

/** True when this event's sources disagree about its time. */
export function hasTemporalDisagreement(event: TimelineEventV2): boolean {
  const serialized = event.assertions.map(a => JSON.stringify(a.claim))
  return new Set(serialized).size > 1
}
