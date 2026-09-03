import { parseCanonicalBlueskyUrl, type CanonicalBlueskyTarget } from './social-url'
import {
  SafeFetchError,
  resolvePublicHostname,
  safeFetchText,
  type HostnameResolver,
} from './safe-fetch'

const POST_THREAD_URL = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread'

export type BlueskyProviderFailureCode =
  | 'invalid_target'
  | 'aborted'
  | 'timeout'
  | 'policy'
  | 'provider'
  | 'invalid_response'

export interface BlueskyProviderResult {
  success: boolean
  metadata?: {
    text: string
    createdAt: string
    authorName: string
    authorHandle: string
    authorDid: string
    authorUrl: string
    postUri: string
    replyCount: number
    repostCount: number
    likeCount: number
    quoteCount: number
    hasMedia: boolean
    mediaCount: number
    postType: 'post' | 'reply' | 'quote'
  }
  failure?: { stage: 'target' | 'post'; code: BlueskyProviderFailureCode }
}

export interface BlueskyProviderOptions {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  resolveHostname?: HostnameResolver
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function boundedString(value: unknown, maximum: number, allowEmpty = false): string | undefined {
  return typeof value === 'string'
    && value.length <= maximum
    && (allowEmpty || value.length > 0)
    ? value
    : undefined
}

function boundedCount(value: unknown): number | null {
  if (value === undefined) return 0
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    ? value
    : null
}

function mediaCount(embed: unknown): number | null {
  if (embed === undefined) return 0
  if (!record(embed) || typeof embed.$type !== 'string') return null
  if (embed.$type === 'app.bsky.embed.external#view' || embed.$type === 'app.bsky.embed.record#view') return 0
  if (embed.$type === 'app.bsky.embed.video#view') return 1
  if (embed.$type === 'app.bsky.embed.images#view') {
    return Array.isArray(embed.images) && embed.images.length >= 1 && embed.images.length <= 4
      && embed.images.every(record)
      ? embed.images.length
      : null
  }
  if (embed.$type === 'app.bsky.embed.gallery#view') {
    return Array.isArray(embed.items) && embed.items.length >= 1 && embed.items.length <= 10
      && embed.items.every(record)
      ? embed.items.length
      : null
  }
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    if (!record(embed.media)) return null
    return mediaCount(embed.media)
  }
  return null
}

function failure(error: unknown): BlueskyProviderResult['failure'] {
  if (error instanceof SafeFetchError) {
    if (error.code === 'aborted') return { stage: 'post', code: 'aborted' }
    if (error.code === 'timeout') return { stage: 'post', code: 'timeout' }
    if (error.code === 'network_error') return { stage: 'post', code: 'provider' }
    if (error.code === 'unsupported_content_type') return { stage: 'post', code: 'invalid_response' }
    return { stage: 'post', code: 'policy' }
  }
  return { stage: 'post', code: 'invalid_response' }
}

function validTarget(target: CanonicalBlueskyTarget): boolean {
  const parsed = parseCanonicalBlueskyUrl(target?.atUri)
  return Boolean(parsed)
    && parsed?.platform === target.platform
    && parsed.actor === target.actor
    && parsed.actorKind === target.actorKind
    && parsed.rkey === target.rkey
    && parsed.atUri === target.atUri
    && parsed.canonicalUrl === target.canonicalUrl
}

