import { analyzableUrlFrom } from '@/lib/content-url'

/**
 * What the COP capture bar does with a line an analyst typed.
 *
 * Pulled out of the component because routing is the part that has to be
 * exactly right and the part worth testing: an analyst working a live picture
 * types fast, in fragments, and finds out where it went afterwards. Sending a
 * request for information to the evidence feed is not a cosmetic mistake — it
 * is a question nobody will answer.
 *
 * The grammar is prefix-based because prefixes survive being typed at speed.
 * Priority rides on repeated `!` so raising it costs one keystroke rather than
 * a trip to a dropdown:
 *
 *   rfi: who controls the bridge      -> RFI, medium
 *   rfi!: who controls the bridge     -> RFI, high
 *   rfi!!: who controls the bridge    -> RFI, critical, and a blocker
 *
 * The same punctuation raises a task's priority, because a convention that
 * works in one place and not the next is worse than no convention.
 *
 *   nai: 34.05,-118.24 North bridge  -> a named area of interest, on the map
 *   task!: confirm the bridge status -> task, high
 *   t: 2026-03-14 convoy departed    -> timeline entry on that date
 */

export type CaptureKind = 'rfi' | 'nai' | 'task' | 'timeline' | 'hypothesis' | 'survey' | 'url' | 'note'
export type Priority = 'critical' | 'high' | 'medium'
/** Retained name: RFIs were the first thing to carry a priority. */
export type RfiPriority = Priority

export interface ParsedCapture {
  kind: CaptureKind
  /** The text after any prefix, which is what actually gets stored. */
  body: string
  /** What the bar tells the analyst before they commit. */
  label: string
  priority?: Priority
  isBlocker?: boolean
  /** For `url`, the normalised address — a bare host gains its scheme. */
  url?: string
  /** For `nai`, the location token to resolve; the body is the area's name. */
  location?: string
  /** For `timeline`, an explicit date the analyst supplied. */
  eventDate?: string
  /** Why this input cannot be sent, shown before they try. */
  problem?: string
}

/** `rfi`, `rfi!`, `rfi!!` … then a colon. */
const RFI = /^rfi(!*)\s*:\s*/i
const NAI = /^(?:nai|aoi)\s*:\s*/i
const TASK = /^task(!*)\s*:\s*/i
const TIMELINE = /^(?:t|time|timeline)\s*:\s*/i
const HYPOTHESIS = /^(?:hypothesis|hyp|maybe)\s*:\s*/i
const SURVEY = /^(?:survey|form|drop)\s*:\s*/i
const NOTE = /^note\s*:\s*/i

/**
 * A leading location token: `34.05,-118.24`, an MGRS grid, or a map URL.
 *
 * Only the leading token, because the rest of the line is the area's name. The
 * resolver at /api/surveys/resolve-location does the actual conversion — it
 * already understands lat/lon, MGRS, and Google, Apple and OSM map links, and
 * duplicating any of that here would mean two parsers disagreeing later.
 */
const LEADING_LOCATION = /^(https?:\/\/\S+|-?\d{1,3}\.?\d*\s*,\s*-?\d{1,3}\.?\d*|\d{1,2}[A-Za-z]{3}\d{2,10})\s*/

/** `YYYY-MM-DD` at the front of a timeline entry. */
const LEADING_DATE = /^(\d{4}-\d{2}-\d{2})\s+/

function priorityFor(bangs: number): { priority: Priority; isBlocker: boolean } {
  if (bangs >= 2) return { priority: 'critical', isBlocker: true }
  if (bangs === 1) return { priority: 'high', isBlocker: false }
  return { priority: 'medium', isBlocker: false }
}

