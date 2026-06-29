/**
 * deep-scrape — hand a submission's source URL to the Content Intelligence tool
 * for a FULL `analyze-url` run (E-15).
 *
 * Intake auto-enriches submitted URLs with `analyze-url` *quick mode*. To get the
 * heavyweight analysis (entities / claims / summary / archive) the reviewer hands
 * the URL to `ContentIntelligencePage`, which on mount reads
 * `localStorage.getItem('pending_url_analysis')`, populates its input, and
 * auto-clicks analyze. So the reviewer only has to set that key and navigate to
 * the page — no new endpoint, no change to the content-intelligence page.
 *
 * Pure + dependency-free so it can be unit-tested in plain Node.
 */

/** localStorage key the Content Intelligence page reads on mount to auto-analyze. */
export const PENDING_URL_ANALYSIS_KEY = 'pending_url_analysis'

/** Route of the Content Intelligence tool (no leading origin — SPA router path). */
export const CONTENT_INTEL_ROUTE = '/dashboard/tools/content-intelligence'

/**
 * True only for a non-empty string that parses as an http(s) URL.
 *
 * A bare domain (`x.com`) fails because `new URL()` needs a protocol; non-http
 * schemes (`ftp:`, `javascript:`) are rejected so we never hand the tool an
 * un-fetchable or unsafe URL.
 */
export function canDeepScrape(url: string | null | undefined): boolean {
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
