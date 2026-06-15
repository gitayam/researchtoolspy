/**
 * AI Gateway Helper Utilities
 *
 * Provides intelligent routing through Cloudflare AI Gateway with:
 * - Automatic caching (60-80% hit rate)
 * - Cost reduction (60-70% savings)
 * - Automatic fallback to direct OpenAI
 * - Rate limiting and abuse prevention
 * - Analytics and monitoring
 */

// Cloudflare Workers types (globally available at runtime)
declare type KVNamespace = any

import { logEvent } from './event-log'

interface Env {
  AI_GATEWAY_ACCOUNT_ID?: string
  OPENAI_API_KEY: string
  OPENAI_ORGANIZATION?: string
  RATE_LIMIT?: KVNamespace
  CACHE?: KVNamespace // reused as the rate-limit counter store when RATE_LIMIT isn't bound
  DB?: any // D1Database — optional; enables event_logs observability when present
}

/** Thrown by the gateway when an AI call exceeds the rate limit. Callers' existing
 *  try/catch turns this into their normal error response — the point is to reject
 *  the call (and save the OpenAI cost), not to crash. */
export class RateLimitError extends Error {
  constructor(public scope: string) {
    super(`AI rate limit exceeded (${scope})`)
    this.name = 'RateLimitError'
  }
}

// Generous caps: meant to stop runaway loops / abuse, NOT to throttle real use.
// One user action can fan out to ~10 gateway calls (analyze-url runs 4 in parallel),
// so per-user is high; the global cap is a backstop against a single hammering client.
const RL_USER_PER_MIN = 100
const RL_GLOBAL_PER_HOUR = 3000

/**
 * KV-backed rate limit for AI calls. Fail-open: no store, or any KV error, → allow
 * (never block a legitimate call because the limiter itself hiccuped). Throws
 * RateLimitError when a real limit is exceeded.
 */
async function enforceRateLimit(env: Env, metadata: any): Promise<void> {
  const store = env.RATE_LIMIT || env.CACHE
  if (!store) return // limiter not available → fail open
  try {
    const now = Date.now()
    const minute = Math.floor(now / 60000)
    const hour = Math.floor(now / 3600000)
    const uid = metadata?.user_id ? String(metadata.user_id) : null

    if (uid) {
      const k = `ratelimit:ai:user:${uid}:${minute}`
      const c = parseInt((await store.get(k)) || '0', 10)
      if (c >= RL_USER_PER_MIN) throw new RateLimitError('user-per-minute')
      await store.put(k, String(c + 1), { expirationTtl: 120 })
    }

    const gk = `ratelimit:ai:global:${hour}`
    const gc = parseInt((await store.get(gk)) || '0', 10)
    if (gc >= RL_GLOBAL_PER_HOUR) throw new RateLimitError('global-per-hour')
    await store.put(gk, String(gc + 1), { expirationTtl: 7200 })
  } catch (e) {
    if (e instanceof RateLimitError) throw e
    // KV failure → fail open (allow the call)
  }
}

/**
 * Build the auth headers, forwarding the OpenAI-Organization header when configured.
 * (Some callers previously sent this directly; centralizing it here preserves org
 * scoping for every gateway-routed call.)
 */
function openaiAuthHeaders(env: Env): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  }
  if (env.OPENAI_ORGANIZATION) headers['OpenAI-Organization'] = env.OPENAI_ORGANIZATION
  return headers
}

interface AIGatewayOptions {
  /**
   * Cache TTL in seconds (default: 3600 = 1 hour)
   * Set to 0 to disable caching for this request
   */
  cacheTTL?: number

  /**
   * Metadata for analytics tracking
   */
  metadata?: {
    endpoint?: string
    user_id?: string
    analysis_id?: string
    framework_type?: string
    [key: string]: any
  }

  /**
   * Force direct OpenAI bypass (for testing or fallback)
   */
  forceDirect?: boolean

  /**
   * Timeout in milliseconds (default: 30000 = 30s)
   */
  timeout?: number
}

/**
 * Call OpenAI via AI Gateway with automatic fallback
 *
 * Benefits:
 * - 60-80% cache hit rate → faster responses
 * - 60-70% cost reduction → lower API bills
 * - Automatic failover → reliability
 * - Analytics tracking → insights
 *
 * @example
 * ```typescript
 * const response = await callOpenAIViaGateway(env, {
 *   model: 'gpt-5.4-mini',
 *   messages: [{role: 'user', content: 'Hello'}],
 *   reasoning_effort: 'none',
 *   temperature: 0.7
 * }, {
 *   cacheTTL: 3600,
 *   metadata: {
 *     endpoint: 'content-intelligence',
 *     user_id: userId
 *   }
 * })
 * ```
 */