export function parseCapture(raw: string): ParsedCapture | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const rfi = RFI.exec(trimmed)
  if (rfi) {
    const body = trimmed.slice(rfi[0].length).trim()
    if (!body) return null
    const { priority, isBlocker } = priorityFor(rfi[1].length)
    return {
      kind: 'rfi',
      body,
      priority,
      isBlocker,
      label: isBlocker
        ? 'Request for information — critical, blocking'
        : `Request for information — ${priority} priority`,
    }
  }

  const nai = NAI.exec(trimmed)
  if (nai) {
    const rest = trimmed.slice(nai[0].length).trim()
    if (!rest) return null
    const located = LEADING_LOCATION.exec(rest)
    if (!located) {
      // A named area of interest without an area is not one. Say so here rather
      // than let the marker endpoint refuse it after the analyst has moved on.
      return {
        kind: 'nai',
        body: rest,
        label: 'Named area of interest',
        problem: 'Start with a location: 34.05,-118.24 · an MGRS grid · or a map link.',
      }
    }
    const name = rest.slice(located[0].length).trim()
    return {
      kind: 'nai',
      body: name || located[1],
      location: located[1],
      label: `Named area of interest at ${located[1]}`,
    }
  }

  const task = TASK.exec(trimmed)
  if (task) {
    const body = trimmed.slice(task[0].length).trim()
    if (!body) return null
    const { priority, isBlocker } = priorityFor(task[1].length)
    return {
      kind: 'task',
      body,
      priority,
      isBlocker,
      label: `Task — ${priority} priority`,
    }
  }

  const timeline = TIMELINE.exec(trimmed)
  if (timeline) {
    const rest = trimmed.slice(timeline[0].length).trim()
    if (!rest) return null
    const dated = LEADING_DATE.exec(rest)
    const eventDate = dated?.[1]
    const body = dated ? rest.slice(dated[0].length).trim() : rest
    if (!body) return null
    return {
      kind: 'timeline',
      body,
      eventDate,
      label: eventDate ? `Timeline — ${eventDate}` : 'Timeline — today',
    }
  }

  const hypothesis = HYPOTHESIS.exec(trimmed)
  if (hypothesis) {
    const body = trimmed.slice(hypothesis[0].length).trim()
    if (!body) return null
    return { kind: 'hypothesis', body, label: 'Hypothesis ledger' }
  }

  const survey = SURVEY.exec(trimmed)
  if (survey) {
    const body = trimmed.slice(survey[0].length).trim()
    // A survey with no title is still a survey; it just needs a name.
    return { kind: 'survey', body: body || 'Untitled Drop', label: 'New collection form' }
  }

  // An explicit `note:` beats URL detection, so an analyst can file a link as a
  // note without it being fetched and analysed.
  const note = NOTE.exec(trimmed)
  if (note) {
    const body = trimmed.slice(note[0].length).trim()
    if (!body) return null
    return { kind: 'note', body, label: 'Evidence feed — note' }
  }

  const url = analyzableUrlFrom(trimmed)
  if (url) return { kind: 'url', body: trimmed, url, label: 'Evidence feed — fetch and analyse' }

  return { kind: 'note', body: trimmed, label: 'Evidence feed — note' }
}

/**
 * A title for a multi-line note.
 *
 * The first line, because that is how people write: the gist, then the detail.
 * The old bar took the first 50 characters of the whole thing, which cut the
 * gist in half and pulled the second line into the title.
 */
export function noteTitle(body: string, max = 80): string {
  const firstLine = body.split('\n').map(line => line.trim()).find(Boolean) ?? body
  if (firstLine.length <= max) return firstLine
  // Break on a word so the title does not end mid-syllable.
  const cut = firstLine.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * Where each kind of capture lands, by panel id.
 *
 * Kept beside the routing because the two must agree: a capture that posts to
 * the tasks endpoint has to send the analyst to the task board, and the way
 * those drift apart is by living in different files. The ids are the same ones
 * `CopPanelExpander` writes as `data-panel`.
 *
 * Notes and analysed links both land in the evidence feed, which is one panel —
 * that is the product's shape, not an oversight.
 */
export const PANEL_FOR_KIND: Record<CaptureKind, string> = {
  rfi: 'rfi',
  nai: 'map',
  task: 'tasks',
  timeline: 'timeline',
  hypothesis: 'analysis',
  survey: 'submissions',
  note: 'evidence',
  url: 'evidence',
}

/** What the jump link says. */
export const PANEL_LABEL_FOR_KIND: Record<CaptureKind, string> = {
  rfi: 'Key Questions & RFIs',
  nai: 'Map',
  task: 'Task Board',
  timeline: 'Timeline',
  hypothesis: 'Analysis & Hypotheses',
  survey: 'Submissions',
  note: 'Evidence feed',
  url: 'Evidence feed',
}

