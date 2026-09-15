/**
 * Anchor mapping between a relative child sequence and host calendar anchors.
 *
 * A relative sequence (a behaviour template, an offset ladder recovered from a source)
 * has no calendar position of its own. It acquires one only by being mapped to host
 * anchors the analyst supplies. The roadmap's rules for that mapping are specific, and
 * each is load-bearing here:
 *
 * - A single valid mapping can place an offset sequence.
 * - Several anchors may constrain the same mapping. If they disagree, that is a mapping
 *   conflict to surface — never a reason to stretch the child to fit.
 * - Do not infer arbitrary time scaling, timezone, precision, or duration.
 * - Mapping an uncertain anchor propagates that uncertainty, and never upgrades the
 *   child's temporal precision.
 *
 * The last rule is why every result here is a window rather than an instant. An anchor
 * recorded as `1979` constrains its sequence to somewhere in 1979; reporting a child step
 * as `1979-04-02T14:30Z` would manufacture precision the record never had. A window keeps
 * the honest answer visible, and an approximate anchor marks the window approximate so it
 * is not later read as exact.
 */

import { calendarLabelBounds, type CalendarLabel } from './timeline-temporal'

export type MappedPrecision = 'year' | 'month' | 'day' | 'time'

/** Coarsest first: a mapping can never resolve finer than its coarsest constraint. */
const PRECISION_ORDER: MappedPrecision[] = ['year', 'month', 'day', 'time']

function labelPrecision(label: CalendarLabel): MappedPrecision {
  if (label.time) return 'time'
  if (label.precision) return label.precision
  const parts = (label.date || '').split('-').length
  return parts >= 3 ? 'day' : parts === 2 ? 'month' : 'year'
}

function coarsest(a: MappedPrecision, b: MappedPrecision): MappedPrecision {
  return PRECISION_ORDER.indexOf(a) <= PRECISION_ORDER.indexOf(b) ? a : b
}

export interface TimelineAnchor {
  /** Host event this anchor refers to, used to name a conflict. */
  eventId: string
  /** The host's recorded date. Its precision bounds what the mapping can claim. */
  label: CalendarLabel
  /** The host's recorded date is approximate (circa). */
  approximate?: boolean
  /** Offset within the child sequence that this host anchor corresponds to. */
  childOffsetMinutes: number
}

export interface MappedWindow {
  /**
   * Half-open calendar-coordinate bounds, `[start, end)`, matching calendarLabelBounds:
   * the year 1979 ends at 1980-01-01T00:00:00Z. Display must therefore use the last
   * instant inside the window, not `end` itself.
   */
  start: number
  end: number
  precision: MappedPrecision
  approximate: boolean
}

export interface AnchorMappingConflict {
  eventIds: string[]
  detail: string
}

export type AnchorMappingResult =
  | { ok: false; reason: string; conflict?: AnchorMappingConflict }
  | { ok: true; t0: MappedWindow; constrainedBy: string[] }

const MINUTE = 60_000

/**
 * Resolves where the child's `T+0` sits, given one or more host anchors.
 *
 * Each anchor predicts a T0 window by shifting the host's own window back by that
 * anchor's offset. Agreement narrows the result; disagreement is reported rather than
 * averaged, because averaging two incompatible records invents a third one that no
 * source claimed.
 */
export function resolveAnchorMapping(anchors: readonly TimelineAnchor[]): AnchorMappingResult {
  if (anchors.length === 0) {
    return { ok: false, reason: 'A relative sequence stays on its own T± axis until at least one anchor maps it to a host record.' }
  }

  let window: MappedWindow | null = null
  const constrainedBy: string[] = []

  for (const anchor of anchors) {
    const bounds = calendarLabelBounds(anchor.label)
    if ('reason' in bounds) {
      return { ok: false, reason: `Anchor “${anchor.eventId}” has no usable recorded date (${bounds.reason}); a mapping is not guessed from it.` }
    }
    const shift = anchor.childOffsetMinutes * MINUTE
    const predicted: MappedWindow = {
      start: bounds.start - shift,
      end: bounds.end - shift,
      precision: labelPrecision(anchor.label),
      approximate: anchor.approximate === true,
    }
    constrainedBy.push(anchor.eventId)

    if (!window) { window = predicted; continue }

    const start = Math.max(window.start, predicted.start)
    const end = Math.min(window.end, predicted.end)
    // Half-open: windows overlap only when the intersection has width.
    if (start >= end) {
      return {
        ok: false,
        reason: 'Anchors disagree about where this sequence starts. The sequence is not stretched to satisfy both.',
        conflict: { eventIds: [...constrainedBy], detail: `“${anchors[0].eventId}” and “${anchor.eventId}” predict start windows that do not overlap.` },
      }
    }
    window = {
      start,
      end,
      // Agreement narrows the window but never refines what either record actually said.
      precision: coarsest(window.precision, predicted.precision),
      approximate: window.approximate || predicted.approximate,
    }
  }

  return { ok: true, t0: window!, constrainedBy }
}

/**
 * Projects one child step from a resolved T0 window.
 *
 * The step inherits the mapping's width, precision and approximation — a step is never
 * more precisely placed than the anchor that positioned it.
 */
export function projectMappedStep(t0: MappedWindow, offsetMinutes: number): MappedWindow {
  const shift = offsetMinutes * MINUTE
  return { start: t0.start + shift, end: t0.end + shift, precision: t0.precision, approximate: t0.approximate }
}

/**
 * Renders a mapped window for display. Returns the precision actually supported, and
 * marks approximation, so a caller cannot accidentally print a bare exact-looking date.
 */
export function describeMappedWindow(window: MappedWindow): string {
  const iso = (value: number) => new Date(value).toISOString()
  const startIso = iso(window.start)
  // `end` is exclusive, so describe the last instant the window actually covers.
  const endIso = iso(Math.max(window.start, window.end - 1))
  const trim = (value: string) =>
    window.precision === 'year' ? value.slice(0, 4)
      : window.precision === 'month' ? value.slice(0, 7)
        : window.precision === 'day' ? value.slice(0, 10)
          : value.slice(0, 19).replace('T', ' ')
  const circa = window.approximate ? 'circa ' : ''
  const start = trim(startIso)
  const end = trim(endIso)
  return start === end ? `${circa}${start}` : `${circa}${start} to ${end}`
}
