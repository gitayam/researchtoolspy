import type { CanonicalYouTubeTarget } from './social-url'
import {
  SafeFetchError,
  assertSafeOutboundUrl,
  resolvePublicHostname,
  safeFetchText,
  type HostnameResolver,
} from './safe-fetch'

const YOUTUBE_ORIGIN = 'https://www.youtube.com'
const OEMBED_URL = `${YOUTUBE_ORIGIN}/oembed`
const INNERTUBE_URL = `${YOUTUBE_ORIGIN}/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8`
const COBALT_URL = 'https://co.wuk.sh/api/json'
const MAX_CHAIN_MS = 30_000
const MAX_TRANSCRIPT_CHARS = 200_000

export type YouTubeProviderStage = 'target' | 'oembed' | 'innertube' | 'caption' | 'cobalt'
export type YouTubeProviderFailureCode =
  | 'invalid_target'
  | 'aborted'
  | 'deadline'
  | 'policy'
  | 'provider'
  | 'invalid_response'
  | 'unavailable'

export interface YouTubeProviderFailure {
  stage: YouTubeProviderStage
  code: YouTubeProviderFailureCode
}

export interface YouTubeOEmbedMetadata {
  title: string
  authorName: string
  authorUrl?: string
  thumbnailUrl?: string
  thumbnailWidth?: number
  thumbnailHeight?: number
}

export interface YouTubeProviderDeadline {
  readonly expiresAt: number
  readonly signal?: AbortSignal
}

export interface YouTubeProviderOptions {
  includeTranscript?: boolean
  includeMedia?: boolean
  preferredLanguage?: string
  deadline?: YouTubeProviderDeadline
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  resolveHostname?: HostnameResolver
}

export interface YouTubeProviderResult {
  success: boolean
  metadata?: YouTubeOEmbedMetadata
  transcript?: string
  mediaUrl?: string
  failure?: YouTubeProviderFailure
  transcriptFailure?: YouTubeProviderFailure
  mediaFailure?: YouTubeProviderFailure
}

interface ProviderContext {
  deadline: YouTubeProviderDeadline
  fetchImpl: typeof fetch
  resolveHostname: HostnameResolver
}

interface OperationSignal {
  signal: AbortSignal
  cleanup(): void
}

interface CombinedDeadline {
  deadline: YouTubeProviderDeadline
  cleanup(): void
}

interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind?: string
}

/** Create a reusable absolute deadline. Every provider chain is capped at 30 seconds. */
export function createYouTubeProviderDeadline(
  timeoutMs: number = MAX_CHAIN_MS,
  signal?: AbortSignal,
): YouTubeProviderDeadline {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_CHAIN_MS) {
    throw new SafeFetchError('invalid_options', 'YouTube provider timeout must be between 1 and 30000 milliseconds')
  }
  return { expiresAt: Date.now() + timeoutMs, signal }
}

function validTarget(target: CanonicalYouTubeTarget): boolean {
  return target?.platform === 'youtube'
    && /^[A-Za-z0-9_-]{11}$/.test(target.videoId)
    && target.canonicalUrl === `https://www.youtube.com/watch?v=${target.videoId}`
}

function remainingMs(deadline: YouTubeProviderDeadline, maximum: number): number {
  if (deadline.signal?.aborted) {
    throw new SafeFetchError('aborted', 'YouTube provider chain was aborted by its caller')
  }
  const remaining = Math.floor(deadline.expiresAt - Date.now())
  if (!Number.isFinite(deadline.expiresAt) || remaining < 1) {
    throw new SafeFetchError('timeout', 'YouTube provider chain deadline expired')
  }
  if (remaining > MAX_CHAIN_MS) {
    throw new SafeFetchError('invalid_options', 'YouTube provider deadline cannot exceed 30 seconds')
  }
  return Math.min(remaining, maximum)
}

