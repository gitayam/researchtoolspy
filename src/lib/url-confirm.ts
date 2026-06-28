/**
 * Pure, dependency-free helpers for the public-form inline URL confirm card (E-5b).
 *
 * Browser-side counterpart to the endpoint's gate (functions/.../_preview-url.ts):
 * we only want to fire a preview request once the submitter has typed a complete
 * http(s) URL — not on every keystroke / partial input. Keep this tiny + testable.
 */

/**
 * True only for a non-empty, absolute http(s) URL. Used to decide whether to fire
 * a preview request for the value in a `url` field. Rejects empty/whitespace,
 * bare domains (no scheme), and non-http(s) schemes (ftp:, javascript:, etc.).
 */
export function isPreviewableUrl(raw: string): boolean {
  if (typeof raw !== 'string') return false
  const trimmed = raw.trim()
  if (!trimmed) return false
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return false
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:'
}

/**
 * Success shape returned by POST /api/surveys/public/:token/preview-url.
 * Mirrors the endpoint's `PreviewResponse` (the minimal confirm-card subset).
 */
export interface PreviewResult {
  ok: true
  url: string
  title?: string
  author?: string
  published_date?: string
  summary?: string
  excerpt?: string
  archive_url?: string
  duplicate: boolean
}
