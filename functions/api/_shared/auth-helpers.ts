/**
 * Shared Authentication Helpers for Cloudflare Workers API
 *
 * Provides consistent authentication across all API endpoints
 * Supports both hash-based auth and session-based auth
 */

interface Env {
  DB?: D1Database
  SESSIONS?: KVNamespace
}

/**
 * Get user ID from request Authorization header
 * Supports both hash-based auth and session-based auth
 *
 * @param request - The incoming request
 * @param env - Cloudflare environment with DB and SESSIONS
 * @returns User ID (number) or null if not authenticated
 */
export async function getUserFromRequest(
  request: Request,
  env: Env
): Promise<number | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  // Try session-based auth first (KV store)
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

  // Fallback to hash-based auth
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

      // Create new guest user with hash
      const result = await env.DB.prepare(`
        INSERT INTO users (username, email, user_hash, full_name, hashed_password, created_at, is_active, is_verified, role)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0, 'guest')
        RETURNING id
      `).bind(
        `guest_${token.substring(0, 8)}`,
        `${token.substring(0, 8)}@guest.local`,
        token,
        'Guest User',
        '',
        new Date().toISOString()
      ).first()

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
 * Get workspace ID from request body or default
 *
 * @param body - Request body object
 * @returns Workspace ID string
 */
export function getWorkspaceIdOrDefault(body: any): string {
  return body?.workspace_id || '1'
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
