// Cloudflare Pages Functions Middleware
// Handles CORS, common request processing, and rate limiting.
//
// Rate limiting is KV-backed (CACHE namespace), NOT in-memory: Pages runs many
// isolates, so a per-isolate Map barely limits anything — each request can land on
// a cold isolate with an empty counter. KV is shared across isolates, so it holds
// up against SUSTAINED abuse (a script running for minutes — the real OpenAI-cost
// risk) once the counter converges.
//
// LIMITATION (by design, documented): KV is eventually consistent — reads are
// edge-cached (~up to 60s), so a fast sub-minute BURST can read a stale 0 and slip
// through. That's bounded/negligible cost; the gateway's global limiter is the
// second layer. Precise/burst-accurate limiting needs the Cloudflare Rate Limiting
// binding or a Durable Object (strongly consistent) — tracked as a follow-up.
// Fail-open throughout: if CACHE is unbound or KV errors, the request proceeds.

/**
 * AI endpoints subject to the per-user (hash) rate limiter. Matched as a
 * substring against url.pathname for POST requests. Exported so a regression
 * test can assert coverage (e.g. /api/collection/start must stay listed).
 *
 * NOTE: use the EXACT path '/api/collection/start', not the broader
 * '/api/collection/' prefix — the latter would also throttle the agent's
 * POST /api/collection/callback (which is rate-limited separately by IP).
 */
export const AI_RATE_LIMITED_PATHS = [
  '/api/ai/',
  '/api/claims/',
  '/api/tools/',
  '/api/content-intelligence/',
  '/api/ach/generate',
  '/api/ach/from-content',
  '/api/equilibrium-analysis/analyze',
  '/api/hamilton-rule/analyze',
  '/api/relationships/infer-type',
  '/api/frameworks/swot-auto-populate',
  '/api/frameworks/pmesii-pt',
  '/api/frameworks/comb-analysis',
  '/api/frameworks/behavior',
  '/api/research/generate',
  '/api/research/recommend',
  '/api/surveys/',
  '/api/collection/start',
]

/** True for the paid Apify COP scraper endpoint POST (/api/cop/<id>/scrape) — throttled
 *  separately from AI calls because each run bills Apify. Excludes /tools/scrape-metadata,
 *  /ai/scrape-url, /web-scraper (cheaper / covered elsewhere). */
export function isApifyScraperPath(pathname: string): boolean {
  return pathname.includes('/cop/') && pathname.endsWith('/scrape')
}

export function isPublicContentAnalysisPath(pathname: string): boolean {
  return pathname === '/api/content-intelligence/analyze-url'
    || pathname === '/api/content-intelligence/dime-analyze'
}

/**
 * Per-hour analysis budget for a recognized first-party service caller.
 *
 * NOT unlimited. The reason the public cap exists — each request can fan out to
 * paid model calls — applies to our own automation too, and a bot stuck in a
 * retry loop is the most likely source of a runaway bill. This is a blast
 * radius, not a throttle: 600/hour is ~50x the community's link volume, so it
 * only trips on a malfunction.
 *
 * Override with SERVICE_ANALYSIS_HOURLY_LIMIT.
 */
const DEFAULT_SERVICE_ANALYSIS_LIMIT = 600

