/**
 * Rate Limiting Middleware using Cloudflare KV
 */

import { Env, RateLimitError } from '../../../shared/types';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

/**
 * Rate limit middleware
 */
export async function rateLimitMiddleware(
  request: Request,
  env: Env
): Promise<Response | null> {
  const config = getRateLimitConfig(request, env);
  const key = getRateLimitKey(request);

  try {
    // Get current count from KV
    const currentCount = await env.RATE_LIMITS.get(key);
    const count = currentCount ? parseInt(currentCount, 10) : 0;

    // Check if limit exceeded
    if (count >= config.maxRequests) {
      const retryAfter = Math.ceil(config.windowMs / 1000);
      return createRateLimitResponse(retryAfter, config);
    }

    // Increment counter
    const newCount = count + 1;
    const ttl = Math.ceil(config.windowMs / 1000); // Convert to seconds

    await env.RATE_LIMITS.put(key, newCount.toString(), {
      expirationTtl: ttl,
    });

    // Add rate limit headers to request for later use
    (request as any).rateLimitInfo = {
      limit: config.maxRequests,
      remaining: config.maxRequests - newCount,
      reset: Date.now() + config.windowMs,
    };

    return null; // Continue processing
  } catch (error) {
    console.error('Rate limit error:', error);
    // On error, allow the request to proceed
    return null;
  }
}

/**
 * Get rate limit configuration based on request and environment
 */
function getRateLimitConfig(request: Request, env: Env): RateLimitConfig {
  const url = new URL(request.url);
  const path = url.pathname;

  // Different limits for different endpoints
  if (path.startsWith('/api/v1/auth/login')) {
    // Stricter limit for login attempts
    return {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
    };
  }

  if (path.startsWith('/api/v1/auth/register')) {
    // Limit registration attempts
    return {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
    };
  }

  if (path.startsWith('/api/v1/ai/')) {
    // Limit AI API calls
    return {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10,
    };
  }

  if (path.startsWith('/api/v1/export/')) {
    // Limit export operations
    return {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5,
    };
  }

  // Default rate limit
  const defaultLimit = env.ENVIRONMENT === 'production' ? 100 : 1000;
  return {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: defaultLimit,
  };
}

/**
 * Generate rate limit key based on IP and optionally user ID
 */
function getRateLimitKey(request: Request): string {
  const url = new URL(request.url);
  const path = url.pathname;

  // Get client IP
  const ip = request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0] ||
    request.headers.get('X-Real-IP') ||
    'unknown';

  // For authenticated routes, also include user ID if available
  const userId = (request as any).user?.id || '';

  // Create key based on path, IP, and optionally user ID
  const baseKey = `rate_limit:${path}:${ip}`;
  return userId ? `${baseKey}:${userId}` : baseKey;
}

/**
 * Create rate limit exceeded response
 */
function createRateLimitResponse(
  retryAfter: number,
  config: RateLimitConfig
): Response {
  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
      retryAfter,
      limit: config.maxRequests,
      window: config.windowMs / 1000,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': (Date.now() + config.windowMs).toString(),
      },
    }
  );
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: Response,
  request: Request
): Response {
  const rateLimitInfo = (request as any).rateLimitInfo;
  if (!rateLimitInfo) return response;

  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', rateLimitInfo.limit.toString());
  headers.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
  headers.set('X-RateLimit-Reset', rateLimitInfo.reset.toString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Clear rate limit for a specific key (useful for testing or admin actions)
 */
export async function clearRateLimit(
  key: string,
  env: Env
): Promise<void> {
  try {
    await env.RATE_LIMITS.delete(key);
  } catch (error) {
    console.error('Error clearing rate limit:', error);
  }
}

/**
 * Get current rate limit status for a key
 */
export async function getRateLimitStatus(
  key: string,
  env: Env,
  config: RateLimitConfig
): Promise<{
  count: number;
  remaining: number;
  resetAt: number;
}> {
  try {
    const currentCount = await env.RATE_LIMITS.get(key);
    const count = currentCount ? parseInt(currentCount, 10) : 0;

    return {
      count,
      remaining: Math.max(0, config.maxRequests - count),
      resetAt: Date.now() + config.windowMs,
    };
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    return {
      count: 0,
      remaining: config.maxRequests,
      resetAt: Date.now() + config.windowMs,
    };
  }
}