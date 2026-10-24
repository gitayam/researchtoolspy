/**
 * The pure parts of copying questions on a public COP share (QuestionCopy.tsx), so
 * visitors can paste them into a search:
 *   - the text one question's Copy puts on the clipboard,
 *   - the open questions as "Copy all" formats them,
 *   - copying with the Clipboard API, then a fallback, without ever throwing,
 *   - what to tell the visitor when it worked and when it didn't.
 */
import { normalizeQuestion } from './key-questions'

/** The question as written, trimmed: no star, priority or status. */
export function questionCopyText(question: unknown): string {
  return typeof question === 'string' ? question.trim() : ''
}

/** Line breaks, tabs and runs of spaces become one space. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

interface StatusQuestion {
  question: string
  status?: string | null
}

export interface QuestionGroups {
  /** Starred RFIs, in list order. */
  key: readonly StatusQuestion[]
  /** Key questions no RFI tracks yet (nobody has answered them, so they count as open). */
  untracked?: readonly string[]
  /** The other RFIs, in list order. */
  others: readonly StatusQuestion[]
}

/**
 * The open questions in the order the list shows them (key ones, untracked key ones,
 * the others), each on one line, without blanks or repeats.
 */
export function openQuestionLines({ key, untracked = [], others }: QuestionGroups): string[] {
  const open = (q: StatusQuestion) => q.status === 'open'
  const candidates = [...key.filter(open).map((q) => q.question), ...untracked, ...others.filter(open).map((q) => q.question)]
  const seen = new Set<string>()
  const lines: string[] = []
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const line = oneLine(candidate)
    const id = normalizeQuestion(line)
    if (!line || seen.has(id)) continue
    seen.add(id)
    lines.push(line)
  }
  return lines
}

/** "Copy all": "Open questions — <COP name>", then "1. …" per question. Empty when there are none. */
export function formatOpenQuestions(copName: string | null | undefined, lines: readonly string[]): string {
  if (lines.length === 0) return ''
  const name = typeof copName === 'string' ? oneLine(copName) : ''
  const header = name ? `Open questions — ${name}` : 'Open questions'
  return [header, ...lines.map((line, i) => `${i + 1}. ${line}`)].join('\n')
}

// ── Copying ──────────────────────────────────────────────────────

export interface ClipboardEnv {
  /** navigator.clipboard; missing outside a secure context. */
  clipboard?: { writeText?: (text: string) => Promise<void> } | null
  /** The textarea + execCommand('copy') fallback; true when the browser says it copied. */
  legacyCopy?: ((text: string) => boolean) | null
}

/**
 * Copies `text`: the Clipboard API first, then the fallback (a refused permission, an
 * insecure context, an old browser). False when neither worked; never throws.
 */
export async function copyText(text: string, env: ClipboardEnv): Promise<boolean> {
  if (!text) return false
  const writeText = env.clipboard?.writeText
  if (typeof writeText === 'function') {
    try {
      await writeText.call(env.clipboard, text)
      return true
    } catch {
      // Refused or unavailable: try the fallback.
    }
  }
  try {
    return env.legacyCopy?.(text) === true
  } catch {
    return false
  }
}

/** How to copy by hand once the text is selected. */
export function copyHint({ coarsePointer, apple }: { coarsePointer: boolean; apple: boolean }): string {
  if (coarsePointer) return 'Press and hold to copy.'
  return apple ? 'Press ⌘C to copy.' : 'Press Ctrl+C to copy.'
}

export const COPY_FAILED = "Couldn't copy automatically."

/** What the live region says after a copy. */
export function copyNotice({ what, ok, count = 0, hint }: { what: 'question' | 'all'; ok: boolean; count?: number; hint: string }): string {
  if (ok) return what === 'question' ? 'Question copied.' : `Copied ${count} open question${count === 1 ? '' : 's'}.`
  return what === 'question'
    ? `${COPY_FAILED} The question is selected. ${hint}`
    : `${COPY_FAILED} The questions are selected in a text box. ${hint}`
}
