// Cloudflare Pages Functions Middleware
// Handles CORS and common request processing

export async function onRequest(context: any) {
  const { request, next } = context

  // CORS headers for all API requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  // Handle OPTIONS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }

  // Process the request
  const response = await next()

  // Add CORS headers to response
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}