function operationSignal(deadline: YouTubeProviderDeadline, maximum: number): OperationSignal {
  const controller = new AbortController()
  const timeoutMs = remainingMs(deadline, maximum)
  const abortFromCaller = () => controller.abort(deadline.signal?.reason)
  deadline.signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeoutId = setTimeout(() => controller.abort(new Error('YouTube provider operation timed out')), timeoutMs)
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeoutId)
      deadline.signal?.removeEventListener('abort', abortFromCaller)
    },
  }
}

function combineDeadlineSignal(deadline: YouTubeProviderDeadline, signal: AbortSignal | undefined): CombinedDeadline {
  if (!signal || deadline.signal === signal) return { deadline, cleanup() {} }
  const controller = new AbortController()
  const abortFromDeadline = () => controller.abort(deadline.signal?.reason)
  const abortFromCaller = () => controller.abort(signal.reason)
  if (deadline.signal?.aborted) abortFromDeadline()
  else deadline.signal?.addEventListener('abort', abortFromDeadline, { once: true })
  if (signal.aborted) abortFromCaller()
  else signal.addEventListener('abort', abortFromCaller, { once: true })
  return {
    deadline: { expiresAt: deadline.expiresAt, signal: controller.signal },
    cleanup() {
      deadline.signal?.removeEventListener('abort', abortFromDeadline)
      signal.removeEventListener('abort', abortFromCaller)
    },
  }
}

async function cancelBody(response: Response, reason: string): Promise<void> {
  if (!response.body) return
  try { await response.body.cancel(reason) } catch { /* policy failure wins */ }
}

function jsonMime(response: Response): boolean {
  const mime = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  return mime === 'application/json' || mime === 'application/problem+json'
}

async function readBoundedPostJson(
  url: typeof INNERTUBE_URL | typeof COBALT_URL,
  body: string,
  maxBytes: number,
  timeoutMs: number,
  context: ProviderContext,
): Promise<unknown> {
  const operation = operationSignal(context.deadline, timeoutMs)
  let response: Response | undefined
  try {
    await assertSafeOutboundUrl(url, operation.signal, context.resolveHostname)
    response = await context.fetchImpl(url, {
      method: 'POST',
      redirect: 'manual',
      signal: operation.signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body,
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await cancelBody(response, 'provider redirect rejected')
      throw new SafeFetchError('redirect_limit', 'Fixed provider redirects are not allowed')
    }
    if (!response.ok) {
      await cancelBody(response, 'provider error response discarded')
      throw new SafeFetchError('network_error', 'Fixed provider returned an error response')
    }
    if (!jsonMime(response)) {
      await cancelBody(response, 'provider MIME rejected')
      throw new SafeFetchError('unsupported_content_type', 'Fixed provider success response must be JSON')
    }
    const declared = response.headers.get('content-length')
    if (declared !== null && Number.isFinite(Number(declared)) && Number(declared) > maxBytes) {
      await cancelBody(response, 'provider declared size rejected')
      throw new SafeFetchError('response_too_large', 'Fixed provider response exceeded its byte limit')
    }
    if (!response.body) throw new SafeFetchError('unsupported_content_type', 'Fixed provider returned no JSON body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let text = ''
    let bytes = 0
    const aborted = new Promise<never>((_, reject) => {
      operation.signal.addEventListener('abort', () => reject(operation.signal.reason), { once: true })
    })
    try {
      while (true) {
        const chunk = await Promise.race([reader.read(), aborted])
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > maxBytes) {
          await reader.cancel('provider streamed size rejected')
          throw new SafeFetchError('response_too_large', 'Fixed provider response exceeded its byte limit')
        }
        text += decoder.decode(chunk.value, { stream: true })
      }
      text += decoder.decode()
    } catch (error) {
      try { await reader.cancel('provider response read failed') } catch { /* original failure wins */ }
      if (operation.signal.aborted) {
        throw new SafeFetchError(context.deadline.signal?.aborted ? 'aborted' : 'timeout', 'Fixed provider request aborted', { cause: error })
      }
      throw error
    } finally {
      reader.releaseLock()
    }
    try { return JSON.parse(text) as unknown } catch (error) {
      throw new SafeFetchError('unsupported_content_type', 'Fixed provider returned malformed JSON', { cause: error })
    }
  } catch (error) {
    if (response && operation.signal.aborted) await cancelBody(response, 'provider operation aborted')
    if (error instanceof SafeFetchError) throw error
    if (operation.signal.aborted) {
      throw new SafeFetchError(context.deadline.signal?.aborted ? 'aborted' : 'timeout', 'Fixed provider request aborted', { cause: error })
    }
    throw new SafeFetchError('network_error', 'Fixed provider request failed', { cause: error })
  } finally {
    operation.cleanup()
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function boundedString(value: unknown, maximum: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum ? value : undefined
}

function boundedHttpsUrl(value: unknown, maximum: number): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) return undefined
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.port && !parsed.hash
      ? parsed.href
      : undefined
  } catch { return undefined }
}

