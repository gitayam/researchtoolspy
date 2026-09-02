import type { CanonicalTwitterTarget } from './social-url'
import {
  SafeFetchError,
  resolvePublicHostname,
  safeFetchText,
  type HostnameResolver,
} from './safe-fetch'

const OEMBED_URL = 'https://publish.x.com/oembed'
const MAX_OEMBED_BYTES = 128 * 1024
const MAX_HTML_CHARS = 64 * 1024
const MAX_TEXT_CHARS = 10_000

export type TwitterProviderFailureCode =
  | 'invalid_target'
  | 'aborted'
  | 'timeout'
  | 'policy'
  | 'provider'
  | 'invalid_response'

export interface TwitterProviderResult {
  success: boolean
  metadata?: {
    text: string
    authorName: string
    authorHandle: string
    authorUrl: string
  }
  failure?: { stage: 'target' | 'oembed'; code: TwitterProviderFailureCode }
}

export interface TwitterProviderOptions {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  resolveHostname?: HostnameResolver
}

function validTarget(target: CanonicalTwitterTarget): boolean {
  return target?.platform === 'twitter'
    && /^[a-z0-9_]{1,15}$/.test(target.username)
    && /^[1-9][0-9]{0,19}$/.test(target.tweetId)
    && target.canonicalUrl === `https://x.com/${target.username}/status/${target.tweetId}`
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function boundedString(value: unknown, maximum: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum ? value : undefined
}

function decodeEntity(entity: string): string {
  const named: Record<string, string> = {
    amp: '&', apos: "'", gt: '>', lt: '<', mdash: '—', nbsp: ' ', quot: '"',
  }
  if (named[entity]) return named[entity]
  const numeric = entity.startsWith('#x') || entity.startsWith('#X')
    ? Number.parseInt(entity.slice(2), 16)
    : entity.startsWith('#') ? Number.parseInt(entity.slice(1), 10) : Number.NaN
  return Number.isInteger(numeric) && numeric > 0 && numeric <= 0x10ffff
    ? String.fromCodePoint(numeric)
    : `&${entity};`
}

function textFromOEmbedHtml(html: string): string | null {
  const paragraph = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/i.exec(html)?.[1]
  if (!paragraph) return null
  const text = paragraph
    .replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&([a-z]+|#[0-9]+|#x[0-9a-f]+);/gi, (_, entity: string) => decodeEntity(entity))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.length > 0 && text.length <= MAX_TEXT_CHARS ? text : null
}

function failure(error: unknown): TwitterProviderResult['failure'] {
  if (error instanceof SafeFetchError) {
    if (error.code === 'aborted') return { stage: 'oembed', code: 'aborted' }
    if (error.code === 'timeout') return { stage: 'oembed', code: 'timeout' }
    if (error.code === 'network_error') return { stage: 'oembed', code: 'provider' }
    if (error.code === 'unsupported_content_type') return { stage: 'oembed', code: 'invalid_response' }
    return { stage: 'oembed', code: 'policy' }
  }
  return { stage: 'oembed', code: 'invalid_response' }
}

/**
 * Fetches bounded public post metadata from X's first-party oEmbed endpoint.
 * Raw caller URLs, provider HTML, and provider-returned URLs are never emitted.
 */
export async function fetchTwitterProvider(
  target: CanonicalTwitterTarget,
  options: TwitterProviderOptions = {},
): Promise<TwitterProviderResult> {
  if (!validTarget(target)) {
    return { success: false, failure: { stage: 'target', code: 'invalid_target' } }
  }
  if (options.signal?.aborted) {
    return { success: false, failure: { stage: 'target', code: 'aborted' } }
  }
  const snapshot = Object.freeze({
    platform: 'twitter' as const,
    username: target.username,
    tweetId: target.tweetId,
    canonicalUrl: target.canonicalUrl,
  })
  const url = new URL(OEMBED_URL)
  url.searchParams.set('url', snapshot.canonicalUrl)
  url.searchParams.set('omit_script', 'true')
  url.searchParams.set('dnt', 'true')
  url.searchParams.set('hide_thread', 'true')

  try {
    const response = await safeFetchText(url, {
      allowedHostnames: ['publish.x.com'],
      allowedContentTypes: ['application/json', 'application/problem+json'],
      maxRedirects: 0,
      timeoutMs: 10_000,
      maxResponseBytes: MAX_OEMBED_BYTES,
      resolveHostname: options.resolveHostname ?? resolvePublicHostname,
      fetchImpl: options.fetchImpl ?? fetch,
      requestInit: { signal: options.signal, headers: { Accept: 'application/json' } },
    })
    if (!response.response.ok) {
      return { success: false, failure: { stage: 'oembed', code: 'provider' } }
    }
    let data: unknown
    try { data = JSON.parse(response.text) as unknown } catch {
      return { success: false, failure: { stage: 'oembed', code: 'invalid_response' } }
    }
    if (!record(data)) return { success: false, failure: { stage: 'oembed', code: 'invalid_response' } }
    const html = boundedString(data.html, MAX_HTML_CHARS)
    const authorName = boundedString(data.author_name, 256)
    const text = html ? textFromOEmbedHtml(html) : null
    if (!text || !authorName) {
      return { success: false, failure: { stage: 'oembed', code: 'invalid_response' } }
    }
    if (options.signal?.aborted) {
      return { success: false, failure: { stage: 'oembed', code: 'aborted' } }
    }
    return {
      success: true,
      metadata: {
        text,
        authorName,
        authorHandle: `@${snapshot.username}`,
        authorUrl: `https://x.com/${snapshot.username}`,
      },
    }
  } catch (error) {
    if (options.signal?.aborted) {
      return { success: false, failure: { stage: 'oembed', code: 'aborted' } }
    }
    return { success: false, failure: failure(error) }
  }
}