export function serviceAnalysisLimit(env: MiddlewareEnv): number {
  const parsed = Number.parseInt(env.SERVICE_ANALYSIS_HOURLY_LIMIT ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SERVICE_ANALYSIS_LIMIT
}

/**
 * Identify a first-party caller, returning a stable key to meter it by.
 *
 * Two tiers, deliberately ordered:
 *
 * 1. An `rt_svc_…` integration token (see `_shared/service-auth.ts`) — the real
 *    mechanism: HMAC-hashed secrets, scopes, rotation slots, expiry, revocation.
 *    Metered per client id, so one misbehaving integration cannot spend another's
 *    budget.
 *
 * 2. INTERIM: a key listed in `TRUSTED_ANALYSIS_KEYS` (comma-separated),
 *    presented as `X-Service-Key` (preferred) or as the bearer. Tier 1 is inert
 *    until an operator provisions a client, and the first-party bots need the
 *    exemption now. Same class of secret as the existing `BOT_INTAKE_API_KEY`
 *    used by the frameworks intake routes — but with no rotation, scoping or
 *    expiry, so **remove tier 2 once service tokens are provisioned.**
 *    Entries shorter than 32 chars are ignored, so a placeholder or a truncated
 *    paste cannot become a valid key.
 *
 * A malformed or unknown token is NOT exempt: it falls through to the public
 * per-IP cap, so a leaked-and-revoked key degrades to public limits rather than
 * failing open.
 */
export function trustedServiceKey(request: Request, env: MiddlewareEnv): string | null {
  const trusted = (env.TRUSTED_ANALYSIS_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length >= 32)

  const matchTrusted = (candidate: string | null | undefined): string | null => {
    if (!candidate || trusted.length === 0) return null
    // Check every entry with no early exit, so a match does not leak its
    // position through timing.
    let matched: string | null = null
    for (let i = 0; i < trusted.length; i += 1) {
      if (timingSafeEqualStrings(trusted[i], candidate)) matched = `key:${i}`
    }
    return matched
  }

  // Preferred: a dedicated header. Keeping the exemption key out of the
  // Authorization header means a caller's IDENTITY and its rate-limit standing
  // are separate secrets — the Signal bot keeps sending its own bearer (which
  // it needs for the authenticated supplied-content path) without that token
  // also having to be strong enough to gate a 600/hour budget.
  const headerKey = matchTrusted(request.headers.get('X-Service-Key')?.trim())
  if (headerKey) return headerKey

  const authorization = request.headers.get('Authorization') || ''
  const bearer = /^\s*Bearer\s+(.+)$/i.exec(authorization)?.[1]?.trim()
  if (!bearer) return null

  // An `rt_svc_` integration token (see `_shared/service-auth.ts`) — the real
  // mechanism. Only the client id becomes the meter key; the secret half is
  // never logged or used in a KV key.
  const serviceToken = /^rt_svc_([a-z0-9][a-z0-9_-]{15,63})\.([A-Za-z0-9_-]{43})$/.exec(bearer)
  if (serviceToken) return `svc:${serviceToken[1]}`

  // Last resort: the trusted key presented as the bearer, for callers that
  // cannot set a custom header.
  return matchTrusted(bearer)
}

/** Length-independent constant-time string comparison. */
function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export interface MiddlewareEnv {
  CACHE?: KVNamespace
  /** Comma-separated interim first-party analysis keys. See `trustedServiceKey`. */
  TRUSTED_ANALYSIS_KEYS?: string
  /** Override for the first-party hourly analysis budget. */
  SERVICE_ANALYSIS_HOURLY_LIMIT?: string
}

interface MiddlewareContext {
  request: Request
  next: () => Promise<Response>
  env: MiddlewareEnv
}

/**
 * Fixed-window KV rate limiter. Returns true if the caller is OVER the limit.
 * key: caller-scoped string (e.g. "ai:<hash>"). limit: max events per window.
 */
async function kvRateLimit(env: MiddlewareEnv | undefined, key: string, limit: number, windowSec: number): Promise<boolean> {
  const store = env?.CACHE
  if (!store) return false // fail-open: limiter store not available
  try {
    const bucket = Math.floor(Date.now() / (windowSec * 1000))
    const k = `rl:${key}:${bucket}`
    const count = parseInt((await store.get(k)) || '0', 10)
    if (count >= limit) return true
    await store.put(k, String(count + 1), { expirationTtl: windowSec * 2 })
    return false
  } catch {
    return false // fail-open on KV error
  }
}

export async function onRequest(context: MiddlewareContext) {
  const { request, next, env } = context
  const url = new URL(request.url)

  // CORS headers for all API requests — dynamic origin check
  const origin = request.headers.get('Origin') || ''
  const allowedOrigins = [
    'https://researchtoolspy.pages.dev',
    'https://researchtools.net',
    'http://localhost:5173',
    'http://localhost:8788',
  ]
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0]

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Guest-Session, X-Workspace-ID, X-Correlation-ID, X-Service-Key',
    'Vary': 'Origin',
  }

  const json429 = (msg: string) =>
    new Response(JSON.stringify({ error: msg }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  // Handle OPTIONS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown'

  // URL and ephemeral DIME analysis are intentionally public, but each request
  // can fan out to paid model calls. Apply one shared, tighter IP budget to
  // authenticated and anonymous callers alike; general AI/gateway caps remain
  // backstops.
  if (request.method === 'POST' && isPublicContentAnalysisPath(url.pathname)) {
    // First-party automation (the Signal bot and the irregulars.io workers) is
    // metered by service identity instead of by IP. The public cap is keyed on
    // CF-Connecting-IP, which meant every first-party caller behind one egress
    // shared 12 requests/hour with each other AND with any human on that
    // address — 12/hour is a sane public budget and a nonsensical one for a
    // bot that analyzes every link posted to a community.
    const serviceKey = trustedServiceKey(request, env)
    if (serviceKey) {
      if (await kvRateLimit(env, `content-analysis-svc:${serviceKey}`, serviceAnalysisLimit(env), 60 * 60)) {
        return json429('Service analysis limit reached. Please try again later.')
      }
    } else if (await kvRateLimit(env, `content-analysis:${clientIp}`, 12, 60 * 60)) {
      return json429('Public analysis limit reached. Please try again later.')
    }
  }

  // Auth: brute-force protection on login
  if (url.pathname.includes('/hash-auth/authenticate') && request.method === 'POST') {
    if (await kvRateLimit(env, `auth:${clientIp}`, 5, 60)) {
      return json429('Too many login attempts. Please try again later.')
    }
  }

  // AI endpoints: prevent OpenAI billing abuse. Per-user (hash), generous so it only
  // catches abuse/runaway, not normal use. Backstopped by the gateway's global limiter.
  if (request.method === 'POST' && AI_RATE_LIMITED_PATHS.some(p => url.pathname.includes(p))) {
    const id = request.headers.get('X-User-Hash') || request.headers.get('X-Guest-Session') || clientIp
    if (await kvRateLimit(env, `ai:${id}`, 40, 60)) {
      return json429('AI rate limit exceeded. Please wait before making more requests.')
    }
  }

  // Apify scrapers cost real money per run — throttle per-user, tighter than AI.
  if (request.method === 'POST' && isApifyScraperPath(url.pathname)) {
    const id = request.headers.get('X-User-Hash') || request.headers.get('X-Guest-Session') || clientIp
    if (await kvRateLimit(env, `scrape:${id}`, 10, 60)) {
      return json429('Scraper rate limit exceeded. Please wait before starting more scrapes.')
    }
  }

  // Guest registration: prevent DB flooding via /hash-auth/register
  if (url.pathname.includes('/hash-auth/register') && request.method === 'POST') {
    if (await kvRateLimit(env, `register:${clientIp}`, 10, 60)) {
      return json429('Too many registration attempts. Please try again later.')
    }
  }

  // Public password verification endpoints
  if (url.pathname.includes('/intake/') && url.pathname.includes('/verify-password') && request.method === 'POST') {
    if (await kvRateLimit(env, `pwd:${clientIp}`, 10, 60)) {
      return json429('Too many attempts. Please try again later.')
    }
  }

  // Process the request.
  // Many endpoints call getUserFromRequest/getUserIdOrDefault directly (not via
  // requireAuth) and let an AuthDbError propagate. Catch it here so a transient
  // D1 failure during hash resolution becomes a retryable 503, not an opaque 500.
  // Everything else (including Responses thrown by requireAuth) is re-thrown so
  // the Pages runtime handles it exactly as before.
  let response: Response
  try {
    response = await next()
  } catch (err: unknown) {
    const authErr = err as { isAuthDbError?: boolean; name?: string } | null | undefined
    if (authErr?.isAuthDbError === true || authErr?.name === 'AuthDbError') {
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable, please retry.', retryable: true }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '2', ...corsHeaders },
        }
      )
    }
    throw err
  }

  // Add CORS headers to response
  Object.entries(corsHeaders).forEach(([key, value]) => {
    if (key === 'Vary') {
      const vary = new Set([
        ...(response.headers.get('Vary') ?? '').split(',').map(item => item.trim()).filter(Boolean),
        value,
      ])
      response.headers.set(key, [...vary].join(', '))
      return
    }
    response.headers.set(key, value as string)
  })

  return response
}
