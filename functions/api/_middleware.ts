// Cloudflare Pages Functions Middleware
// Handles CORS, common request processing, and basic Rate Limiting

// Simple in-memory rate limiter (per isolate)
const rateLimit = new Map<string, { count: number, resetTime: number }>()

export async function onRequest(context: any) {
  const { request, next } = context
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

  // Handle OPTIONS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }

  // Basic Rate Limiting for Auth Endpoints
  if (url.pathname.includes('/hash-auth/authenticate') && request.method === 'POST') {
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown'
    const now = Date.now()
    const limit = 5
    const windowMs = 60 * 1000

    const record = rateLimit.get(clientIp) || { count: 0, resetTime: now + windowMs }

    if (now > record.resetTime) {
      record.count = 0
      record.resetTime = now + windowMs
    }

    if (record.count >= limit) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      })
    }

    record.count++
    rateLimit.set(clientIp, record)
  }

  // Rate limiting for AI endpoints (prevent OpenAI billing abuse)
  const aiPaths = ['/api/ai/', '/api/ach/generate', '/api/ach/from-content', '/api/equilibrium-analysis/analyze', '/api/content-intelligence/analyze-url', '/api/surveys/']
  const isAiEndpoint = request.method === 'POST' && aiPaths.some(p => url.pathname.includes(p))
  if (isAiEndpoint) {
    const userHash = request.headers.get('X-User-Hash') || request.headers.get('CF-Connecting-IP') || 'unknown'
    const rateLimitKey = `ai:${userHash}`
    const now = Date.now()
    const limit = 30 // 30 AI requests per minute per user
    const windowMs = 60 * 1000

    const record = rateLimit.get(rateLimitKey) || { count: 0, resetTime: now + windowMs }

    if (now > record.resetTime) {
      record.count = 0
      record.resetTime = now + windowMs
    }

    if (record.count >= limit) {
      return new Response(JSON.stringify({ error: 'AI rate limit exceeded. Please wait before making more requests.' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      })
    }

    record.count++
    rateLimit.set(rateLimitKey, record)
  }

  // Rate limiting for guest user creation (prevent DB flooding)
  if (request.headers.get('X-User-Hash') && !request.headers.get('Authorization')) {
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown'
    const rateLimitKey = `guest:${clientIp}`
    const now = Date.now()
    const limit = 10 // 10 new guest sessions per minute per IP
    const windowMs = 60 * 1000

    const record = rateLimit.get(rateLimitKey) || { count: 0, resetTime: now + windowMs }

    if (now > record.resetTime) {
      record.count = 0
      record.resetTime = now + windowMs
    }

    if (record.count >= limit) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      })
    }

    record.count++
    rateLimit.set(rateLimitKey, record)
  }

  // Rate limiting for public password verification endpoints
  if ((url.pathname.includes('/intake/') && url.pathname.includes('/verify-password')) && request.method === 'POST') {
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown'
    const rateLimitKey = `pwd:${clientIp}`
    const now = Date.now()
    const limit = 10
    const windowMs = 60 * 1000

    const record = rateLimit.get(rateLimitKey) || { count: 0, resetTime: now + windowMs }

    if (now > record.resetTime) {
      record.count = 0
      record.resetTime = now + windowMs
    }

    if (record.count >= limit) {
      return new Response(JSON.stringify({ error: 'Too many attempts. Please try again later.' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      })
    }

    record.count++
    rateLimit.set(rateLimitKey, record)
  }

  // Process the request
  const response = await next()

  // Add CORS headers to response
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}