function failure(stage: YouTubeProviderStage, error: unknown): YouTubeProviderFailure {
  if (error instanceof SafeFetchError) {
    if (error.code === 'aborted') return { stage, code: 'aborted' }
    if (error.code === 'timeout') return { stage, code: 'deadline' }
    if (error.code === 'unsupported_content_type') return { stage, code: 'invalid_response' }
    if (error.code === 'network_error') return { stage, code: 'provider' }
    return { stage, code: 'policy' }
  }
  return { stage, code: 'invalid_response' }
}

async function fetchOEmbed(target: CanonicalYouTubeTarget, context: ProviderContext): Promise<YouTubeOEmbedMetadata> {
  const url = new URL(OEMBED_URL)
  url.searchParams.set('url', target.canonicalUrl)
  url.searchParams.set('format', 'json')
  const response = await safeFetchText(url, {
    allowedHostnames: ['www.youtube.com'],
    allowedContentTypes: ['application/json', 'application/problem+json'],
    maxRedirects: 0,
    timeoutMs: remainingMs(context.deadline, 10_000),
    maxResponseBytes: 128 * 1024,
    resolveHostname: context.resolveHostname,
    fetchImpl: context.fetchImpl,
    requestInit: { signal: context.deadline.signal, headers: { Accept: 'application/json' } },
  })
  if (!response.response.ok) throw new SafeFetchError('network_error', 'YouTube oEmbed returned an error response')
  let data: unknown
  try { data = JSON.parse(response.text) as unknown } catch (error) {
    throw new SafeFetchError('unsupported_content_type', 'YouTube oEmbed returned malformed JSON', { cause: error })
  }
  if (!record(data)) throw new SafeFetchError('unsupported_content_type', 'YouTube oEmbed payload is invalid')
  const title = boundedString(data.title, 512)
  const authorName = boundedString(data.author_name, 256)
  if (!title || !authorName) throw new SafeFetchError('unsupported_content_type', 'YouTube oEmbed fields are invalid')
  const width = typeof data.thumbnail_width === 'number' && Number.isFinite(data.thumbnail_width) && data.thumbnail_width >= 0
    ? data.thumbnail_width : undefined
  const height = typeof data.thumbnail_height === 'number' && Number.isFinite(data.thumbnail_height) && data.thumbnail_height >= 0
    ? data.thumbnail_height : undefined
  return {
    title,
    authorName,
    authorUrl: boundedHttpsUrl(data.author_url, 2048),
    thumbnailUrl: boundedHttpsUrl(data.thumbnail_url, 2048),
    thumbnailWidth: width,
    thumbnailHeight: height,
  }
}

function innertubeBody(videoId: string): string {
  return JSON.stringify({
    context: { client: { clientName: 'ANDROID', clientVersion: '17.31.35', androidSdkVersion: 30, hl: 'en', gl: 'US' } },
    videoId,
  })
}

