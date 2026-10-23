/**
 * Key questions are starred RFIs.
 *
 * A COP's key questions used to be a plain list of strings on the session
 * (`key_questions`), separate from its RFIs, so they could not be answered or
 * tracked. The server now marks RFIs `is_key`; until every server does, a
 * question counts as key when its text matches one of the session's key
 * questions, and key questions with no RFI yet are listed as untracked.
 */

export interface QuestionLike {
  id?: string
  question: string
  /** Present (0/1 or boolean) once the server supports starred RFIs. */
  is_key?: number | boolean | null
}

/** Case, spacing and trailing punctuation don't make a different question. */
export function normalizeQuestion(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim().replace(/[\s?!.…]+$/u, '')
}

export interface SplitQuestions<T> {
  /** Starred RFIs, in their given order. */
  key: T[]
  /** The other RFIs. */
  others: T[]
  /** Key questions that no RFI tracks yet. */
  untracked: string[]
  /** True when the server reports `is_key` itself. */
  serverStars: boolean
}

export function splitKeyQuestions<T extends QuestionLike>(rfis: T[], keyQuestions: readonly string[] | null | undefined): SplitQuestions<T> {
  const serverStars = rfis.some((rfi) => rfi.is_key !== undefined && rfi.is_key !== null)
  const keySet = new Set((keyQuestions ?? []).filter((q) => typeof q === 'string' && q.trim()).map(normalizeQuestion))
  const isKey = (rfi: T) => (serverStars ? !!rfi.is_key && rfi.is_key !== 0 : keySet.has(normalizeQuestion(rfi.question)))

  const key: T[] = []
  const others: T[] = []
  for (const rfi of rfis) (isKey(rfi) ? key : others).push(rfi)

  const tracked = new Set(rfis.map((rfi) => normalizeQuestion(rfi.question)))
  const seen = new Set<string>()
  const untracked: string[] = []
  for (const q of keyQuestions ?? []) {
    if (typeof q !== 'string' || !q.trim()) continue
    const n = normalizeQuestion(q)
    if (tracked.has(n) || seen.has(n)) continue
    seen.add(n)
    untracked.push(q.trim())
  }
  return { key, others, untracked, serverStars }
}
