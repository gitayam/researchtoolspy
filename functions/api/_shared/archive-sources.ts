import { safeFetchText } from './safe-fetch'

const ARCHIVE_HTML_MAX_BYTES = 2 * 1024 * 1024
const ARCHIVE_METADATA_MAX_BYTES = 256 * 1024

export interface ArchiveHtmlSource {
  source: 'archive.ph' | 'wayback'
  html: string
  finalUrl: string
}

interface WaybackAvailability {
  archived_snapshots?: {
    closest?: { url?: unknown }
  }
}

export function validatedWaybackSnapshotUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const parsed = new URL(value)
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '')
    if (parsed.protocol !== 'https:' || hostname !== 'web.archive.org') return null
    if (!/^\/web\/\d{6,14}(?:[a-z_]+)?\//i.test(parsed.pathname)) return null
    return parsed.href
  } catch {
    return null
  }
}

export async function fetchArchivePhSource(
  targetUrl: string,
  signal?: AbortSignal,
): Promise<ArchiveHtmlSource | null> {
  const archived = await safeFetchText(`https://archive.ph/newest/${targetUrl}`, {
    timeoutMs: 10_000,
    maxRedirects: 5,
    maxResponseBytes: ARCHIVE_HTML_MAX_BYTES,
    allowedHostnames: ['archive.ph'],
    requestInit: { signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)' } },
  })
  if (!archived.response.ok) return null
  return { source: 'archive.ph', html: archived.text, finalUrl: archived.finalUrl }
}

export async function fetchWaybackSource(
  targetUrl: string,
  signal?: AbortSignal,
): Promise<ArchiveHtmlSource | null> {
  const availabilityUrl = new URL('https://archive.org/wayback/available')
  availabilityUrl.searchParams.set('url', targetUrl)
  const availability = await safeFetchText(availabilityUrl, {
    timeoutMs: 10_000,
    maxRedirects: 2,
    maxResponseBytes: ARCHIVE_METADATA_MAX_BYTES,
    allowedHostnames: ['archive.org'],
    allowedContentTypes: ['application/json'],
    requestInit: { signal },
  })
  if (!availability.response.ok) return null

  let parsed: WaybackAvailability
  try {
    parsed = JSON.parse(availability.text) as WaybackAvailability
  } catch {
    return null
  }
  const snapshotUrl = validatedWaybackSnapshotUrl(parsed.archived_snapshots?.closest?.url)
  if (!snapshotUrl) return null

  const archived = await safeFetchText(snapshotUrl, {
    timeoutMs: 10_000,
    maxRedirects: 2,
    maxResponseBytes: ARCHIVE_HTML_MAX_BYTES,
    allowedHostnames: ['web.archive.org'],
    requestInit: { signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)' } },
  })
  if (!archived.response.ok) return null
  return { source: 'wayback', html: archived.text, finalUrl: archived.finalUrl }
}
