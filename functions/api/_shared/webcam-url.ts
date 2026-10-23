/**
 * Webcam links for a COP: which ones are accepted, and the embed URL each one gets.
 *
 * A COP shows a camera through its provider's own player or feed, loaded by the
 * viewer's browser. Nothing is proxied, re-hosted or archived here. So:
 *   - Windy and YouTube links are reduced to an id; the iframe URL is derived from
 *     that id on read (webcamEmbedUrl), never taken from the user.
 *   - Image-refresh and HLS (.m3u8) URLs are accepted only from allow-listed open
 *     data hosts (IMAGE_HOSTS, HLS_HOSTS) plus COP_WEBCAM_EXTRA_HOSTS.
 *   - https only, on the default port, with no userinfo and no IP-literal host.
 *     Direct device paths (axis-cgi, cgi-bin, mjpg, ...) and directories of
 *     unsecured cameras (DENIED_DOMAINS) are refused outright.
 *
 * An HLS host added through COP_WEBCAM_EXTRA_HOSTS also needs a connect-src and
 * media-src entry in the COP block of public/_headers, or the browser blocks it.
 */

export type WebcamProvider = 'windy' | 'youtube' | 'image' | 'hls'
export type WebcamDelivery = 'live' | 'timelapse' | 'snapshot'

export interface ParsedWebcam {
  provider: WebcamProvider
  provider_ref: string | null
  page_url: string | null
  image_url: string | null
  stream_url: string | null
  delivery: WebcamDelivery
  /** The attribution the source requires, or null when its player carries its own. */
  attribution: string | null
}

// Both arms name both fields so callers compile under strict: false (functions
// tsconfig), where a boolean discriminant does not narrow.
export type WebcamUrlResult =
  | { ok: true; cam: ParsedWebcam; error?: undefined }
  | { ok: false; error: string; cam?: undefined }

export interface WebcamHostRule {
  host: string
  /** When set, only paths under this prefix (the host is shared, e.g. S3). */
  pathPrefix?: string
  attribution?: string
}

export const WINDY_ATTRIBUTION = 'Webcams provided by windy.com'

/** Open-data still-image cameras. */
export const IMAGE_HOSTS: readonly WebcamHostRule[] = [
  // Fintraffic road weather cameras: https://weathercam.digitraffic.fi/<presetId>.jpg
  { host: 'weathercam.digitraffic.fi', attribution: 'Fintraffic / digitraffic.fi, CC BY 4.0' },
  // TfL JamCams (api.tfl.gov.uk/Place/Type/JamCam imageUrl), in a shared S3 host.
  { host: 's3-eu-west-1.amazonaws.com', pathPrefix: '/jamcams.tfl.gov.uk/', attribution: 'Powered by TfL Open Data' },
  // Caltrans CCTV stills (CWWP2 / gisdata CCTV layer currentImageURL).
  { host: 'cwwp2.dot.ca.gov', pathPrefix: '/data/', attribution: 'Caltrans' },
]

/** Open-data HLS cameras. Each host here is also in the COP CSP (public/_headers). */
export const HLS_HOSTS: readonly WebcamHostRule[] = [
  // Caltrans CCTV streams (gisdata CCTV layer streamingVideoURL).
  { host: 'wzmedia.dot.ca.gov', attribution: 'Caltrans' },
]

/** Directories of unsecured private cameras. Never a source, whatever the path. */
export const DENIED_DOMAINS: readonly string[] = [
  'insecam.org',
  'insecam.com',
  'insecam.net',
  'opentopia.com',
  'shodan.io',
]

const DEVICE_PATH_MARKERS = ['axis-cgi', 'cgi-bin', 'mjpg', 'mjpeg', 'snapshot.cgi', 'video.cgi']

const WINDY_HOSTS = new Set(['windy.com', 'www.windy.com', 'webcams.windy.com'])
const YOUTUBE_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be',
  'youtube-nocookie.com', 'www.youtube-nocookie.com',
])

const WINDY_ID = /^\d{6,12}$/
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const IMAGE_PATH = /\.(?:jpe?g|png|webp)$/i
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

const UNSUPPORTED =
  "This link isn't a supported camera source. Paste the camera's Windy link " +
  '(windy.com/webcams/<id>) or a YouTube video link. A page that shows a camera ' +
  'usually embeds a Windy or YouTube player: open the player and copy its link.'

/** The iframe URL for a stored Windy or YouTube camera; null for anything else. */
export function webcamEmbedUrl(provider: string, providerRef: string | null | undefined): string | null {
  const ref = String(providerRef ?? '')
  if (provider === 'windy' && WINDY_ID.test(ref)) {
    return `https://webcams.windy.com/webcams/public/embed/player/${ref}/day`
  }
  if (provider === 'youtube' && YOUTUBE_ID.test(ref)) {
    return `https://www.youtube-nocookie.com/embed/${ref}`
  }
  return null
}

function isIpLiteral(hostname: string): boolean {
  // URL normalises every IPv4 spelling (hex, octal, a bare integer) to dotted
  // decimal, and wraps IPv6 in brackets.
  return hostname.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
}

function deniedDomain(hostname: string): boolean {
  hostname = hostname.replace(/\.$/, '')
  return DENIED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))
}

/** COP_WEBCAM_EXTRA_HOSTS: comma list of `host` or `host/path/prefix/`. Bad entries are skipped. */
export function parseExtraHosts(raw: string | undefined | null): WebcamHostRule[] {
  const rules: WebcamHostRule[] = []
  for (const entry of String(raw ?? '').split(',')) {
    const value = entry.trim().toLowerCase()
    if (!value) continue
    const slash = value.indexOf('/')
    const host = slash === -1 ? value : value.slice(0, slash)
    const pathPrefix = slash === -1 ? undefined : value.slice(slash)
    if (!HOSTNAME.test(host) || deniedDomain(host)) continue
    rules.push(pathPrefix ? { host, pathPrefix } : { host })
  }
  return rules
}