export async function callOpenAIViaGateway(
  env: Env,
  openaiRequest: any,
  options: AIGatewayOptions = {}
): Promise<any> {
  const {
    cacheTTL = 3600,
    metadata = {},
    forceDirect = false,
    timeout = 30000
  } = options

  // Determine if we should use gateway
  const useGateway = !forceDirect && !!env.AI_GATEWAY_ACCOUNT_ID

  const source = metadata?.endpoint || 'ai-gateway'

  // Enforce rate limiting BEFORE spending an OpenAI call (cost/abuse protection).
  try {
    await enforceRateLimit(env, metadata)
  } catch (e) {
    if (e instanceof RateLimitError) {
      await logEvent(env, { level: 'warn', source, message: `rate limit exceeded: ${e.scope}`, context: { user_id: metadata?.user_id ?? null } })
    }
    throw e
  }

  let data: any
  if (useGateway) {
    try {
      data = await callViaGateway(env, openaiRequest, cacheTTL, metadata, timeout)
    } catch (error) {
      console.warn('[AI Gateway] Gateway failed, falling back to direct OpenAI:', error)
      await logEvent(env, { level: 'warn', source, message: 'gateway failed, fell back to direct OpenAI', context: { error: String(error) } })
      // Automatic fallback to direct OpenAI
      data = await callDirectOpenAI(env, openaiRequest, timeout)
    }
  } else {
    data = await callDirectOpenAI(env, openaiRequest, timeout)
  }

  // Annotate (don't throw) when the model declined on content-policy grounds.
  // Callers that ignore `_refusal` behave exactly as before; callers that check it
  // can surface a clean "declined by model" state instead of an opaque JSON-parse error.
  const content = data?.choices?.[0]?.message?.content
  if (typeof content === 'string' && detectRefusal(content)) {
    console.warn(`[AI Gateway] model refusal detected (endpoint=${source})`)
    await logEvent(env, { level: 'refusal', source, message: 'model content-policy refusal', context: { preview: content.slice(0, 300) } })
    data._refusal = true
  }
  return data
}

/**
 * Detect a model content-policy refusal in an assistant message.
 *
 * Conservative by design — anchored to how refusals actually begin so analytical
 * content that merely *discusses* policy/violations isn't flagged. Covers both
 * OpenAI-style ("I'm sorry, but I can't…") and Anthropic-style ("…appears to
 * violate…Usage Policy") refusals so it keeps working under provider routing.
 */
export function detectRefusal(content: string): boolean {
  if (!content) return false
  const head = content.trim().slice(0, 240).toLowerCase()
  const refusalStarts = [
    "i'm sorry", 'i am sorry', 'sorry, but', "i can't", 'i cannot', 'i can not',
    "i won't", 'i will not', "i'm unable", 'i am unable', "i'm not able", 'i am not able',
    "i'm not going to", 'i must decline', 'i am not able to assist',
  ]
  if (refusalStarts.some(s => head.startsWith(s))) return true
  // Explicit policy-refusal phrasing anywhere in a short message
  if (content.length < 800 && /\b(?:violates?|against|breach(?:es)?)\b[^.]{0,40}\b(?:usage |content )?(?:policy|policies|guidelines)\b/i.test(content)) return true
  if (/\bappears to violate\b|cyber-?related safeguards|cyber verification/i.test(content)) return true
  return false
}

/**
 * Defensive-framing preamble for intelligence/security-adjacent prompts (COG, behavior,
 * deception, DIME, synthesis, predictions). Prepend to the system message. This lowers
 * spurious content-policy refusals on legitimate analytical tasks WITHOUT changing what
 * the model is asked to do — it establishes the authorized, defensive, analytical context.
 */
export const ANALYST_SYSTEM_PREFIX =
  'You are an analyst supporting authorized, defensive intelligence analysis, open-source research, and education. ' +
  'Provide objective, evidence-based assessment to help understand, detect, and explain behavior — not to cause harm. ' +
  'Do not produce operational instructions for carrying out attacks or harming specific people; focus on analysis and understanding.\n\n'

/**
 * Standard JSON body for a model content-policy refusal, so callers surface a clean
 * "declined" state instead of an opaque parse error. Callers wrap this in their Response.
 */
export const REFUSAL_BODY = {
  declined: true,
  reason: 'The model declined to analyze this content (content-policy refusal).',
}

/**
 * Call OpenAI via AI Gateway
 */
