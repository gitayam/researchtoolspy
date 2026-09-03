import type { CanonicalTikTokTarget } from './social-url'
import {
  SafeFetchError,
  resolvePublicHostname,
  safeFetchText,
  type HostnameResolver,
} from './safe-fetch'

const OEMBED_URL = 'https://www.tiktok.com/oembed'

export type TikTokProviderFailureCode =
  | 'invalid_target'
  | 'aborted'
  | 'timeout'
  | 'policy'
  | 'provider'
  | 'invalid_response'

export interface TikTokProviderResult {
  success: boolean
  metadata?: {
    description: string
    authorName: string
    authorHandle: string
    authorUrl: string
  }
  failure?: { stage: 'target' | 'oembed'; code: TikTokProviderFailureCode }
}

export interface TikTokProviderOptions {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  resolveHostname?: HostnameResolver
}

function validTarget(target: CanonicalTikTokTarget): boolean {
  return target?.platform === 'tiktok'
    && /^[a-z0-9._]{1,24}$/.test(target.username)
    && /^[1-9][0-9]{0,19}$/.test(target.videoId)
    && target.canonicalUrl === `https://www.tiktok.com/@${target.username}/video/${target.videoId}`
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function boundedString(value: unknown, maximum: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum ? value : undefined
}

function failure(error: unknown): TikTokProviderResult['failure'] {
  if (error instanceof SafeFetchError) {
    if (error.code === 'aborted') return { stage: 'oembed', code: 'aborted' }
    if (error.code === 'timeout') return { stage: 'oembed', code: 'timeout' }
    if (error.code === 'network_error') return { stage: 'oembed', code: 'provider' }
    if (error.code === 'unsupported_content_type') return { stage: 'oembed', code: 'invalid_response' }
    return { stage: 'oembed', code: 'policy' }
  }
  return { stage: 'oembed', code: 'invalid_response' }
}

/** Fetch bounded metadata from TikTok's public first-party oEmbed endpoint. */
export async function fetchTikTokProvider(
  target: CanonicalTikTokTarget,
  options: TikTokProviderOptions = {},
): Promise<TikTokProviderResult> {
  if (!validTarget(target)) {
    return { success: false, failure: { stage: 'target', code: 'invalid_target' } }
  }
  if (options.signal?.aborted) {
    return { success: false, failure: { stage: 'target', code: 'aborted' } }
  }
  const snapshot = Object.freeze({
    username: target.username,
    videoId: target.videoId,
    canonicalUrl: target.canonicalUrl,
  })
  const url = new URL(OEMBED_URL)
  url.searchParams.set('url', snapshot.canonicalUrl)

  try {
    const response = await safeFetchText(url, {
      allowedHostnames: ['www.tiktok.com'],
      allowedContentTypes: ['application/json', 'application/problem+json'],
      maxRedirects: 0,
      timeoutMs: 10_000,
      maxResponseBytes: 128 * 1024,
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
    const description = boundedString(data.title, 4_096)
    const authorName = boundedString(data.author_name, 256)
    if (!description || !authorName) {
      return { success: false, failure: { stage: 'oembed', code: 'invalid_response' } }
    }
    if (options.signal?.aborted) {
      return { success: false, failure: { stage: 'oembed', code: 'aborted' } }
    }
    return {
      success: true,
      metadata: {
        description,
        authorName,
        authorHandle: `@${snapshot.username}`,
        authorUrl: `https://www.tiktok.com/@${snapshot.username}`,
      },
    }
  } catch (error) {
    if (options.signal?.aborted) {
      return { success: false, failure: { stage: 'oembed', code: 'aborted' } }
    }
    return { success: false, failure: failure(error) }
  }
}
