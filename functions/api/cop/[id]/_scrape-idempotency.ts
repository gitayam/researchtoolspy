export interface ScrapeEvidenceIdentity {
  title: string
  content: string
  url: string
}

function canonicalSourceUrl(rawUrl: string): string | null {
  const value = rawUrl.trim()
  if (!value) return null

  try {
    const url = new URL(value)
    url.hash = ''
    url.hostname = url.hostname.toLowerCase()
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
      url.port = ''
    }
    return url.toString()
  } catch {
    return value
  }
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Build a stable, session-scoped identity for a scraped item.
 *
 * The source URL is preferred because polling the same run and encountering the
 * same post in a later run should be the same logical import. Items without a
 * URL fall back to their bounded title/content identity.
 */
export async function buildScrapeImportKey(
  sessionId: string,
  scraperType: string,
  item: ScrapeEvidenceIdentity,
): Promise<string> {
  const sourceIdentity = canonicalSourceUrl(item.url)
    ?? `${item.title.trim()}\n${item.content.trim()}`
  return `scrape:v1:${await sha256Hex(`${sessionId}\n${scraperType}\n${sourceIdentity}`)}`
}
