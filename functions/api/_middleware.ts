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

/**
 * Fixed-window KV rate limiter. Returns true if the caller is OVER the limit.
 * key: caller-scoped string (e.g. "ai:<hash>"). limit: max events per window.
 */
async function kvRateLimit(env: any, key: string, limit: number, windowSec: number): Promise<boolean> {
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

export async function onRequest(context: any) {
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
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

  // Auth: brute-force protection on login
  if (url.pathname.includes('/hash-auth/authenticate') && request.method === 'POST') {
    if (await kvRateLimit(env, `auth:${clientIp}`, 5, 60)) {
      return json429('Too many login attempts. Please try again later.')
    }
  }

  // AI endpoints: prevent OpenAI billing abuse. Per-user (hash), generous so it only
  // catches abuse/runaway, not normal use. Backstopped by the gateway's global limiter.
  if (request.method === 'POST' && AI_RATE_LIMITED_PATHS.some(p => url.pathname.includes(p))) {
    const id = request.headers.get('X-User-Hash') || clientIp
    if (await kvRateLimit(env, `ai:${id}`, 40, 60)) {
      return json429('AI rate limit exceeded. Please wait before making more requests.')
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
    response.headers.set(key, value as string)
  })

  return response
}
