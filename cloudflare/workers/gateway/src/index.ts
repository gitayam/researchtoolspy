/**
 * API Gateway Worker - Main entry point for ResearchToolsPy API
 * Routes requests to appropriate service workers and handles cross-cutting concerns
 */

import { Env, APIResponse, AuthRequest } from '../../shared/types';
import { corsMiddleware } from './middleware/cors';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import { router } from './router';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    // Add request ID to headers
    const headers = new Headers(request.headers);
    headers.set('X-Request-ID', requestId);

    // Clone request with new headers
    const enrichedRequest = new Request(request.url, {
      method: request.method,
      headers,
      body: request.body,
    }) as AuthRequest;

    // Store environment and context on request for middleware
    (enrichedRequest as any).env = env;
    (enrichedRequest as any).ctx = ctx;
    (enrichedRequest as any).requestId = requestId;
    (enrichedRequest as any).startTime = startTime;

    try {
      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return corsMiddleware(request, env);
      }

      // Apply middleware chain
      let response: Response;

      // 1. CORS headers
      const corsHeaders = getCorsHeaders(env);

      // 2. Rate limiting (skip for health checks)
      if (!request.url.includes('/health')) {
        const rateLimitResponse = await rateLimitMiddleware(enrichedRequest, env);
        if (rateLimitResponse) {
          return new Response(rateLimitResponse.body, {
            status: rateLimitResponse.status,
            headers: {
              ...Object.fromEntries(rateLimitResponse.headers),
              ...corsHeaders,
            },
          });
        }
      }

      // 3. Authentication (for protected routes)
      const isPublicRoute = isPublicEndpoint(request.url);
      if (!isPublicRoute) {
        const authResponse = await authMiddleware(enrichedRequest, env);
        if (authResponse instanceof Response) {
          return new Response(authResponse.body, {
            status: authResponse.status,
            headers: {
              ...Object.fromEntries(authResponse.headers),
              ...corsHeaders,
            },
          });
        }
      }

      // 4. Route request to appropriate handler
      response = await router(enrichedRequest, env, ctx);

      // 5. Add CORS headers to response
      const finalHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        finalHeaders.set(key, value);
      });

      // 6. Add performance metrics
      finalHeaders.set('X-Request-ID', requestId);
      finalHeaders.set('X-Processing-Time', `${Date.now() - startTime}ms`);

      // 7. Log request (async, don't await)
      ctx.waitUntil(
        requestLogger(enrichedRequest, response, env, {
          requestId,
          processingTime: Date.now() - startTime,
        })
      );

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: finalHeaders,
      });

    } catch (error) {
      // Error handling
      console.error('Gateway error:', error);
      const errorResponse = errorHandler(error as Error, requestId);

      return new Response(JSON.stringify(errorResponse), {
        status: errorResponse.status || 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(env),
          'X-Request-ID': requestId,
        },
      });
    }
  },
};

/**
 * Get CORS headers based on environment
 */
function getCorsHeaders(env: Env): Record<string, string> {
  const allowedOrigins = env.ENVIRONMENT === 'production'
    ? [
        'https://researchtoolspy.com',
        'https://www.researchtoolspy.com',
        'https://app.researchtoolspy.com',
      ]
    : ['http://localhost:3000', 'http://localhost:3001'];

  return {
    'Access-Control-Allow-Origin': allowedOrigins[0], // TODO: Check origin header
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Check if the endpoint is public (no auth required)
 */
function isPublicEndpoint(url: string): boolean {
  const publicPaths = [
    '/api/v1/health',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/v1/auth/anonymous',
    '/api/v1/public',
  ];

  const urlPath = new URL(url).pathname;
  return publicPaths.some(path => urlPath.startsWith(path));
}

/**
 * Health check endpoint (built into gateway)
 */
export async function handleHealthCheck(env: Env): Promise<Response> {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'development',
    services: {
      database: 'checking',
      cache: 'checking',
      storage: 'checking',
    },
  };

  // Check D1 database
  try {
    const result = await env.DB.prepare('SELECT 1 as health').first();
    health.services.database = result ? 'healthy' : 'unhealthy';
  } catch (error) {
    health.services.database = 'unhealthy';
    health.status = 'degraded';
  }

  // Check KV namespace
  try {
    await env.SESSIONS.put('health-check', Date.now().toString(), {
      expirationTtl: 10,
    });
    health.services.cache = 'healthy';
  } catch (error) {
    health.services.cache = 'unhealthy';
    health.status = 'degraded';
  }

  // Check R2 bucket if available
  if (env.DOCUMENTS) {
    try {
      await env.DOCUMENTS.head('health-check');
      health.services.storage = 'healthy';
    } catch (error) {
      // File doesn't exist is ok, connection error is not
      health.services.storage = error.message.includes('NoSuchKey') ? 'healthy' : 'unhealthy';
    }
  } else {
    health.services.storage = 'not configured';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;

  return new Response(JSON.stringify(health), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}