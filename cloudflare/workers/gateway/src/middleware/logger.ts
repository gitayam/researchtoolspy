/**
 * Request Logger Middleware for Cloudflare Workers
 */

import { Env } from '../../../shared/types';
import { createDatabase } from '../../../shared/database';

interface LogEntry {
  requestId: string;
  method: string;
  url: string;
  path: string;
  statusCode: number;
  processingTime: number;
  userAgent?: string;
  ip?: string;
  userId?: number;
  error?: string;
  timestamp: string;
}

/**
 * Log request to D1 database
 */
export async function requestLogger(
  request: Request,
  response: Response,
  env: Env,
  metadata: {
    requestId: string;
    processingTime: number;
  }
): Promise<void> {
  try {
    const url = new URL(request.url);
    const logEntry: LogEntry = {
      requestId: metadata.requestId,
      method: request.method,
      url: url.href,
      path: url.pathname,
      statusCode: response.status,
      processingTime: metadata.processingTime,
      userAgent: request.headers.get('User-Agent') || undefined,
      ip: request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For')?.split(',')[0] ||
        request.headers.get('X-Real-IP') ||
        undefined,
      userId: (request as any).user?.id,
      timestamp: new Date().toISOString(),
    };

    // Log errors for 4xx and 5xx responses
    if (response.status >= 400) {
      try {
        const responseBody = await response.clone().text();
        const errorData = JSON.parse(responseBody);
        logEntry.error = errorData.message || errorData.error;
      } catch {
        // Ignore parsing errors
      }
    }

    // Store in KV for quick access (with TTL)
    const logKey = `log:${metadata.requestId}`;
    await env.CACHE.put(logKey, JSON.stringify(logEntry), {
      expirationTtl: 86400, // 24 hours
    });

    // Store aggregated metrics
    await storeMetrics(logEntry, env);

    // For production, also send to analytics
    if (env.ENVIRONMENT === 'production') {
      await sendToAnalytics(logEntry, env);
    }

    // Log to console in development
    if (env.ENVIRONMENT !== 'production') {
      console.log('Request Log:', logEntry);
    }
  } catch (error) {
    // Don't let logging errors affect the response
    console.error('Logging error:', error);
  }
}

/**
 * Store aggregated metrics in KV
 */
async function storeMetrics(
  logEntry: LogEntry,
  env: Env
): Promise<void> {
  try {
    const metricsKey = `metrics:${new Date().toISOString().split('T')[0]}`;
    const existingMetrics = await env.CACHE.get(metricsKey);

    const metrics = existingMetrics ? JSON.parse(existingMetrics) : {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      endpoints: {},
      statusCodes: {},
      userAgents: {},
    };

    // Update metrics
    metrics.totalRequests++;
    if (logEntry.statusCode < 400) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    // Update average response time
    metrics.avgResponseTime =
      (metrics.avgResponseTime * (metrics.totalRequests - 1) + logEntry.processingTime) /
      metrics.totalRequests;

    // Track per-endpoint metrics
    if (!metrics.endpoints[logEntry.path]) {
      metrics.endpoints[logEntry.path] = {
        count: 0,
        avgTime: 0,
        errors: 0,
      };
    }
    const endpointMetrics = metrics.endpoints[logEntry.path];
    endpointMetrics.count++;
    endpointMetrics.avgTime =
      (endpointMetrics.avgTime * (endpointMetrics.count - 1) + logEntry.processingTime) /
      endpointMetrics.count;
    if (logEntry.statusCode >= 400) {
      endpointMetrics.errors++;
    }

    // Track status codes
    metrics.statusCodes[logEntry.statusCode] =
      (metrics.statusCodes[logEntry.statusCode] || 0) + 1;

    // Track user agents
    if (logEntry.userAgent) {
      const browser = getBrowserFromUserAgent(logEntry.userAgent);
      metrics.userAgents[browser] = (metrics.userAgents[browser] || 0) + 1;
    }

    // Store updated metrics
    await env.CACHE.put(metricsKey, JSON.stringify(metrics), {
      expirationTtl: 604800, // 7 days
    });
  } catch (error) {
    console.error('Metrics storage error:', error);
  }
}

/**
 * Send log entry to analytics service
 */
async function sendToAnalytics(
  logEntry: LogEntry,
  env: Env
): Promise<void> {
  try {
    // Store in database for long-term analytics
    const db = createDatabase(env);
    await db.insert('usage_metrics', {
      user_id: logEntry.userId || null,
      metric_type: 'api_request',
      metric_value: JSON.stringify({
        method: logEntry.method,
        path: logEntry.path,
        statusCode: logEntry.statusCode,
        processingTime: logEntry.processingTime,
      }),
      session_id: logEntry.requestId,
      ip_address: logEntry.ip,
      user_agent: logEntry.userAgent,
    });
  } catch (error) {
    console.error('Analytics error:', error);
  }
}

/**
 * Extract browser from user agent string
 */
function getBrowserFromUserAgent(userAgent: string): string {
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  if (userAgent.includes('curl')) return 'curl';
  if (userAgent.includes('Postman')) return 'Postman';
  if (userAgent.includes('axios')) return 'axios';
  return 'Other';
}

/**
 * Get request metrics for a specific date
 */
export async function getMetrics(
  date: string,
  env: Env
): Promise<any> {
  try {
    const metricsKey = `metrics:${date}`;
    const metrics = await env.CACHE.get(metricsKey);
    return metrics ? JSON.parse(metrics) : null;
  } catch (error) {
    console.error('Get metrics error:', error);
    return null;
  }
}

/**
 * Get request log by ID
 */
export async function getRequestLog(
  requestId: string,
  env: Env
): Promise<LogEntry | null> {
  try {
    const logKey = `log:${requestId}`;
    const log = await env.CACHE.get(logKey);
    return log ? JSON.parse(log) : null;
  } catch (error) {
    console.error('Get request log error:', error);
    return null;
  }
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();

  mark(name: string): void {
    this.marks.set(name, Date.now());
  }

  measure(name: string, startMark: string, endMark?: string): number {
    const start = this.marks.get(startMark);
    if (!start) return 0;

    const end = endMark ? this.marks.get(endMark) : Date.now();
    if (!end) return 0;

    return end - start;
  }

  getAllMeasurements(): Record<string, number> {
    const measurements: Record<string, number> = {};
    const now = Date.now();

    for (const [name, time] of this.marks.entries()) {
      measurements[name] = now - time;
    }

    return measurements;
  }
}