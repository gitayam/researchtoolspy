/**
 * Behavior timeline time domains, offsets, and clock mapping.
 *
 * A behavior timeline is a reusable pattern, not a dated record: it describes how a
 * behaviour is performed, not when it happened once. The roadmap's time-domain rule
 * ("Every timeline or scope declares one time domain") makes that explicit, because
 * `time` has until now been free text documented as "HH:MM or relative like T+30min"
 * — so a clock reading and an elapsed offset were the same untyped string and nothing
 * could order, compare, or validate them.
 *
 * Two domains are supported here:
 *
 * - `ordinal`    — known sequence, no elapsed time. Step order carries the meaning.
 * - `anchor_relative` — offsets from the behaviour's start (`T+0`), which is the
 *                  convention the AI generator already emits.
 *
 * `absolute` is deliberately NOT offered. A template has no calendar date, and
 * inventing one would render a pattern as though it were observed history. To place a
 * template on a real calendar, map it to an anchor instant with
 * `resolveBehaviorTimelineToInstants`; that is the only path that produces real dates,
 * and it produces them from the analyst's declared anchor rather than from a guess.
 */

export type BehaviorTimeDomain = 'ordinal' | 'anchor_relative'

export interface BehaviorOffset {
  /** Whole minutes from T0. Negative values are allowed: preparation precedes the act. */
  minutes: number
}

export interface BehaviorOffsetError {
  reason: string
}

const UNITS: Record<string, number> = {
  min: 1, mins: 1, minute: 1, minutes: 1, m: 1,
  h: 60, hr: 60, hrs: 60, hour: 60, hours: 60,
  d: 1440, day: 1440, days: 1440,
}

/**
 * Parses `T+30min`, `T-2h`, `T+0`, `T+1d 6h`. Returns null for an empty value, which is
 * a legitimately unrecorded offset rather than an error.
 */
export function parseBehaviorOffset(raw: string | undefined): BehaviorOffset | BehaviorOffsetError | null {
  const text = (raw || '').trim()
  if (text === '') return null

  const match = /^T\s*([+-])\s*(.+)$/i.exec(text)
  if (!match) {
    return { reason: 'Offsets are written from the behaviour start, for example T+30min, T-2h, or T+0.' }
  }
  const sign = match[1] === '-' ? -1 : 1
  const body = match[2].trim()

  if (/^0$/.test(body)) return { minutes: 0 }

  // Accept a run of quantity+unit pairs so "1d 6h" and "1d6h" both resolve.
  const parts = body.match(/\d+\s*[a-z]+/gi)
  const consumed = parts ? parts.join('').replace(/\s+/g, '') : ''
  if (!parts || consumed !== body.replace(/\s+/g, '')) {
    return { reason: `“${text}” is not a recognised offset. Use a quantity and unit, for example T+30min, T-2h, or T+1d 6h.` }
  }

  let minutes = 0
  for (const part of parts) {
    const pair = /^(\d+)\s*([a-z]+)$/i.exec(part.trim())
    if (!pair) return { reason: `“${text}” is not a recognised offset.` }
    const unit = UNITS[pair[2].toLowerCase()]
    if (unit === undefined) {
      return { reason: `“${pair[2]}” is not a supported unit. Use minutes, hours, or days.` }
    }
    minutes += Number(pair[1]) * unit
  }
  return { minutes: sign * minutes }
}

export function isBehaviorOffsetError(value: unknown): value is BehaviorOffsetError {
  return !!value && typeof value === 'object' && 'reason' in (value as Record<string, unknown>)
}

/** Renders an offset back to canonical `T±` text without inventing precision. */
export function formatBehaviorOffset(offset: BehaviorOffset): string {
  const sign = offset.minutes < 0 ? '-' : '+'
  let remaining = Math.abs(offset.minutes)
  if (remaining === 0) return 'T+0'
  const days = Math.floor(remaining / 1440); remaining -= days * 1440
  const hours = Math.floor(remaining / 60); remaining -= hours * 60
  const parts: string[] = []
  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  if (remaining) parts.push(`${remaining}min`)
  return `T${sign}${parts.join(' ')}`
}

export interface BehaviorTimingFinding {
  eventId: string
  label: string
  kind: 'unparsed' | 'out_of_order'
  detail: string
}

interface TimedEventLike {
  id: string
  label: string
  time?: string
}

/**
 * Reports offsets that cannot be read and offsets that contradict step order. This is a
 * consistency review of what was recorded: it never reorders steps and never rewrites a
 * value, matching how recorded-date review behaves on the evidence timeline.
 */
export function reviewBehaviorTimelineTiming(
  events: readonly TimedEventLike[],
  domain: BehaviorTimeDomain,
): BehaviorTimingFinding[] {
  if (domain !== 'anchor_relative') return []
  const findings: BehaviorTimingFinding[] = []
  let previous: { minutes: number, label: string } | null = null

  for (const event of events) {
    const parsed = parseBehaviorOffset(event.time)
    if (parsed === null) continue
    if (isBehaviorOffsetError(parsed)) {
      findings.push({ eventId: event.id, label: event.label, kind: 'unparsed', detail: parsed.reason })
      continue
    }
    if (previous && parsed.minutes < previous.minutes) {
      findings.push({
        eventId: event.id,
        label: event.label,
        kind: 'out_of_order',
        detail: `${formatBehaviorOffset(parsed)} comes before “${previous.label}” at ${formatBehaviorOffset({ minutes: previous.minutes })}, but is placed after it.`,
      })
    }
    previous = { minutes: parsed.minutes, label: event.label }
  }
  return findings
}

export interface BehaviorInstantResolution {
  eventId: string
  label: string
  /** ISO-8601 UTC instant, present only when the offset resolved. */
  instant?: string
  /** Why this step has no instant, when it has none. */
  omitted?: string
}

/**
 * Maps a relative behaviour template onto a real clock by anchoring T0 to an instant.
 *
 * This is the only supported way a behaviour template acquires calendar dates, and it
 * requires the analyst to supply the anchor. Steps without a readable offset are
 * reported as omitted rather than assigned a guessed time — the same contract the
 * TimelineJS export applies when it refuses to invent an unknown date.
 */
export function resolveBehaviorTimelineToInstants(
  events: readonly TimedEventLike[],
  anchorIso: string,
  domain: BehaviorTimeDomain,
): { ok: false, reason: string } | { ok: true, resolved: BehaviorInstantResolution[] } {
  if (domain !== 'anchor_relative') {
    return { ok: false, reason: 'Only a relative (T±) behaviour timeline can be mapped to a clock. An ordinal timeline records sequence without elapsed time.' }
  }
  const anchor = Date.parse(anchorIso)
  if (!Number.isFinite(anchor)) {
    return { ok: false, reason: 'Enter the instant that T+0 corresponds to before mapping this timeline to a clock.' }
  }
  const resolved = events.map<BehaviorInstantResolution>(event => {
    const parsed = parseBehaviorOffset(event.time)
    if (parsed === null) return { eventId: event.id, label: event.label, omitted: 'No offset recorded; a time is not invented.' }
    if (isBehaviorOffsetError(parsed)) return { eventId: event.id, label: event.label, omitted: parsed.reason }
    return { eventId: event.id, label: event.label, instant: new Date(anchor + parsed.minutes * 60_000).toISOString() }
  })
  return { ok: true, resolved }
}
