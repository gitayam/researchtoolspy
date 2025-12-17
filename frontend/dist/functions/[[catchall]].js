// Cloudflare Pages Functions catch-all handler for Next.js
// This handles dynamic routes and server-side rendering

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  // For static assets, pass through to the static files
  if (url.pathname.includes('/_next/') ||
      url.pathname.includes('/static/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.json') ||
      url.pathname.endsWith('.ico') ||
      url.pathname.includes('/images/')) {
    return env.ASSETS.fetch(request);
  }

  // For API routes, proxy to the gateway worker
  if (url.pathname.startsWith('/api/')) {
    const apiUrl = `https://researchtoolspy-gateway-dev.wemea-5ahhf.workers.dev${url.pathname}${url.search}`;
    return fetch(apiUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
  }

  // Try to serve the static file first
  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }

  // For dynamic routes, return the base HTML and let client-side routing handle it
  const htmlPath = url.pathname.endsWith('/') ? `${url.pathname}index.html` : `${url.pathname}.html`;
  const htmlResponse = await env.ASSETS.fetch(new Request(`${url.origin}${htmlPath}`, request));

  if (htmlResponse.status !== 404) {
    return htmlResponse;
  }

  // Fallback to the root index.html for client-side routing
  return env.ASSETS.fetch(new Request(`${url.origin}/index.html`, request));
}