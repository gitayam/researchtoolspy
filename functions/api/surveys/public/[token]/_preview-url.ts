/**
 * Pure, dependency-free helpers for the public token-scoped URL-preview endpoint (E-5a).
 *
 * No env, no fetch, no D1 — so it is unit-testable in plain Node. The endpoint
 * (`preview-url.ts`) composes these with SSRF checks (`isPrivateUrl`), the shared
 * rate-limit / token-resolution helpers, and the internal `analyze-url` call.
 *
 *  - validatePreviewUrl: gate the submitter-supplied string to a length-capped
 *    http(s) URL BEFORE any network call. SSRF (private-IP) rejection is layered
 *    on top in the endpoint via `isPrivateUrl`; this is the protocol/length gate.
 *  - shapePreview: map an `analyze-url` (quick mode) result down to the minimal
 *    confirm-card fields, tolerating missing fields, and NEVER leaking the raw
 *    analyze result or any submitter IP / user-agent.
 */

/** Max accepted URL length — generous for query strings, but bounded. */
export const MAX_PREVIEW_URL_LENGTH = 2048

export type ValidatePreviewUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

/**
 * Validate a submitter-supplied URL string: must be a non-empty string, an
 * absolute http(s) URL, and under the length cap. Returns the parsed/normalized
 * href on success. Does NOT check for private/SSRF targets — the endpoint applies
 * `isPrivateUrl` on the returned url for that.
 */
export function validatePreviewUrl(raw: unknown): ValidatePreviewUrlResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'A URL string is required' }
  }
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, error: 'A URL is required' }
  }
  if (trimmed.length > MAX_PREVIEW_URL_LENGTH) {
    return { ok: false, error: `URL too long (max ${MAX_PREVIEW_URL_LENGTH} chars)` }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, error: 'Invalid URL' }
  }

  // http(s) only — blocks javascript:, data:, ftp:, file:, etc.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http(s) URLs are allowed' }
  }

  return { ok: true, url: parsed.href }
}

/**
 * The minimal "confirm card" shape returned to a public submitter. Deliberately
 * a tiny subset of the analyze-url response — no extracted_text, no entities, no
 * IP/user-agent, no internal ids.
 */
export interface PreviewResponse {
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

/** Coerce a possibly-missing value to a trimmed non-empty string, else undefined. */
function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const t = value.trim()
  return t ? t : undefined
}

/**
 * Map an analyze-url (quick mode) result into the minimal confirm-card shape.
 * Tolerates a null/partial result — returns undefined for any missing field
 * rather than throwing. `duplicate` and `archiveUrl` are supplied by the endpoint
 * (the endpoint computes dedup against survey_responses and picks an archive link).
 */
export function shapePreview(
  analyzeResult: Record<string, unknown> | null | undefined,
  opts: { duplicate: boolean; archiveUrl?: string }
): PreviewResponse {
  const r = analyzeResult ?? {}

  const summary = str(r.summary)
  // analyze-url quick mode returns `publish_date`; tolerate `published_date` too.
  const publishedDate = str(r.publish_date) ?? str(r.published_date)
  // Build an excerpt from extracted_text if present (capped), else fall back to summary.
  const extracted = str(r.extracted_text)
  const excerpt = extracted ? extracted.slice(0, 500) : summary

  const out: PreviewResponse = {
    ok: true,
    url: str(r.url) ?? str(opts.archiveUrl) ?? '',
    duplicate: !!opts.duplicate,
  }

  const title = str(r.title)
  if (title) out.title = title
  const author = str(r.author)
  if (author) out.author = author
  if (publishedDate) out.published_date = publishedDate
  if (summary) out.summary = summary
  if (excerpt) out.excerpt = excerpt
  if (opts.archiveUrl) out.archive_url = opts.archiveUrl

  return out
}
