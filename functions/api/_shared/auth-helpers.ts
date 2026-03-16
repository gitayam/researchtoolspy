/**
 * Shared Authentication Helpers for Cloudflare Workers API
 *
 * Provides consistent authentication across all API endpoints
 * Supports both hash-based auth and session-based auth
 */

import { verifyToken } from '../../utils/jwt'

export interface Env {
  DB?: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
  OIDC_CLIENT_ID?: string
  OIDC_CLIENT_SECRET?: string
  OIDC_ISSUER?: string
  OIDC_AUTHORIZATION_URL?: string
  OIDC_TOKEN_URL?: string
  OIDC_USERINFO_URL?: string
}

/**
 * Get user ID from request Authorization header
 * Supports JWT tokens, session-based auth, and hash-based auth
 *
 * @param request - The incoming request
 * @param env - Cloudflare environment with DB, SESSIONS, and JWT_SECRET
 * @returns User ID (number) or null if not authenticated
 */
export async function getUserFromRequest(
  request: Request,
  env: Env
): Promise<number | null> {
  // Check X-User-Hash header first (COP pattern)
  const userHash = request.headers.get('X-User-Hash')
  if (userHash && userHash !== 'default' && userHash.length >= 16 && env.DB) {
    try {
      const existingUser = await env.DB.prepare(
        'SELECT id FROM users WHERE user_hash = ?'
      ).bind(userHash).first()
      if (existingUser) {
        return Number(existingUser.id)
      }

      // Auto-create guest user for valid hash (matches Bearer token path behavior)
      const result = await env.DB.prepare(`
        INSERT INTO users (username, email, user_hash, full_name, hashed_password, created_at, is_active, is_verified, role)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0, 'guest')
        RETURNING id
      `).bind(
        `guest_${userHash.substring(0, 8)}`,
        `${userHash.substring(0, 8)}@guest.local`,
        userHash,
        'Guest User',
        'HASH_AUTH',
        new Date().toISOString()
      ).first() as { id: number } | null

      if (result?.id) {
        return Number(result.id)
      }
    } catch (err) {
      console.error('[Auth] Failed to resolve X-User-Hash:', err)
    }
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  // 1. Try JWT Auth first (Primary for new implementation)
  if (token.includes('.') && env.JWT_SECRET) {
    const payload = await verifyToken(token, env.JWT_SECRET)
    if (payload?.sub) {
      return Number(payload.sub)
    }
  }

  // 2. Try session-based auth (KV store - legacy/standard)
  if (env.SESSIONS) {
    const sessionData = await env.SESSIONS.get(token)
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData)
        if (session.user_id) {
          return Number(session.user_id)
        }
      } catch (err) {
        console.error('[Auth] Failed to parse session data:', err)
      }
    }
  }

  // 3. Fallback to raw hash-based auth (Mullvad direct access)
  // For hash-based auth (16+ chars), create/retrieve guest user
  if (token.length >= 16 && env.DB) {
    try {
      // Try to find existing user with this hash
      const existingUser = await env.DB.prepare(
        'SELECT id FROM users WHERE user_hash = ?'
      ).bind(token).first()

      if (existingUser) {
        return Number(existingUser.id)
      }

      // Create new guest user with hash if not found
      const result = await env.DB.prepare(`
        INSERT INTO users (username, email, user_hash, full_name, hashed_password, created_at, is_active, is_verified, role)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0, 'guest')
        RETURNING id
      `).bind(
        `guest_${token.substring(0, 8)}`,
        `${token.substring(0, 8)}@guest.local`,
        token,
        'Guest User',
        'HASH_AUTH_LEGACY',
        new Date().toISOString()
      ).first() as { id: number } | null

      if (result?.id) {
        return Number(result.id)
      }
    } catch (err) {
      console.error('[Auth] Failed to create/retrieve hash-based user:', err)
    }
  }

  return null
}

/**
 * Get user ID or default to 1 for backward compatibility
 * Use this for endpoints that don't strictly require auth
 *
 * @param request - The incoming request
 * @param env - Cloudflare environment
 * @returns User ID (always returns a number)
 */