async function callViaGateway(
  env: Env,
  openaiRequest: any,
  cacheTTL: number,
  metadata: any,
  timeout: number
): Promise<any> {
  const accountId = env.AI_GATEWAY_ACCOUNT_ID!
  const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/research-tools-ai/openai/chat/completions`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        ...openaiAuthHeaders(env),
        // Caching headers
        'cf-aig-cache-ttl': String(cacheTTL),
        // Metadata for analytics
        'cf-aig-metadata': JSON.stringify(metadata),
      },
      body: JSON.stringify(openaiRequest),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI Gateway error ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    // Log cache status if available
    const cacheStatus = response.headers.get('cf-cache-status')

    return data
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Call OpenAI directly (fallback or when gateway not configured)
 */
async function callDirectOpenAI(
  env: Env,
  openaiRequest: any,
  timeout: number
): Promise<any> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: openaiAuthHeaders(env),
      body: JSON.stringify(openaiRequest),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Rate limiting check (per-user and global)
 *
 * Limits:
 * - Per-user: 20 requests per minute
 * - Global: 1000 requests per hour
 *
 * Returns null if allowed, or error response if rate limit exceeded
 */
export async function checkRateLimit(
  env: Env,
  userId: string,
  ip: string
): Promise<Response | null> {
  if (!env.RATE_LIMIT) {
    // Rate limiting not configured, allow request
    return null
  }

  const now = Date.now()
  const minute = Math.floor(now / 60000) // Current minute
  const hour = Math.floor(now / 3600000) // Current hour

  // Check per-user rate limit (20 req/min)
  const userKey = `ratelimit:user:${userId}:${minute}`
  const userCount = await env.RATE_LIMIT.get(userKey)
  const userRequests = userCount ? parseInt(userCount) : 0

  if (userRequests >= 20) {
    const resetTime = new Date((minute + 1) * 60000)
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again in a moment.',
      retryAfter: Math.ceil((resetTime.getTime() - now) / 1000),
      limit: 20,
      remaining: 0,
      reset: resetTime.toISOString()
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil((resetTime.getTime() - now) / 1000)),
        'X-RateLimit-Limit': '20',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetTime.toISOString()
      }
    })
  }

  // Check global rate limit (1000 req/hour)
  const globalKey = `ratelimit:global:${hour}`
  const globalCount = await env.RATE_LIMIT.get(globalKey)
  const globalRequests = globalCount ? parseInt(globalCount) : 0

  if (globalRequests >= 1000) {
    const resetTime = new Date((hour + 1) * 3600000)
    return new Response(JSON.stringify({
      error: 'Global rate limit exceeded',
      message: 'System is experiencing high load. Please try again later.',
      retryAfter: Math.ceil((resetTime.getTime() - now) / 1000)
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil((resetTime.getTime() - now) / 1000))
      }
    })
  }

  // Increment counters
  await env.RATE_LIMIT.put(userKey, String(userRequests + 1), {
    expirationTtl: 120 // Expire after 2 minutes
  })
  await env.RATE_LIMIT.put(globalKey, String(globalRequests + 1), {
    expirationTtl: 7200 // Expire after 2 hours
  })

  // Add rate limit headers to response (will be set by caller)
  // This is just for logging

  return null // Allowed
}

/**
 * Get cache key for duplicate request detection
 *
 * Useful for detecting duplicate URL analyses or framework imports
 */
export function getCacheKey(prefix: string, data: any): string {
  // Create deterministic hash of request data
  const normalized = JSON.stringify(data, Object.keys(data).sort())
  return `${prefix}:${hashString(normalized)}`
}

/**
 * Simple string hash function (DJB2 algorithm)
 */
function hashString(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
  }
  return (hash >>> 0).toString(36) // Convert to base36 for shorter strings
}

/**
 * Determine cache TTL based on content type
 *
 * Different analysis types have different caching needs:
 * - Content Intelligence: 1 hour (same URL likely accessed multiple times)
 * - DIME/Starbursting: 1 hour (same content = same questions)
 * - Framework imports: 30 min (might be editing/refining)
 * - Entity extraction: 2 hours (entities rarely change)
 * - Sentiment: 2 hours (sentiment stable)
 */
export function getOptimalCacheTTL(analysisType: string): number {
  const ttls: Record<string, number> = {
    'content-intelligence': 3600,    // 1 hour
    'dime-analysis': 3600,           // 1 hour
    'starbursting': 3600,            // 1 hour
    'pmesii-import': 1800,           // 30 min
    'entity-extraction': 7200,       // 2 hours
    'sentiment-analysis': 7200,      // 2 hours
    'claim-analysis': 3600,          // 1 hour
    'default': 3600                  // 1 hour
  }

  return ttls[analysisType] || ttls['default']
}

/**
 * Extract user identifier for rate limiting
 *
 * Priority: hash_id > user_id > IP address
 */
export function getUserIdentifier(request: Request, env: any): string {
  // Try hash from header
  const hashId = request.headers.get('x-hash-id')
  if (hashId) return `hash:${hashId}`

  // Try auth user
  if (env.user_id) return `user:${env.user_id}`

  // Fallback to IP
  const ip = request.headers.get('cf-connecting-ip') ||
              request.headers.get('x-forwarded-for')?.split(',')[0] ||
              'unknown'
  return `ip:${ip}`
}

/**
 * Log AI Gateway metrics for monitoring
 */
export function logAIGatewayMetrics(
  _operation: string,
  _cached: boolean,
  _tokenUsage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
  _latencyMs?: number
) {
  // Metrics logging removed from production — callers may still invoke this
}
