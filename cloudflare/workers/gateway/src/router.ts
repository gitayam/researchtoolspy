/**
 * Main router for API Gateway
 * Routes requests to appropriate service workers or handlers
 */

import { Env, AuthRequest } from '../../shared/types';
import { handleHealthCheck } from './index';
import { createErrorResponse } from './middleware/errorHandler';
import { addRateLimitHeaders } from './middleware/rateLimit';

/**
 * Main router function
 */
export async function router(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Health check
  if (path === '/api/v1/health' || path === '/health') {
    return handleHealthCheck(env);
  }

  // API version check
  if (!path.startsWith('/api/v1/')) {
    return createErrorResponse(404, 'API version not found. Use /api/v1/', 'VERSION_NOT_FOUND');
  }

  // Route to appropriate service
  try {
    // Auth service routes
    if (path.startsWith('/api/v1/auth/')) {
      return routeToAuthService(request, env, ctx);
    }

    // Framework service routes
    if (path.startsWith('/api/v1/frameworks/')) {
      return routeToFrameworkService(request, env, ctx);
    }

    // Research tools routes
    if (path.startsWith('/api/v1/tools/')) {
      return routeToToolsService(request, env, ctx);
    }

    // User management routes
    if (path.startsWith('/api/v1/users/')) {
      return routeToUsersService(request, env, ctx);
    }

    // AI service routes
    if (path.startsWith('/api/v1/ai/')) {
      return routeToAIService(request, env, ctx);
    }

    // Export service routes
    if (path.startsWith('/api/v1/export/')) {
      return routeToExportService(request, env, ctx);
    }

    // Analytics routes
    if (path.startsWith('/api/v1/analytics/')) {
      return routeToAnalyticsService(request, env, ctx);
    }

    // Citations routes
    if (path.startsWith('/api/v1/citations/')) {
      return routeToCitationsService(request, env, ctx);
    }

    // Jobs routes
    if (path.startsWith('/api/v1/jobs/')) {
      return routeToJobsService(request, env, ctx);
    }

    // No matching route
    return createErrorResponse(404, 'Endpoint not found', 'ENDPOINT_NOT_FOUND');

  } catch (error) {
    console.error('Routing error:', error);
    return createErrorResponse(500, 'Internal routing error', 'ROUTING_ERROR');
  }
}

/**
 * Route to Auth Service Worker
 */
async function routeToAuthService(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // If AUTH_SERVICE binding exists, use it
  if (env.AUTH_SERVICE) {
    return env.AUTH_SERVICE.fetch(request);
  }

  // Otherwise, handle locally
  const { authRouter } = await import('./routes/auth');
  return authRouter(request, env, ctx);
}

/**
 * Route to Framework Service Workers
 */
async function routeToFrameworkService(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const frameworkType = pathParts[4]; // /api/v1/frameworks/{type}

  // Map to specific framework service if bound
  const serviceBindings: Record<string, Fetcher | undefined> = {
    'swot': env.SWOT_SERVICE,
    'ach': env.ACH_SERVICE,
    'behavioral': env.BEHAVIORAL_SERVICE,
    'deception': env.DECEPTION_SERVICE,
    'dotmlpf': env.DOTMLPF_SERVICE,
    'pmesii-pt': env.PMESII_SERVICE,
    'dime': env.DIME_SERVICE,
    'pest': env.PEST_SERVICE,
    'vrio': env.VRIO_SERVICE,
    'stakeholder': env.STAKEHOLDER_SERVICE,
    'trend': env.TREND_SERVICE,
    'surveillance': env.SURVEILLANCE_SERVICE,
    'causeway': env.CAUSEWAY_SERVICE,
    'cog': env.COG_SERVICE,
    'starbursting': env.STARBURSTING_SERVICE,
    'fundamental-flow': env.FLOW_SERVICE,
  };

  const service = serviceBindings[frameworkType];
  if (service) {
    return service.fetch(request);
  }

  // Handle locally if service not bound
  const { frameworkRouter } = await import('./routes/frameworks');
  return frameworkRouter(request, env, ctx);
}

/**
 * Route to Research Tools Service
 */
async function routeToToolsService(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  if (env.TOOLS_SERVICE) {
    return env.TOOLS_SERVICE.fetch(request);
  }

  const { toolsRouter } = await import('./routes/tools');
  return toolsRouter(request, env, ctx);
}

/**
 * Route to Users Service
 */
async function routeToUsersService(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  if (env.USERS_SERVICE) {
    return env.USERS_SERVICE.fetch(request);
  }

  const { usersRouter } = await import('./routes/users');
  return usersRouter(request, env, ctx);
}

/**
 * Route to AI Service
 */
async function routeToAIService(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  if (env.AI_SERVICE) {
    return env.AI_SERVICE.fetch(request);
  }

  const { aiRouter } = await import('./routes/ai');
  return aiRouter(request, env, ctx);
}

/**
 * Route to Export Service
 */
async function routeToExportService(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  if (env.EXPORT_SERVICE) {
    return env.EXPORT_SERVICE.fetch(request);
  }

  const { exportRouter } = await import('./routes/export');
  return exportRouter(request, env, ctx);
}

/**
 * Route to Analytics Service
 */
async function routeToAnalyticsService(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  if (env.ANALYTICS_SERVICE) {
    return env.ANALYTICS_SERVICE.fetch(request);
  }

  const { analyticsRouter } = await import('./routes/analytics');
  return analyticsRouter(request, env, ctx);
}

/**
 * Route to Citations Service
 */
async function routeToCitationsService(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const { citationsRouter } = await import('./routes/citations');
  return citationsRouter(request, env, ctx);
}

/**
 * Route to Jobs Service
 */
async function routeToJobsService(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const { jobsRouter } = await import('./routes/jobs');
  return jobsRouter(request, env, ctx);
}

/**
 * Service health check
 */
export async function checkServiceHealth(
  serviceName: string,
  service: Fetcher
): Promise<boolean> {
  try {
    const response = await service.fetch(
      new Request('https://internal/health', {
        method: 'GET',
      })
    );
    return response.status === 200;
  } catch (error) {
    console.error(`Health check failed for ${serviceName}:`, error);
    return false;
  }
}

/**
 * Get all available services
 */
export function getAvailableServices(env: Env): string[] {
  const services: string[] = ['gateway'];

  if (env.AUTH_SERVICE) services.push('auth');
  if (env.SWOT_SERVICE) services.push('swot');
  if (env.ACH_SERVICE) services.push('ach');
  if (env.BEHAVIORAL_SERVICE) services.push('behavioral');
  if (env.DECEPTION_SERVICE) services.push('deception');
  if (env.DOTMLPF_SERVICE) services.push('dotmlpf');
  if (env.TOOLS_SERVICE) services.push('tools');
  if (env.AI_SERVICE) services.push('ai');
  if (env.EXPORT_SERVICE) services.push('export');
  if (env.ANALYTICS_SERVICE) services.push('analytics');
  if (env.USERS_SERVICE) services.push('users');

  return services;
}