export interface CanonicalYouTubeTarget {
  platform: 'youtube'
  videoId: string
  canonicalUrl: string
}

const MAX_SOCIAL_URL_LENGTH = 2048
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
])
const ACCEPTED_RAW_YOUTUBE_HOSTS = new Set([
  ...YOUTUBE_HOSTS,
  'youtu.be',
])

function containsAsciiControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.charCodeAt(0)
    return codePoint <= 0x1f || codePoint === 0x7f
  })
}

/**
 * Parses only the deliberately small set of YouTube URL shapes used by the
 * social extraction routes. This function is pure: it does not perform host
 * discovery, network access, logging, caching, or persistence.
 */
export function parseCanonicalYouTubeUrl(input: string): CanonicalYouTubeTarget | null {
  if (
    input.length === 0
    || input.length > MAX_SOCIAL_URL_LENGTH
    || input !== input.trim()
    || input.includes('\\')
    || containsAsciiControlCharacter(input)
    || /%(?![0-9a-f]{2})/i.test(input)
  ) {
    return null
  }

  // Inspect the authority before URL normalization. URL.port, for example,
  // loses an explicitly supplied default port such as :443.
  const rawMatch = /^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(input)
  if (!rawMatch || rawMatch[5]) return null

  const [, , rawAuthority, rawPath, rawQuery] = rawMatch
  if (
    rawAuthority.includes('@')
    || rawAuthority.includes(':')
    || rawAuthority.includes('%')
    || !ACCEPTED_RAW_YOUTUBE_HOSTS.has(rawAuthority.toLowerCase())
  ) {
    return null
  }
  // Accepted paths and IDs contain no escapes. Rejecting them before parsing
  // also closes encoded separator and encoded dot-segment variants.
  if (rawPath.includes('%')) return null

  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return null
  }

  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.port !== ''
  ) {
    return null
  }

  const hostname = parsed.hostname.toLowerCase()
  let videoId: string | null = null

  if (hostname === 'youtu.be') {
    if (rawQuery) return null
    const match = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(rawPath)
    videoId = match?.[1] ?? null
  } else if (YOUTUBE_HOSTS.has(hostname)) {
    const watchMatch = /^\/watch\/?$/.exec(rawPath)
    if (watchMatch) {
      const queryMatch = /^\?v=([A-Za-z0-9_-]{11})$/.exec(rawQuery ?? '')
      videoId = queryMatch?.[1] ?? null
    } else {
      if (rawQuery) return null
      const pathMatch = /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/.exec(rawPath)
      videoId = pathMatch?.[1] ?? null
    }
  }

  if (!videoId || !YOUTUBE_ID_PATTERN.test(videoId)) return null

  return {
    platform: 'youtube',
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
  }
}
