export interface CanonicalYouTubeTarget {
  platform: 'youtube'
  videoId: string
  canonicalUrl: string
}

export interface CanonicalInstagramTarget {
  platform: 'instagram'
  kind: 'p' | 'reel' | 'tv'
  shortcode: string
  canonicalUrl: string
}

export interface CanonicalTwitterTarget {
  platform: 'twitter'
  username: string
  tweetId: string
  canonicalUrl: string
}

export interface CanonicalTikTokTarget {
  platform: 'tiktok'
  username: string
  videoId: string
  canonicalUrl: string
}

export interface CanonicalFacebookTarget {
  platform: 'facebook'
  kind: 'post' | 'reel'
  contentId: string
  owner?: string
  canonicalUrl: string
}

export interface CanonicalBlueskyTarget {
  platform: 'bluesky'
  actor: string
  actorKind: 'handle' | 'did'
  rkey: string
  atUri: string
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
const INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
])
const TWITTER_HOSTS = new Set([
  'x.com',
  'www.x.com',
  'twitter.com',
  'www.twitter.com',
])
const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com'])
const FACEBOOK_HOSTS = new Set(['facebook.com', 'www.facebook.com'])
const BLUESKY_HOSTS = new Set(['bsky.app', 'www.bsky.app'])
const BLOCKED_HANDLE_SUFFIXES = ['.arpa', '.internal', '.invalid', '.lan', '.local', '.localhost', '.test'] as const

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

/**
 * Parses only canonical Instagram post, reel, and legacy TV URLs. This
 * function is pure: it does not perform network access, logging, caching, or
 * persistence.
 */
export function parseCanonicalInstagramUrl(input: string): CanonicalInstagramTarget | null {
  if (
    input.length === 0
    || input.length > MAX_SOCIAL_URL_LENGTH
    || input !== input.trim()
    || input.includes('\\')
    || containsAsciiControlCharacter(input)
  ) {
    return null
  }

  // Check the raw authority and path before URL normalization so explicit
  // default ports, Unicode host aliases, and encoded separators cannot be
  // silently normalized into an accepted URL.
  const rawMatch = /^https:\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(input)
  if (!rawMatch) return null

  const [, rawAuthority, rawPath, rawQuery, rawFragment] = rawMatch
  if (
    rawQuery
    || rawFragment
    || rawAuthority.includes('@')
    || rawAuthority.includes(':')
    || rawAuthority.includes('%')
    || !INSTAGRAM_HOSTS.has(rawAuthority.toLowerCase())
    || rawPath.includes('%')
  ) {
    return null
  }

  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return null
  }

  if (
    parsed.protocol !== 'https:'
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.port !== ''
    || !INSTAGRAM_HOSTS.has(parsed.hostname.toLowerCase())
  ) {
    return null
  }

  const pathMatch = /^\/(p|reel|tv)\/([A-Za-z0-9_-]{1,64})\/?$/.exec(rawPath)
  if (!pathMatch) return null

  const [, kind, shortcode] = pathMatch as RegExpExecArray & {
    1: CanonicalInstagramTarget['kind']
  }

  return {
    platform: 'instagram',
    kind,
    shortcode,
    canonicalUrl: `https://www.instagram.com/${kind}/${shortcode}/`,
  }
}

/**
 * Parses one exact public Twitter/X post shape. Tracking parameters, fragments,
 * alternate paths, encoded separators, credentials, and explicit ports are
 * rejected before URL normalization. The returned identity is always on x.com.
 */
