/**
 * CORS Middleware for Cloudflare Workers
 */

import { Env } from '../../../shared/types';

/**
 * Handle CORS preflight requests and add CORS headers
 */
export function corsMiddleware(request: Request, env: Env): Response {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = getAllowedOrigins(env);

  // Check if origin is allowed
  const isAllowed = allowedOrigins.includes('*') ||
    allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        // Handle wildcard subdomains
        const pattern = allowed.replace('*', '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      }
      return allowed === origin;
    });

  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Content-Type, Authorization, X-Request-ID',
    'Access-Control-Max-Age': '86400', // 24 hours
  };

  if (isAllowed) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
    corsHeaders['Access-Control-Allow-Credentials'] = 'true';
  } else if (env.ENVIRONMENT !== 'production') {
    // In development, allow any origin
    corsHeaders['Access-Control-Allow-Origin'] = origin || '*';
    corsHeaders['Access-Control-Allow-Credentials'] = 'true';
  }

  // Return response for OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // For non-OPTIONS requests, return headers to be added to response
  return new Response(null, {
    headers: corsHeaders,
  });
}

/**
 * Get allowed origins based on environment
 */
function getAllowedOrigins(env: Env): string[] {
  if (env.ENVIRONMENT === 'production') {
    return [
      'https://researchtoolspy.com',
      'https://www.researchtoolspy.com',
      'https://app.researchtoolspy.com',
      'https://*.researchtoolspy.com',
    ];
  } else if (env.ENVIRONMENT === 'staging') {
    return [
      'https://staging.researchtoolspy.com',
      'https://*.staging.researchtoolspy.com',
      'http://localhost:3000',
      'http://localhost:3001',
    ];
  } else {
    // Development - allow localhost
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://localhost:5173', // Vite default
      'http://127.0.0.1:5173',
    ];
  }
}

/**
 * Add CORS headers to a response
 */
export function addCorsHeaders(
  response: Response,
  request: Request,
  env: Env
): Response {
  const corsResponse = corsMiddleware(request, env);
  const corsHeaders = Object.fromEntries(corsResponse.headers);

  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    if (value) newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}