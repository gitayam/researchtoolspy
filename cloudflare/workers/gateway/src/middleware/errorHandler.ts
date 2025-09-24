/**
 * Error Handler Middleware for Cloudflare Workers
 */

import { APIError, ValidationError } from '../../../shared/types';

interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  requestId?: string;
  details?: any;
  status?: number;
}

/**
 * Global error handler
 */
export function errorHandler(
  error: Error | APIError,
  requestId?: string
): ErrorResponse {
  console.error('Error:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    requestId,
  });

  // Handle known error types
  if (error instanceof APIError) {
    return {
      error: error.name,
      message: error.message,
      code: error.code,
      requestId,
      status: error.status,
    };
  }

  if (error instanceof ValidationError) {
    return {
      error: 'Validation Error',
      message: error.message,
      code: 'VALIDATION_FAILED',
      details: error.fields,
      requestId,
      status: 400,
    };
  }

  // Handle SyntaxError (usually JSON parsing errors)
  if (error instanceof SyntaxError) {
    return {
      error: 'Invalid Request',
      message: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
      requestId,
      status: 400,
    };
  }

  // Handle TypeError
  if (error instanceof TypeError) {
    return {
      error: 'Type Error',
      message: 'Invalid data type in request',
      code: 'TYPE_ERROR',
      requestId,
      status: 400,
    };
  }

  // Handle D1 Database errors
  if (error.message?.includes('D1_ERROR')) {
    return {
      error: 'Database Error',
      message: 'A database error occurred',
      code: 'DATABASE_ERROR',
      requestId,
      status: 500,
    };
  }

  // Handle KV errors
  if (error.message?.includes('KV namespace')) {
    return {
      error: 'Cache Error',
      message: 'A caching error occurred',
      code: 'CACHE_ERROR',
      requestId,
      status: 500,
    };
  }

  // Handle R2 errors
  if (error.message?.includes('R2')) {
    return {
      error: 'Storage Error',
      message: 'A storage error occurred',
      code: 'STORAGE_ERROR',
      requestId,
      status: 500,
    };
  }

  // Default error response
  return {
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    requestId,
    status: 500,
  };
}

/**
 * Create error response
 */
export function createErrorResponse(
  status: number,
  message: string,
  code?: string,
  details?: any,
  requestId?: string
): Response {
  const errorBody: ErrorResponse = {
    error: getErrorName(status),
    message,
    code: code || getErrorCode(status),
    requestId,
    details,
  };

  return new Response(JSON.stringify(errorBody), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(requestId ? { 'X-Request-ID': requestId } : {}),
    },
  });
}

/**
 * Get error name from status code
 */
function getErrorName(status: number): string {
  const errorNames: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };

  return errorNames[status] || 'Error';
}

/**
 * Get error code from status code
 */
function getErrorCode(status: number): string {
  const errorCodes: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'RATE_LIMIT_EXCEEDED',
    500: 'INTERNAL_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT',
  };

  return errorCodes[status] || 'UNKNOWN_ERROR';
}

/**
 * Wrap async handler with error handling
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R | Response> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      const requestId = (args[0] as any)?.requestId;
      const errorResponse = errorHandler(error as Error, requestId);
      return createErrorResponse(
        errorResponse.status || 500,
        errorResponse.message,
        errorResponse.code,
        errorResponse.details,
        requestId
      );
    }
  };
}

/**
 * Validate request body against a schema
 */
export function validateRequestBody(
  body: any,
  schema: Record<string, any>
): ValidationError | null {
  const errors: Record<string, string[]> = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = body[field];
    const fieldErrors: string[] = [];

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      fieldErrors.push(`${field} is required`);
    }

    // Type check
    if (value !== undefined && value !== null && rules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        fieldErrors.push(`${field} must be of type ${rules.type}`);
      }
    }

    // Min length check
    if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
      fieldErrors.push(`${field} must be at least ${rules.minLength} characters`);
    }

    // Max length check
    if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
      fieldErrors.push(`${field} must be at most ${rules.maxLength} characters`);
    }

    // Pattern check
    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      fieldErrors.push(`${field} has invalid format`);
    }

    // Custom validation
    if (rules.validate && typeof rules.validate === 'function') {
      const customError = rules.validate(value);
      if (customError) {
        fieldErrors.push(customError);
      }
    }

    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
    }
  }

  if (Object.keys(errors).length > 0) {
    return new ValidationError('Validation failed', errors);
  }

  return null;
}