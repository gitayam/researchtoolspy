/**
 * Treats the search box as a URL when it plausibly is one, so a pasted link becomes an
 * offer to analyse rather than a search that can only fail. Accepts a bare host and adds
 * the scheme, because people paste `example.com/story` far more often than a full URL.
 */
export function analyzableUrlFrom(query: string): string | null {
  const text = query.trim()
  if (!text || /\s/.test(text)) return null
  const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`
  let parsed: URL
  try { parsed = new URL(candidate) } catch { return null }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  // A hostname with a dot and no spaces is the cheap test that keeps ordinary
  // searches ("kirk family") from being offered as links.
  if (!parsed.hostname.includes('.') || parsed.hostname.endsWith('.')) return null
  return parsed.toString()
}
