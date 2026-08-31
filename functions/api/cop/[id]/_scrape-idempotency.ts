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

function normalizeProviderId(value: unknown): string | null {
  // JSON numeric snowflakes may already have lost precision. Only an original
  // string is trustworthy; otherwise derive the immutable ID from an exact URL.
  if (typeof value !== 'string') return null
  const normalized = value.trim()
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

/** Canonicalize paid-request URLs without dropping provider-significant query keys. */
export function canonicalizeScrapeRequestUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    url.hash = ''
    url.hostname = url.hostname.toLowerCase()
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
      url.port = ''
    }
    if (/^(?:www\.|mobile\.)?twitter\.com$/.test(url.hostname)) url.hostname = 'x.com'
    if (/^(?:m\.)?tiktok\.com$/.test(url.hostname)) url.hostname = 'www.tiktok.com'
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key)
    }
    url.searchParams.sort()
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

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export async function buildScrapeRequestFingerprint(
  provider: string,
  actorInput: Record<string, unknown>,
): Promise<string> {
  return `scrape-request:v1:${await sha256Hex(`${provider}\n${stableJson(actorInput)}`)}`
}

export async function buildScrapeRequestId(
  sessionId: string,
  workspaceId: string,
  userId: number,
  fingerprint: string,
  idempotencyKey: string,
): Promise<string> {
  return `scrape-reservation:v1:${await sha256Hex(
    `${sessionId}\n${workspaceId}\n${userId}\n${fingerprint}\n${idempotencyKey}`,
  )}`
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
