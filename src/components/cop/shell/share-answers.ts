/**
 * The pure parts of answering a question on a public COP share (AnswerSheet):
 *   - which questions get the quick Yes / No / Partly / Not sure choices,
 *   - the text a choice and the details turn into,
 *   - which question to offer next after an answer is sent,
 *   - the per-question draft kept in sessionStorage,
 *   - what to tell the visitor when sending fails.
 */

export const QUICK_CHOICES = ['Yes', 'No', 'Partly', 'Not sure'] as const
export type QuickChoice = (typeof QUICK_CHOICES)[number]

// English auxiliaries that open a yes/no question, with their negative contractions
// ("Isn't", "Didn't", "Won't", "Can't"); a whole word, so "Isolated", "Canada" or
// "Willow" don't count.
const YES_NO_OPENING =
  /^(?:(?:is|are|was|were|did|does|do|has|have|had|could|would|should)(?:n['’]?t)?|can(?:not|['’]t)?|will|won['’]t)(?![\p{L}\p{N}_])/iu

/** True when a question reads as yes/no: it starts with Is, Are, Was, … Should (any case). */
export function isYesNoQuestion(text: string | null | undefined): boolean {
  if (typeof text !== 'string') return false
  // Opening quotes, brackets or list marks don't change the question.
  const start = text.trim().replace(/^[\s"'“‘«([*•–—-]+/u, '')
  return YES_NO_OPENING.test(start)
}

export function isQuickChoice(value: unknown): value is QuickChoice {
  return typeof value === 'string' && (QUICK_CHOICES as readonly string[]).includes(value)
}

/** The answer as sent: the choice first ("Yes — details"), or just the details. */
export function composeAnswerText(choice: QuickChoice | null, details: string): string {
  const text = details.trim()
  if (!choice) return text
  return text ? `${choice} — ${text}` : choice
}

// ── The next question ────────────────────────────────────────────

export interface NextQuestionCandidate {
  id: string
  status: string
  isKey: boolean
  answerCount: number
}

/** Whether a share visitor may still answer a question (the server takes answers until it's closed or accepted). */
export function takesAnswers(status: string): boolean {
  return status !== 'closed' && status !== 'accepted'
}

/**
 * The question to offer after answering `currentId`: open questions before ones that
 * already have an answer, key questions first, then the fewest answers, then list
 * order. Never `currentId`; null when nothing else takes answers.
 */
export function pickNextQuestion<T extends NextQuestionCandidate>(questions: readonly T[], currentId: string | null): T | null {
  let best: T | null = null
  let bestRank: number[] = []
  for (let index = 0; index < questions.length; index++) {
    const q = questions[index]
    if (q.id === currentId || !takesAnswers(q.status)) continue
    const rank = [q.status === 'open' ? 0 : 1, q.isKey ? 0 : 1, Math.max(0, q.answerCount || 0), index]
    if (!best || compareRanks(rank, bestRank) < 0) {
      best = q
      bestRank = rank
    }
  }
  return best
}

function compareRanks(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

// ── Drafts ───────────────────────────────────────────────────────

export interface AnswerDraft {
  choice: QuickChoice | null
  details: string
  source: string
}

export const EMPTY_DRAFT: AnswerDraft = { choice: null, details: '', source: '' }

/** Limits matching the answer API (answer 4000, link 2000, name 100). */
export const DETAILS_MAX = 3900
export const SOURCE_MAX = 2000
export const NAME_MAX = 100

type ReadStore = Pick<Storage, 'getItem'>
type WriteStore = Pick<Storage, 'setItem' | 'removeItem'>

/** One draft per question (RFI ids are unique across COPs). No share token in the key. */
export function answerDraftKey(rfiId: string): string {
  return `rt:cop-answer-draft:v1:${rfiId}`
}

/** The visitor's name, typed once and offered again for the next answer in this tab. */
export const ANSWER_NAME_KEY = 'rt:cop-answer-name:v1'

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '')

export function isEmptyDraft(draft: AnswerDraft): boolean {
  return !draft.choice && !draft.details.trim() && !draft.source.trim()
}

/** The saved draft for a question; an empty one when there is none, it's unreadable, or storage is off. */
export function readAnswerDraft(store: ReadStore | null | undefined, rfiId: string): AnswerDraft {
  try {
    const raw = store?.getItem(answerDraftKey(rfiId))
    if (!raw) return { ...EMPTY_DRAFT }
    const parsed = JSON.parse(raw) as Record<string, unknown> | null
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY_DRAFT }
    return {
      choice: isQuickChoice(parsed.choice) ? parsed.choice : null,
      details: text(parsed.details, DETAILS_MAX),
      source: text(parsed.source, SOURCE_MAX),
    }
  } catch {
    return { ...EMPTY_DRAFT }
  }
}

/** Saves the draft (an empty one removes it). Storage that is full or blocked is ignored. */
export function writeAnswerDraft(store: WriteStore | null | undefined, rfiId: string, draft: AnswerDraft): void {
  try {
    if (!store) return
    if (isEmptyDraft(draft)) store.removeItem(answerDraftKey(rfiId))
    else store.setItem(answerDraftKey(rfiId), JSON.stringify({ choice: draft.choice, details: draft.details, source: draft.source }))
  } catch {
    // A draft that can't be kept only lasts while the sheet is open.
  }
}

export function clearAnswerDraft(store: WriteStore | null | undefined, rfiId: string): void {
  try {
    store?.removeItem(answerDraftKey(rfiId))
  } catch {
    // Nothing to clear.
  }
}

export function readAnswerName(store: ReadStore | null | undefined): string {
  try {
    return text(store?.getItem(ANSWER_NAME_KEY), NAME_MAX)
  } catch {
    return ''
  }
}

export function writeAnswerName(store: WriteStore | null | undefined, name: string): void {
  try {
    if (!store) return
    if (name.trim()) store.setItem(ANSWER_NAME_KEY, name.slice(0, NAME_MAX))
    else store.removeItem(ANSWER_NAME_KEY)
  } catch {
    // Not kept; the visitor types it again.
  }
}

/** window.sessionStorage, or null where reading it throws (blocked storage, sandboxed frames). */
export function sessionStore(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

// ── Checks and errors ────────────────────────────────────────────

/** A source link the answer API takes: empty, or an http(s) URL. */
export function isValidSourceLink(value: string): boolean {
  const raw = value.trim()
  if (!raw) return true
  if (raw.length > SOURCE_MAX) return false
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export const RATE_LIMITED_MESSAGE = 'Too many answers on this link right now. Try again later.'

/**
 * What to tell the visitor when sending fails. `status` is null when no response came
 * back (offline, or the connection dropped, so it may or may not have arrived).
 * `serverError` is the API's own message, shown for a refused answer (400).
 */
export function answerErrorMessage(status: number | null, serverError?: string | null): string {
  if (status === null) {
    return 'Not sent: no response from the server. Check your connection and send again. If it went through, it will show under the question.'
  }
  if (status === 429) return RATE_LIMITED_MESSAGE
  if (status === 400) {
    const reason = typeof serverError === 'string' && serverError.trim() ? serverError.trim().slice(0, 200) : 'the answer was refused'
    return `Not sent: ${reason.replace(/[.\s]+$/u, '')}.`
  }
  if (status === 403) return 'Not sent: this link no longer takes answers.'
  if (status === 404) return 'Not sent: this question is no longer on this link.'
  if (status === 410) return 'Not sent: this COP is no longer taking answers.'
  if (status === 503) return 'Not sent: answers are unavailable right now. Try again in a minute.'
  return `Not sent: the server couldn't save it (error ${status}). Try again.`
}