export function parseCanonicalTwitterUrl(input: string): CanonicalTwitterTarget | null {
  if (
    input.length === 0
    || input.length > MAX_SOCIAL_URL_LENGTH
    || input !== input.trim()
    || input.includes('\\')
    || containsAsciiControlCharacter(input)
  ) {
    return null
  }

  const rawMatch = /^https:\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(input)
  if (!rawMatch) return null
  const [, rawAuthority, rawPath, rawQuery, rawFragment] = rawMatch
  if (
    rawQuery
    || rawFragment
    || rawAuthority.includes('@')
    || rawAuthority.includes(':')
    || rawAuthority.includes('%')
    || !TWITTER_HOSTS.has(rawAuthority.toLowerCase())
    || rawPath.includes('%')
  ) {
    return null
  }

  let parsed: URL
  try { parsed = new URL(input) } catch { return null }
  if (
    parsed.protocol !== 'https:'
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.port !== ''
    || !TWITTER_HOSTS.has(parsed.hostname.toLowerCase())
  ) {
    return null
  }

  const pathMatch = /^\/([A-Za-z0-9_]{1,15})\/status\/([1-9][0-9]{0,19})\/?$/.exec(rawPath)
  if (!pathMatch) return null
  const username = pathMatch[1].toLowerCase()
  const tweetId = pathMatch[2]
  return {
    platform: 'twitter',
    username,
    tweetId,
    canonicalUrl: `https://x.com/${username}/status/${tweetId}`,
  }
}

/** Parse one exact public TikTok video URL into a query-free identity. */
export function parseCanonicalTikTokUrl(input: string): CanonicalTikTokTarget | null {
  if (
    input.length === 0
    || input.length > MAX_SOCIAL_URL_LENGTH
    || input !== input.trim()
    || input.includes('\\')
    || containsAsciiControlCharacter(input)
  ) return null

  const rawMatch = /^https:\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(input)
  if (!rawMatch) return null
  const [, rawAuthority, rawPath, rawQuery, rawFragment] = rawMatch
  if (
    rawQuery
    || rawFragment
    || rawAuthority.includes('@')
    || rawAuthority.includes(':')
    || rawAuthority.includes('%')
    || !TIKTOK_HOSTS.has(rawAuthority.toLowerCase())
    || rawPath.includes('%')
  ) return null

  let parsed: URL
  try { parsed = new URL(input) } catch { return null }
  if (
    parsed.protocol !== 'https:'
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.port !== ''
    || !TIKTOK_HOSTS.has(parsed.hostname.toLowerCase())
  ) return null

  const match = /^\/@([A-Za-z0-9._]{1,24})\/video\/([1-9][0-9]{0,19})\/?$/.exec(rawPath)
  if (!match) return null
  const username = match[1].toLowerCase()
  const videoId = match[2]
  return {
    platform: 'tiktok',
    username,
    videoId,
    canonicalUrl: `https://www.tiktok.com/@${username}/video/${videoId}`,
  }
}

/** Parse the public Facebook post and reel URL shapes supported by Meta Embeds. */
export function parseCanonicalFacebookUrl(input: string): CanonicalFacebookTarget | null {
  if (
    input.length === 0
    || input.length > MAX_SOCIAL_URL_LENGTH
    || input !== input.trim()
    || input.includes('\\')
    || containsAsciiControlCharacter(input)
  ) return null

  const rawMatch = /^https:\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(input)
  if (!rawMatch) return null
  const [, rawAuthority, rawPath, rawQuery, rawFragment] = rawMatch
  if (
    rawQuery
    || rawFragment
    || rawAuthority.includes('@')
    || rawAuthority.includes(':')
    || rawAuthority.includes('%')
    || !FACEBOOK_HOSTS.has(rawAuthority.toLowerCase())
    || rawPath.includes('%')
  ) return null

  let parsed: URL
  try { parsed = new URL(input) } catch { return null }
  if (
    parsed.protocol !== 'https:'
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.port !== ''
    || !FACEBOOK_HOSTS.has(parsed.hostname.toLowerCase())
  ) return null

  const postMatch = /^\/([A-Za-z0-9.]{1,80})\/posts\/([1-9][0-9]{0,39})\/?$/.exec(rawPath)
  if (postMatch) {
    const owner = postMatch[1].toLowerCase()
    const contentId = postMatch[2]
    return {
      platform: 'facebook',
      kind: 'post',
      owner,
      contentId,
      canonicalUrl: `https://www.facebook.com/${owner}/posts/${contentId}/`,
    }
  }

  const reelMatch = /^\/reel\/([1-9][0-9]{0,39})\/?$/.exec(rawPath)
  if (!reelMatch) return null
  const contentId = reelMatch[1]
  return {
    platform: 'facebook',
    kind: 'reel',
    contentId,
    canonicalUrl: `https://www.facebook.com/reel/${contentId}/`,
  }
}

