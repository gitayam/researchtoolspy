/**
 * Shared response utilities for Cloudflare Workers
 */

import { APIResponse } from './types';

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T = any>(
  data: T,
  message?: string,
  metadata?: Record<string, any>
): Response {
  const response: APIResponse<T> = {
    success: true,
    data,
    message,
    metadata: {
      timestamp: Date.now(),
      requestId: crypto.randomUUID(),
      ...metadata,
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  status: number,
  message: string,
  code?: string,
  details?: any
): Response {
  const response: APIResponse = {
    success: false,
    error: message,
    message: code,
    metadata: {
      timestamp: Date.now(),
      requestId: crypto.randomUUID(),
      details,
    },
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T = any>(
  items: T[],
  page: number,
  pageSize: number,
  total: number
): Response {
  const totalPages = Math.ceil(total / pageSize);

  const response = {
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
    metadata: {
      timestamp: Date.now(),
      requestId: crypto.randomUUID(),
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

/**
 * Create a redirect response
 */
export function createRedirectResponse(url: string, permanent = false): Response {
  return new Response(null, {
    status: permanent ? 301 : 302,
    headers: {
      'Location': url,
    },
  });
}

/**
 * Create a no content response
 */
export function createNoContentResponse(): Response {
  return new Response(null, {
    status: 204,
  });
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(
  errors: Record<string, string[]>
): Response {
  return createErrorResponse(
    400,
    'Validation failed',
    'VALIDATION_ERROR',
    { fields: errors }
  );
}

/**
 * Create an unauthorized response
 */
export function createUnauthorizedResponse(message = 'Authentication required'): Response {
  return createErrorResponse(401, message, 'UNAUTHORIZED');
}

/**
 * Create a forbidden response
 */
export function createForbiddenResponse(message = 'Access denied'): Response {
  return createErrorResponse(403, message, 'FORBIDDEN');
}

/**
 * Create a not found response
 */
export function createNotFoundResponse(resource = 'Resource'): Response {
  return createErrorResponse(404, `${resource} not found`, 'NOT_FOUND');
}

/**
 * Create a conflict response
 */
export function createConflictResponse(message: string): Response {
  return createErrorResponse(409, message, 'CONFLICT');
}

/**
 * Create a rate limit response
 */
export function createRateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Too many requests',
      message: 'RATE_LIMIT_EXCEEDED',
      metadata: {
        timestamp: Date.now(),
        requestId: crypto.randomUUID(),
        retryAfter,
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': (Date.now() + retryAfter * 1000).toString(),
      },
    }
  );
}

/**
 * Create an internal server error response
 */
export function createInternalErrorResponse(
  message = 'Internal server error',
  error?: Error
): Response {
  const response: APIResponse = {
    success: false,
    error: message,
    message: 'INTERNAL_ERROR',
    metadata: {
      timestamp: Date.now(),
      requestId: crypto.randomUUID(),
    },
  };

  // In development, include error details
  if (process.env.ENVIRONMENT === 'development' && error) {
    response.metadata!.errorDetails = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return new Response(JSON.stringify(response), {
    status: 500,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

/**
 * Create a service unavailable response
 */
export function createServiceUnavailableResponse(
  message = 'Service temporarily unavailable',
  retryAfter = 60
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      message: 'SERVICE_UNAVAILABLE',
      metadata: {
        timestamp: Date.now(),
        requestId: crypto.randomUUID(),
        retryAfter,
      },
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}