function captionTracks(value: unknown): CaptionTrack[] | null {
  if (!record(value)) return null
  const captions = record(value.captions) ? value.captions : null
  const renderer = captions && record(captions.playerCaptionsTracklistRenderer)
    ? captions.playerCaptionsTracklistRenderer : null
  const tracks = renderer?.captionTracks
  if (!Array.isArray(tracks) || tracks.length === 0 || tracks.length > 100) return null
  const parsed: CaptionTrack[] = []
  for (const track of tracks) {
    if (!record(track)) return null
    const baseUrl = boundedString(track.baseUrl, 4096)
    const languageCode = boundedString(track.languageCode, 32)
    const kind = track.kind === undefined ? undefined : boundedString(track.kind, 32)
    if (!baseUrl || !languageCode || (track.kind !== undefined && !kind)) return null
    parsed.push({ baseUrl, languageCode, kind })
  }
  return parsed
}

function exactCaptionUrl(value: string): URL | null {
  const match = /^https:\/\/([^/?#]+)(\/[^?#]*)(?:\?[^#]*)?$/.exec(value)
  if (!match || match[1] !== 'www.youtube.com' || match[2] !== '/api/timedtext') return null
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && parsed.hostname === 'www.youtube.com'
      && !parsed.username && !parsed.password && !parsed.port && !parsed.hash
      ? parsed : null
  } catch { return null }
}

function decodeXmlText(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '').trim()
}

function parseTranscript(xml: string): string | null {
  const parts: string[] = []
  for (const match of xml.matchAll(/<text(?:\s[^>]*)?>([\s\S]*?)<\/text>/g)) {
    const text = decodeXmlText(match[1])
    if (text) parts.push(text)
  }
  if (parts.length === 0) return null
  const transcript = parts.join(' ')
  return transcript.length > MAX_TRANSCRIPT_CHARS ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) : transcript
}

async function fetchTranscript(
  target: CanonicalYouTubeTarget,
  preferredLanguage: string,
  context: ProviderContext,
): Promise<{ value?: string; failure?: YouTubeProviderFailure }> {
  let raw: unknown
  try {
    raw = await readBoundedPostJson(INNERTUBE_URL, innertubeBody(target.videoId), 512 * 1024, 15_000, context)
  } catch (error) {
    return { failure: failure('innertube', error) }
  }
  const tracks = captionTracks(raw)
  if (!tracks) return { failure: { stage: 'innertube', code: 'unavailable' } }
  const preferred = boundedString(preferredLanguage, 32) || 'en'
  const selected = tracks.find(track => track.languageCode === preferred && !track.kind)
    || tracks.find(track => track.languageCode === 'en' && !track.kind)
    || tracks.find(track => track.languageCode === preferred)
    || tracks.find(track => track.languageCode === 'en')
    || tracks[0]
  const captionUrl = exactCaptionUrl(selected.baseUrl)
  if (!captionUrl) return { failure: { stage: 'caption', code: 'policy' } }
  try {
    const response = await safeFetchText(captionUrl, {
      allowedHostnames: ['www.youtube.com'],
      allowedContentTypes: ['application/xml', 'text/xml', 'text/plain'],
      maxRedirects: 0,
      timeoutMs: remainingMs(context.deadline, 15_000),
      maxResponseBytes: 512 * 1024,
      resolveHostname: context.resolveHostname,
      fetchImpl: context.fetchImpl,
      requestInit: { signal: context.deadline.signal, headers: { Accept: 'application/xml, text/xml, text/plain' } },
    })
    if (!response.response.ok) return { failure: { stage: 'caption', code: 'provider' } }
    const transcript = parseTranscript(response.text)
    return transcript ? { value: transcript } : { failure: { stage: 'caption', code: 'unavailable' } }
  } catch (error) {
    return { failure: failure('caption', error) }
  }
}

