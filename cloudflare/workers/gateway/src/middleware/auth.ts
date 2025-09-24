/**
 * Authentication Middleware for Cloudflare Workers
 */

import { Env, AuthRequest, User, AuthenticationError } from '../../../shared/types';
import { verifyJWT } from '../../../shared/jwt';
import { createDatabase } from '../../../shared/database';

/**
 * Authentication middleware
 */
export async function authMiddleware(
  request: AuthRequest,
  env: Env
): Promise<AuthRequest | Response> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      // Check for anonymous session
      const anonymousSession = await checkAnonymousSession(request, env);
      if (anonymousSession) {
        request.user = anonymousSession;
        return request;
      }

      return createAuthErrorResponse('No authorization token provided');
    }

    // Parse Bearer token
    const tokenMatch = authHeader.match(/^Bearer (.+)$/i);
    if (!tokenMatch) {
      return createAuthErrorResponse('Invalid authorization format');
    }

    const token = tokenMatch[1];

    // Verify JWT token
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload) {
      return createAuthErrorResponse('Invalid or expired token');
    }

    // Check if token is blacklisted (for logout functionality)
    const isBlacklisted = await isTokenBlacklisted(token, env);
    if (isBlacklisted) {
      return createAuthErrorResponse('Token has been revoked');
    }

    // Get user from database
    const db = createDatabase(env);
    const user = await db.findOne<User>(
      'SELECT * FROM users WHERE id = ? AND is_active = 1',
      [payload.sub]
    );

    if (!user) {
      return createAuthErrorResponse('User not found or inactive');
    }

    // Attach user to request
    request.user = user;
    request.session = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      token,
      expiresAt: payload.exp * 1000,
      createdAt: payload.iat * 1000,
    };

    // Update last activity in KV
    await updateSessionActivity(token, env);

    return request;
  } catch (error) {
    console.error('Auth middleware error:', error);
    return createAuthErrorResponse('Authentication failed');
  }
}

/**
 * Check for anonymous session using hash
 */
async function checkAnonymousSession(
  request: Request,
  env: Env
): Promise<User | null> {
  try {
    // Check for anonymous session header
    const sessionHash = request.headers.get('X-Anonymous-Session');
    if (!sessionHash) return null;

    // Validate session hash format (16 chars)
    if (!/^[a-zA-Z0-9]{16}$/.test(sessionHash)) return null;

    // Check if session exists in KV
    const sessionData = await env.ANONYMOUS_SESSIONS.get(sessionHash);
    if (!sessionData) return null;

    const session = JSON.parse(sessionData);

    // Check if session is expired (24 hours)
    const expiryTime = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - session.createdAt > expiryTime) {
      await env.ANONYMOUS_SESSIONS.delete(sessionHash);
      return null;
    }

    // Update last accessed time
    session.lastAccessedAt = Date.now();
    await env.ANONYMOUS_SESSIONS.put(
      sessionHash,
      JSON.stringify(session),
      { expirationTtl: 86400 } // 24 hours
    );

    // Return pseudo-user for anonymous session
    return {
      id: 0,
      username: `anonymous_${sessionHash.substring(0, 8)}`,
      email: `${sessionHash}@anonymous.local`,
      full_name: 'Anonymous User',
      account_hash: sessionHash,
      is_active: true,
      is_verified: false,
      role: 'viewer',
      created_at: new Date(session.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Anonymous session check error:', error);
    return null;
  }
}

/**
 * Check if token is blacklisted
 */
async function isTokenBlacklisted(
  token: string,
  env: Env
): Promise<boolean> {
  try {
    const blacklistKey = `blacklist:${token}`;
    const isBlacklisted = await env.SESSIONS.get(blacklistKey);
    return isBlacklisted !== null;
  } catch (error) {
    console.error('Token blacklist check error:', error);
    return false;
  }
}

/**
 * Update session activity timestamp
 */
async function updateSessionActivity(
  token: string,
  env: Env
): Promise<void> {
  try {
    const sessionKey = `session:${token}`;
    const sessionData = await env.SESSIONS.get(sessionKey);

    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.lastActivity = Date.now();

      // Update with TTL of 24 hours
      await env.SESSIONS.put(
        sessionKey,
        JSON.stringify(session),
        { expirationTtl: 86400 }
      );
    }
  } catch (error) {
    console.error('Session activity update error:', error);
  }
}

/**
 * Create authentication error response
 */
function createAuthErrorResponse(message: string): Response {
  return new Response(
    JSON.stringify({
      error: 'Authentication Error',
      message,
      code: 'AUTH_REQUIRED',
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="ResearchToolsPy API"',
      },
    }
  );
}

/**
 * Check if user has required role
 */
export function requireRole(
  user: User | undefined,
  requiredRoles: string[]
): Response | null {
  if (!user) {
    return createAuthErrorResponse('Authentication required');
  }

  if (!requiredRoles.includes(user.role)) {
    return new Response(
      JSON.stringify({
        error: 'Authorization Error',
        message: 'Insufficient permissions for this operation',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles,
        userRole: user.role,
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  return null;
}

/**
 * Extract and validate API key
 */
export async function validateApiKey(
  request: Request,
  env: Env
): Promise<User | null> {
  try {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey) return null;

    const db = createDatabase(env);

    // Hash the API key for comparison
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Find API key in database
    const apiKeyRecord = await db.findOne(
      `SELECT ak.*, u.*
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE ak.key_hash = ? AND ak.is_active = 1 AND u.is_active = 1`,
      [keyHash]
    );

    if (!apiKeyRecord) return null;

    // Update usage count and last used
    await db.execute(
      `UPDATE api_keys
       SET usage_count = usage_count + 1,
           last_used_at = datetime('now')
       WHERE id = ?`,
      [apiKeyRecord.id]
    );

    // Return user associated with API key
    return {
      id: apiKeyRecord.user_id,
      username: apiKeyRecord.username,
      email: apiKeyRecord.email,
      full_name: apiKeyRecord.full_name,
      is_active: apiKeyRecord.is_active,
      is_verified: apiKeyRecord.is_verified,
      role: apiKeyRecord.role,
      organization: apiKeyRecord.organization,
      department: apiKeyRecord.department,
      created_at: apiKeyRecord.created_at,
      updated_at: apiKeyRecord.updated_at,
    };
  } catch (error) {
    console.error('API key validation error:', error);
    return null;
  }
}