/** Fetch one bounded public Bluesky post view without returning provider URLs. */
export async function fetchBlueskyProvider(
  target: CanonicalBlueskyTarget,
  options: BlueskyProviderOptions = {},
): Promise<BlueskyProviderResult> {
  if (!validTarget(target)) return { success: false, failure: { stage: 'target', code: 'invalid_target' } }
  if (options.signal?.aborted) return { success: false, failure: { stage: 'target', code: 'aborted' } }
  const snapshot = Object.freeze({
    actor: target.actor,
    actorKind: target.actorKind,
    rkey: target.rkey,
    atUri: target.atUri,
  })
  const url = new URL(POST_THREAD_URL)
  url.searchParams.set('uri', snapshot.atUri)
  url.searchParams.set('depth', '0')
  url.searchParams.set('parentHeight', '0')

  try {
    const response = await safeFetchText(url, {
      allowedHostnames: ['public.api.bsky.app'],
      allowedContentTypes: ['application/json', 'application/problem+json'],
      maxRedirects: 0,
      timeoutMs: 10_000,
      maxResponseBytes: 256 * 1024,
      resolveHostname: options.resolveHostname ?? resolvePublicHostname,
      fetchImpl: options.fetchImpl ?? fetch,
      requestInit: { signal: options.signal, headers: { Accept: 'application/json' } },
    })
    if (!response.response.ok) return { success: false, failure: { stage: 'post', code: 'provider' } }
    let data: unknown
    try { data = JSON.parse(response.text) as unknown } catch {
      return { success: false, failure: { stage: 'post', code: 'invalid_response' } }
    }
    if (!record(data) || !record(data.thread) || !record(data.thread.post)) {
      return { success: false, failure: { stage: 'post', code: 'invalid_response' } }
    }
    const post = data.thread.post
    if (!record(post.author) || !record(post.record)) {
      return { success: false, failure: { stage: 'post', code: 'invalid_response' } }
    }
    const postUri = boundedString(post.uri, 2_048)
    const resolvedTarget = postUri ? parseCanonicalBlueskyUrl(postUri) : null
    const authorDid = boundedString(post.author.did, 2_048)
    const authorHandle = boundedString(post.author.handle, 253)?.toLowerCase()
    const authorTarget = authorDid
      ? parseCanonicalBlueskyUrl(`at://${authorDid}/app.bsky.feed.post/${snapshot.rkey}`)
      : null
    const handleTarget = authorHandle
      ? parseCanonicalBlueskyUrl(`at://${authorHandle}/app.bsky.feed.post/${snapshot.rkey}`)
      : null
    const identityMatches = resolvedTarget?.actorKind === 'did'
      && resolvedTarget.rkey === snapshot.rkey
      && authorTarget?.actor === resolvedTarget.actor
      && handleTarget?.actorKind === 'handle'
      && (snapshot.actorKind === 'did'
        ? resolvedTarget.actor === snapshot.actor
        : authorHandle === snapshot.actor)
    const text = boundedString(post.record.text, 3_000, true)
    const createdAt = boundedString(post.record.createdAt, 64)
    const authorName = boundedString(post.author.displayName, 640) ?? authorHandle
    const replyCount = boundedCount(post.replyCount)
    const repostCount = boundedCount(post.repostCount)
    const likeCount = boundedCount(post.likeCount)
    const quoteCount = boundedCount(post.quoteCount)
    const countedMedia = mediaCount(post.embed)
    if (!identityMatches || post.record.$type !== 'app.bsky.feed.post'
      || text === undefined || !createdAt || !Number.isFinite(Date.parse(createdAt))
      || !authorName || !authorHandle || !authorDid
      || replyCount === null || repostCount === null || likeCount === null || quoteCount === null
      || countedMedia === null) {
      return { success: false, failure: { stage: 'post', code: 'invalid_response' } }
    }
    if (options.signal?.aborted) return { success: false, failure: { stage: 'post', code: 'aborted' } }
    const embedType = record(post.embed) ? post.embed.$type : undefined
    return {
      success: true,
      metadata: {
        text,
        createdAt,
        authorName,
        authorHandle: `@${authorHandle}`,
        authorDid,
        authorUrl: `https://bsky.app/profile/${authorHandle}`,
        postUri,
        replyCount,
        repostCount,
        likeCount,
        quoteCount,
        hasMedia: countedMedia > 0,
        mediaCount: countedMedia,
        postType: record(post.record.reply)
          ? 'reply'
          : embedType === 'app.bsky.embed.record#view' || embedType === 'app.bsky.embed.recordWithMedia#view'
            ? 'quote'
            : 'post',
      },
    }
  } catch (error) {
    if (options.signal?.aborted) return { success: false, failure: { stage: 'post', code: 'aborted' } }
    return { success: false, failure: failure(error) }
  }
}
