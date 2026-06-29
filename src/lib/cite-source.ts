/**
 * cite-source — build a deep-link into the citation generator pre-filled from a
 * research submission (E-12).
 *
 * The citation generator (`/dashboard/tools/citations-generator`,
 * `CitationsGeneratorPage`) reads `url`, `title`, `siteName`, `sourceType`, ...
 * from `window.location.search` on mount and, given a `url`, kicks off its
 * `scrape-metadata` auto-fill. So a link carrying `?url=<encoded>&title=<encoded>`
 * is all the reviewer needs to hand a submission's source over to the citation tool.
 *
 * Pure + dependency-free so it can be unit-tested in plain Node.
 */

/** Route of the citation generator (no leading origin — used with the SPA router). */
export const CITATION_GENERATOR_PATH = '/dashboard/tools/citations-generator'

export interface CitationSource {
  /** The submission's source URL. Only http(s) URLs are usable. */
  url: string | null | undefined
  /** Optional human-readable title to pre-fill. */
  title?: string | null
}

/** True for a non-empty string that parses as an http(s) URL. */
function isUsableHttpUrl(url: string | null | undefined): url is string {
  if (typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed) return false
  try {
    const protocol = new URL(trimmed).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Build a relative citation-generator URL pre-filled from a submission.
 *
 * @returns `/dashboard/tools/citations-generator?url=<enc>[&title=<enc>]`, or
 *          `null` when there is no usable http(s) url.
 */
export function buildCitationGeneratorUrl({ url, title }: CitationSource): string | null {
  if (!isUsableHttpUrl(url)) return null

  const params = new URLSearchParams()
  params.set('url', url.trim())

  const cleanTitle = typeof title === 'string' ? title.trim() : ''
  if (cleanTitle) params.set('title', cleanTitle)

  return `${CITATION_GENERATOR_PATH}?${params.toString()}`
}
