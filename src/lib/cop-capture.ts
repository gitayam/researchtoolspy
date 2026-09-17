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
 */

export type CaptureKind = 'rfi' | 'hypothesis' | 'survey' | 'url' | 'note'
export type RfiPriority = 'critical' | 'high' | 'medium'

export interface ParsedCapture {
  kind: CaptureKind
  /** The text after any prefix, which is what actually gets stored. */
  body: string
  /** What the bar tells the analyst before they commit. */
  label: string
  priority?: RfiPriority
  isBlocker?: boolean
  /** For `url`, the normalised address — a bare host gains its scheme. */
  url?: string
}

/** `rfi`, `rfi!`, `rfi!!` … then a colon. */
const RFI = /^rfi(!*)\s*:\s*/i
const HYPOTHESIS = /^(?:hypothesis|hyp|maybe)\s*:\s*/i
const SURVEY = /^(?:survey|form|drop)\s*:\s*/i
const NOTE = /^note\s*:\s*/i

function rfiPriority(bangs: number): { priority: RfiPriority; isBlocker: boolean } {
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
    const { priority, isBlocker } = rfiPriority(rfi[1].length)
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