function validBlueskyHandle(value: string): boolean {
  if (value.length < 3 || value.length > 253 || value !== value.toLowerCase()) return false
  if (BLOCKED_HANDLE_SUFFIXES.some(suffix => value.endsWith(suffix))) return false
  const labels = value.split('.')
  if (labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return false
  return /[a-z]/.test(labels.at(-1) ?? '')
}

function parseBlueskyActor(value: string): Pick<CanonicalBlueskyTarget, 'actor' | 'actorKind'> | null {
  const normalized = value.toLowerCase()
  if (/^did:plc:[a-z2-7]{24}$/.test(value)) {
    return { actor: value, actorKind: 'did' }
  }
  if (value.startsWith('did:web:')) {
    const hostname = value.slice('did:web:'.length)
    return validBlueskyHandle(hostname) && hostname === normalized.slice('did:web:'.length)
      ? { actor: value, actorKind: 'did' }
      : null
  }
  return validBlueskyHandle(normalized)
    ? { actor: normalized, actorKind: 'handle' }
    : null
}

function validBlueskyRkey(value: string): boolean {
  return value.length >= 1
    && value.length <= 512
    && value !== '.'
    && value !== '..'
    && /^[A-Za-z0-9._:~-]+$/.test(value)
}

/** Parse one normalized Bluesky web URL or app.bsky.feed.post AT URI. */
export function parseCanonicalBlueskyUrl(input: string): CanonicalBlueskyTarget | null {
  if (
    input.length === 0
    || input.length > MAX_SOCIAL_URL_LENGTH
    || input !== input.trim()
    || input.includes('\\')
    || input.includes('%')
    || containsAsciiControlCharacter(input)
  ) return null

  let rawActor: string
  let rkey: string
  if (input.startsWith('at://')) {
    const match = /^at:\/\/([^/?#]+)\/app\.bsky\.feed\.post\/([^/?#]+)$/.exec(input)
    if (!match) return null
    rawActor = match[1]
    rkey = match[2]
  } else {
    const rawMatch = /^https:\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(input)
    if (!rawMatch) return null
    const [, rawAuthority, rawPath, rawQuery, rawFragment] = rawMatch
    if (
      rawQuery
      || rawFragment
      || rawAuthority.includes('@')
      || rawAuthority.includes(':')
      || !BLUESKY_HOSTS.has(rawAuthority.toLowerCase())
    ) return null
    let parsed: URL
    try { parsed = new URL(input) } catch { return null }
    if (
      parsed.protocol !== 'https:'
      || parsed.username !== ''
      || parsed.password !== ''
      || parsed.port !== ''
      || !BLUESKY_HOSTS.has(parsed.hostname.toLowerCase())
    ) return null
    const match = /^\/profile\/([^/]+)\/post\/([^/]+)\/?$/.exec(rawPath)
    if (!match) return null
    rawActor = match[1]
    rkey = match[2]
  }

  const actor = parseBlueskyActor(rawActor)
  if (!actor || !validBlueskyRkey(rkey)) return null
  const atUri = `at://${actor.actor}/app.bsky.feed.post/${rkey}`
  return {
    platform: 'bluesky',
    ...actor,
    rkey,
    atUri,
    canonicalUrl: `https://bsky.app/profile/${actor.actor}/post/${rkey}`,
  }
}
