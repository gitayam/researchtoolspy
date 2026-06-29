/**
 * Client-side text search/filter for the submissions Review tab (E-9a).
 *
 * Pure, dependency-free helpers so they can be unit-tested without a browser
 * or a running server. The Review tab already applies a SERVER-side `statusFilter`;
 * this layers a case-insensitive substring search on top of the loaded
 * (≤500) submissions across the human-meaningful text fields.
 *
 * NOTE: this is intentionally client-side over the already-loaded set. If the
 * 500-row list cap is ever hit in practice, search should move server-side
 * (add a `q` param to /api/research/submissions/list) — see E-9a follow-up.
 */

/** The subset of submission fields this search reads. Kept structural so the
 *  page's richer `Submission` type satisfies it without an import cycle. */
export interface SearchableSubmission {
  source_url?: string | null
  content_description?: string | null
  submitter_name?: string | null
  metadata?: { title?: string | null } | null
}

/**
 * Does `sub` match the free-text `term`?
 *
 * - Empty / whitespace-only term → `true` (matches everything; no filtering).
 * - Otherwise: case-insensitive substring match across `source_url`,
 *   the description (`content_description`) and `metadata.title`, and
 *   `submitter_name`. Null/undefined fields are guarded and never throw.
 */
export function matchesSubmissionSearch(sub: SearchableSubmission, term: string): boolean {
  const needle = term.trim().toLowerCase()
  if (needle === '') return true

  const haystack = [
    sub.source_url,
    sub.content_description,
    sub.metadata?.title,
    sub.submitter_name,
  ]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' ')
    .toLowerCase()

  return haystack.includes(needle)
}

/** Filter an array of submissions by the free-text `term`. */
export function filterSubmissions<T extends SearchableSubmission>(subs: T[], term: string): T[] {
  return subs.filter((s) => matchesSubmissionSearch(s, term))
}
