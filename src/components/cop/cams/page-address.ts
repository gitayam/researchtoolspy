/**
 * The part of a pasted page link that a camera search may send: scheme, host and
 * path. Query strings and fragments often carry session ids or tracking tokens and
 * say nothing about the place, so they never leave the browser.
 */
export function pageAddressForSearch(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    url.search = ''
    url.hash = ''
    return url.href
  } catch {
    return null
  }
}