function matchRule(rules: readonly WebcamHostRule[], url: URL): WebcamHostRule | null {
  return rules.find((r) => r.host === url.hostname && (!r.pathPrefix || url.pathname.startsWith(r.pathPrefix))) ?? null
}

function windy(id: string): WebcamUrlResult {
  return {
    ok: true,
    cam: {
      provider: 'windy',
      provider_ref: id,
      page_url: `https://www.windy.com/webcams/${id}`,
      image_url: null,
      stream_url: null,
      delivery: 'timelapse',
      attribution: WINDY_ATTRIBUTION,
    },
  }
}

function windyId(url: URL): string | null {
  const path = url.pathname
  const match = url.hostname === 'webcams.windy.com'
    ? /^\/webcams\/public\/embed\/player\/(\d+)(?:\/.*)?$/.exec(path)
    : /^(?:\/-Webcams-[^/]+)?\/webcams\/(\d+)\/?$/.exec(path)
  return match && WINDY_ID.test(match[1]) ? match[1] : null
}

function youtubeId(url: URL): string | null | undefined {
  // undefined: not a video link at all; null: a video link with a bad id.
  if (url.hostname === 'youtu.be') return url.pathname.split('/')[1] || null
  if (url.pathname === '/watch') return url.searchParams.get('v')
  const match = /^\/(?:live|embed|shorts)\/([^/]*)\/?$/.exec(url.pathname)
  return match ? match[1] : undefined
}

/**
 * Validate a pasted camera link and reduce it to what a COP stores.
 * `extraHosts` is the raw COP_WEBCAM_EXTRA_HOSTS value.
 */
export function parseWebcamUrl(raw: unknown, extraHosts?: string | null): WebcamUrlResult {
  const input = typeof raw === 'string' ? raw.trim() : ''
  if (!input) return { ok: false, error: 'A camera link is required.' }
  if (input.length > 2048) return { ok: false, error: 'The camera link is too long.' }

  const shorthand = /^windy:(\S+)$/i.exec(input)
  if (shorthand) {
    return WINDY_ID.test(shorthand[1]) ? windy(shorthand[1]) : { ok: false, error: 'A Windy webcam id is 6 to 12 digits.' }
  }

  let url: URL
  try {
    url = new URL(input)
  } catch {
    return { ok: false, error: UNSUPPORTED }
  }

  const scheme = url.protocol.slice(0, -1).toLowerCase()
  if (scheme === 'rtsp' || scheme === 'rtmp' || scheme === 'rtmps') {
    return { ok: false, error: `${scheme.toUpperCase()} streams are not supported: a COP shows cameras through their provider's https player or feed.` }
  }
  if (scheme !== 'https') return { ok: false, error: 'Only https camera links are accepted.' }
  if (url.username || url.password) return { ok: false, error: 'Camera links may not carry a username or password.' }
  if (url.port) return { ok: false, error: 'Camera links must use the standard https port.' }
  const host = url.hostname.toLowerCase()
  if (isIpLiteral(host)) return { ok: false, error: 'Camera links must name a host, not an IP address.' }
  if (deniedDomain(host)) {
    return { ok: false, error: 'Directories of unsecured private cameras are not accepted as a source.' }
  }

  let path: string
  try {
    path = decodeURIComponent(url.pathname + url.search).toLowerCase()
  } catch {
    return { ok: false, error: UNSUPPORTED }
  }
  if (DEVICE_PATH_MARKERS.some((m) => path.includes(m))) {
    return { ok: false, error: "Links straight to a camera device aren't accepted; use the provider's public player or feed." }
  }

  if (WINDY_HOSTS.has(host)) {
    const id = windyId(url)
    return id ? windy(id) : { ok: false, error: 'Paste a Windy webcam link: windy.com/webcams/<id>.' }
  }

  if (YOUTUBE_HOSTS.has(host)) {
    const id = youtubeId(url)
    if (id === undefined) {
      return { ok: false, error: "Paste a YouTube video link (watch?v=..., youtu.be/..., /live/...), not a channel or playlist." }
    }
    if (!id || !YOUTUBE_ID.test(id)) return { ok: false, error: 'That YouTube link has no valid 11-character video id.' }
    return {
      ok: true,
      cam: {
        provider: 'youtube',
        provider_ref: id,
        page_url: `https://www.youtube.com/watch?v=${id}`,
        image_url: null,
        stream_url: null,
        delivery: 'live',
        attribution: null,
      },
    }
  }

  const extra = parseExtraHosts(extraHosts)
  url.hash = ''
  if (url.pathname.toLowerCase().endsWith('.m3u8')) {
    const rule = matchRule([...HLS_HOSTS, ...extra], url)
    if (!rule) return { ok: false, error: 'HLS streams are accepted only from approved open-data hosts.' }
    return {
      ok: true,
      cam: {
        provider: 'hls', provider_ref: null, page_url: null, image_url: null, stream_url: url.href,
        delivery: 'live', attribution: rule.attribution ?? null,
      },
    }
  }

  const rule = matchRule([...IMAGE_HOSTS, ...extra], url)
  if (!rule) return { ok: false, error: UNSUPPORTED }
  if (!IMAGE_PATH.test(url.pathname)) return { ok: false, error: 'An image camera link must end in .jpg, .png or .webp.' }
  return {
    ok: true,
    cam: {
      provider: 'image', provider_ref: null, page_url: null, image_url: url.href, stream_url: null,
      delivery: 'snapshot', attribution: rule.attribution ?? null,
    },
  }
}
