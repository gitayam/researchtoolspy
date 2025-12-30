// Cloudflare Pages Function for SPA routing
// This handles all routes and serves index.html for client-side routing

export async function onRequest(context: any) {
  const { request, next, env } = context
  const url = new URL(request.url)

  // Let API routes pass through
  if (url.pathname.startsWith('/api/')) {
    return next()
  }

  // Let asset files pass through (CSS, JS, images, etc.)
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json|txt|xml)$/)) {
    return next()
  }

  // For all other routes, serve index.html for client-side routing
  try {
    const response = await env.ASSETS.fetch(new URL('/index.html', url.origin))
    return new Response(response.body, {
      status: 200,
      headers: response.headers
    })
  } catch (error) {
    return next()
  }
}