export async function getUserIdOrDefault(
  request: Request,
  env: Env
): Promise<number> {
  const userId = await getUserFromRequest(request, env)
  return userId || 1
}

/**
 * Check if user is authenticated
 *
 * @param request - The incoming request
 * @param env - Cloudflare environment
 * @returns true if authenticated, false otherwise
 */
export async function isAuthenticated(
  request: Request,
  env: Env
): Promise<boolean> {
  const userId = await getUserFromRequest(request, env)
  return userId !== null
}

/**
 * Require authentication - throws 401 if not authenticated
 *
 * @param request - The incoming request
 * @param env - Cloudflare environment
 * @returns User ID (guaranteed to be non-null)
 * @throws Response with 401 status if not authenticated
 */
export async function requireAuth(
  request: Request,
  env: Env
): Promise<number> {
  const userId = await getUserFromRequest(request, env)

  if (!userId) {
    throw new Response(
      JSON.stringify({ error: 'Unauthorized. Please login or register.' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }

  return userId
}

/**
 * Verify user has access to a COP session (owner, collaborator, or public reader)
 * Returns the session's workspace_id on success, null on failure.
 *
 * For READ operations (GET), public sessions are accessible to any authenticated user.
 * For WRITE operations (POST/PUT/DELETE), only owner or collaborator access is granted.
 *
 * @param db - D1 database binding
 * @param sessionId - COP session ID
 * @param userId - Authenticated user ID
 * @param options - Optional: { readOnly: true } to allow public session access
 * @returns workspace_id string if authorized, null if not
 */
export async function verifyCopSessionAccess(
  db: D1Database,
  sessionId: string,
  userId: number,
  options?: { readOnly?: boolean }
): Promise<string | null> {
  // Check ownership first (fast path)
  const session = await db.prepare(
    'SELECT workspace_id, created_by, is_public FROM cop_sessions WHERE id = ?'
  ).bind(sessionId).first<{ workspace_id: string; created_by: number; is_public: number }>()

  if (!session) return null

  // Owner always has access
  if (String(session.created_by) === String(userId)) return session.workspace_id

  // Check collaborator table
  const collab = await db.prepare(
    'SELECT 1 FROM cop_collaborators WHERE cop_session_id = ? AND user_id = ?'
  ).bind(sessionId, userId).first()

  if (collab) return session.workspace_id

  // Public sessions are readable by any authenticated user
  if (options?.readOnly && session.is_public) return session.workspace_id

  return null
}

/**
 * Verify access to COP layer endpoints (GeoJSON map layers).
 *
 * Layer endpoints are READ-only and serve GeoJSON for the map.
 * - Public sessions: accessible without auth (map embeds, shared links)
 * - Private sessions: require auth + ownership or collaborator role
 *
 * Returns { workspace_id } on success, or a Response (4xx) on failure.
 */
export async function verifyCopLayerAccess(
  db: D1Database,
  sessionId: string,
  request: Request,
  env: Env
): Promise<{ workspace_id: string } | Response> {
  const session = await db.prepare(
    'SELECT workspace_id, created_by, is_public FROM cop_sessions WHERE id = ?'
  ).bind(sessionId).first<{ workspace_id: string; created_by: number; is_public: number }>()

  if (!session) {
    return new Response(JSON.stringify({ error: 'COP session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  // Public sessions — anyone can view layers (map embeds, shared links)
  if (session.is_public) return { workspace_id: session.workspace_id }

  // Private session — require authentication
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  // Owner
  if (String(session.created_by) === String(userId)) return { workspace_id: session.workspace_id }

  // Collaborator
  const collab = await db.prepare(
    'SELECT 1 FROM cop_collaborators WHERE cop_session_id = ? AND user_id = ?'
  ).bind(sessionId, userId).first()
  if (collab) return { workspace_id: session.workspace_id }

  return new Response(JSON.stringify({ error: 'Access denied' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
