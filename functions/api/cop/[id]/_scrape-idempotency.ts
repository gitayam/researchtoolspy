export interface ScrapeEvidenceIdentity {
  title: string
  content: string
  url: string
  providerItemId?: string | null
}

export interface ScrapeItemIdentity {
  itemKey: string
  providerItemId: string | null
  canonicalUrl: string | null
}

function normalizeProviderId(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized.slice(0, 500) : null
}

export function canonicalizeScrapeUrl(rawUrl: string, provider: string): string | null {
  const value = rawUrl.trim()
  if (!value) return null

  try {
    const url = new URL(value)
    url.hash = ''
    url.hostname = url.hostname.toLowerCase()
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
      url.port = ''
    }

    if (provider === 'twitter' && /^(?:www\.|mobile\.)?(?:twitter\.com|x\.com)$/.test(url.hostname)) {
      url.protocol = 'https:'
      url.hostname = 'x.com'
      url.port = ''
      const status = url.pathname.match(/\/status\/(\d+)/i)
      if (status) url.pathname = `/i/status/${status[1]}`
      url.search = ''
    } else if (provider === 'tiktok' && /^(?:www\.|m\.)?tiktok\.com$/.test(url.hostname)) {
      url.protocol = 'https:'
      url.hostname = 'www.tiktok.com'
      url.port = ''
      const video = url.pathname.match(/\/video\/(\d+)/i)
      if (video) url.pathname = `/video/${video[1]}`
      url.search = ''
    } else {
      for (const key of [...url.searchParams.keys()]) {
        if (/^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key)
      }
      url.searchParams.sort()
    }

    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '')
    return url.toString()
  } catch {
    return null
  }
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Prefer immutable provider IDs, then canonical platform URLs, then content.
 */
export async function buildScrapeItemIdentity(
  provider: string,
  item: ScrapeEvidenceIdentity,
): Promise<ScrapeItemIdentity> {
  const canonicalUrl = canonicalizeScrapeUrl(item.url, provider)
  let providerItemId = normalizeProviderId(item.providerItemId)

  if (!providerItemId && canonicalUrl) {
    const parsed = new URL(canonicalUrl)
    if (provider === 'twitter') providerItemId = parsed.pathname.match(/^\/i\/status\/(\d+)$/)?.[1] ?? null
    if (provider === 'tiktok') providerItemId = parsed.pathname.match(/^\/video\/(\d+)$/)?.[1] ?? null
  }

  const immutableIdentity = providerItemId
    ? `provider-id:${providerItemId}`
    : canonicalUrl
      ? `url:${canonicalUrl}`
      : `content:${item.title.trim()}\n${item.content.trim()}`

  return {
    itemKey: `scrape-item:v2:${await sha256Hex(`${provider}\n${immutableIdentity}`)}`,
    providerItemId,
    canonicalUrl,
  }
}
