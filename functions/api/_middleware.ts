// Cloudflare Pages Functions Middleware
// Handles CORS, common request processing, and basic Rate Limiting

// Simple in-memory rate limiter (per isolate)
const rateLimit = new Map<string, { count: number, resetTime: number }>()

export async function onRequest(context: any) {
  const { request, next } = context
  const url = new URL(request.url)

  // CORS headers for all API requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
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
      return new Response(JSON.stringify({ error: 'Too many login attempts. Please try again later.' }), {
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

  // Process the request
  const response = await next()

  // Add CORS headers to response
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}