function cobaltBody(canonicalUrl: string): string {
  return JSON.stringify({
    url: canonicalUrl,
    vCodec: 'h264',
    vQuality: '1080',
    aFormat: 'mp3',
    isAudioOnly: false,
    isTTFullAudio: false,
  })
}

async function publicMediaUrl(value: unknown, context: ProviderContext): Promise<string | undefined> {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return undefined
  const authority = /^https:\/\/([^/?#]+)/.exec(value)?.[1]
  if (!authority || authority.includes('@') || authority.includes(':') || value.includes('#')) return undefined
  let parsed: URL
  try { parsed = new URL(value) } catch { return undefined }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.hash) return undefined
  const operation = operationSignal(context.deadline, 15_000)
  try {
    return (await assertSafeOutboundUrl(parsed, operation.signal, context.resolveHostname)).href
  } catch (error) {
    if (operation.signal.aborted) {
      throw new SafeFetchError(context.deadline.signal?.aborted ? 'aborted' : 'timeout', 'Media URL validation aborted', { cause: error })
    }
    if (error instanceof SafeFetchError && (error.code === 'aborted' || error.code === 'timeout')) throw error
    return undefined
  } finally { operation.cleanup() }
}

async function fetchCobalt(
  target: CanonicalYouTubeTarget,
  context: ProviderContext,
): Promise<{ value?: string; failure?: YouTubeProviderFailure }> {
  try {
    const raw = await readBoundedPostJson(COBALT_URL, cobaltBody(target.canonicalUrl), 256 * 1024, 15_000, context)
    if (!record(raw) || (raw.status !== 'redirect' && raw.status !== 'stream')) {
      return { failure: { stage: 'cobalt', code: 'unavailable' } }
    }
    const output = await publicMediaUrl(raw.url, context)
    return output ? { value: output } : { failure: { stage: 'cobalt', code: 'policy' } }
  } catch (error) {
    return { failure: failure('cobalt', error) }
  }
}

/**
 * Fetch bounded YouTube metadata and optional transcript/media under one absolute deadline.
 * This helper never accepts a raw caller URL, logs, persists, caches, or fetches returned media.
 */
export async function fetchYouTubeProvider(
  target: CanonicalYouTubeTarget,
  options: YouTubeProviderOptions = {},
): Promise<YouTubeProviderResult> {
  if (!validTarget(target)) return { success: false, failure: { stage: 'target', code: 'invalid_target' } }
  let combined: CombinedDeadline
  try {
    const baseDeadline = options.deadline ?? createYouTubeProviderDeadline(MAX_CHAIN_MS, options.signal)
    combined = combineDeadlineSignal(baseDeadline, options.signal)
    remainingMs(combined.deadline, MAX_CHAIN_MS)
  } catch (error) {
    return { success: false, failure: failure('target', error) }
  }
  const context: ProviderContext = {
    deadline: combined.deadline,
    fetchImpl: options.fetchImpl ?? fetch,
    resolveHostname: options.resolveHostname ?? resolvePublicHostname,
  }
  try {
    let metadata: YouTubeOEmbedMetadata
    try { metadata = await fetchOEmbed(target, context) } catch (error) {
      return { success: false, failure: failure('oembed', error) }
    }

    const [transcript, media] = await Promise.all([
      options.includeTranscript
        ? fetchTranscript(target, options.preferredLanguage ?? 'en', context)
        : Promise.resolve({} as { value?: string; failure?: YouTubeProviderFailure }),
      options.includeMedia
        ? fetchCobalt(target, context)
        : Promise.resolve({} as { value?: string; failure?: YouTubeProviderFailure }),
    ])
    return {
      success: true,
      metadata,
      transcript: transcript.value,
      transcriptFailure: transcript.failure,
      mediaUrl: media.value,
      mediaFailure: media.failure,
    }
  } finally {
    combined.cleanup()
  }
}
