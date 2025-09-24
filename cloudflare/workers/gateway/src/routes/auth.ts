/**
 * Authentication routes handler
 * Handles login, registration, token refresh, and anonymous sessions
 */

import { Env, AuthRequest, User } from '../../../shared/types';
import { createDatabase } from '../../../shared/database';
import { createJWT, createRefreshToken, verifyJWT, hashPassword, verifyPassword } from '../../../shared/jwt';
import { createErrorResponse, validateRequestBody } from '../middleware/errorHandler';

/**
 * Auth router - handles all /api/v1/auth/* routes
 */
export async function authRouter(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Route to specific auth handler
  switch (true) {
    case path === '/api/v1/auth/login' && request.method === 'POST':
      return handleLogin(request, env);

    case path === '/api/v1/auth/register' && request.method === 'POST':
      return handleRegister(request, env);

    case path === '/api/v1/auth/refresh' && request.method === 'POST':
      return handleRefreshToken(request, env);

    case path === '/api/v1/auth/logout' && request.method === 'POST':
      return handleLogout(request, env);

    case path === '/api/v1/auth/anonymous' && request.method === 'POST':
      return handleAnonymousSession(request, env);

    case path === '/api/v1/auth/verify-email' && request.method === 'POST':
      return handleEmailVerification(request, env);

    case path === '/api/v1/auth/forgot-password' && request.method === 'POST':
      return handleForgotPassword(request, env);

    case path === '/api/v1/auth/reset-password' && request.method === 'POST':
      return handleResetPassword(request, env);

    case path === '/api/v1/auth/me' && request.method === 'GET':
      return handleGetCurrentUser(request, env);

    case path === '/api/v1/auth/me' && request.method === 'PATCH':
      return handleUpdateCurrentUser(request, env);

    default:
      return createErrorResponse(404, 'Auth endpoint not found', 'AUTH_ENDPOINT_NOT_FOUND');
  }
}

/**
 * Handle user login
 */
async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(400, 'Invalid JSON body', 'INVALID_JSON');
    }

    // Validate input
    const validation = validateRequestBody(body, {
      email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      password: { required: true, type: 'string', minLength: 6 },
    });

    if (validation) {
      return createErrorResponse(400, 'Validation failed', 'VALIDATION_ERROR', validation.fields);
    }

    const { email, password } = body;
    const db = createDatabase(env);

    // Find user by email
    const user = await db.findOne<User & { hashed_password: string }>(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!user) {
      // Log failed attempt
      await logAuthAttempt(null, email, false, request, env, 'User not found');
      return createErrorResponse(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Verify password
    const [hash, salt] = user.hashed_password.split(':');
    const isValidPassword = await verifyPassword(password, hash, salt);

    if (!isValidPassword) {
      // Log failed attempt
      await logAuthAttempt(user.id, email, false, request, env, 'Invalid password');
      return createErrorResponse(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Check if user is active
    if (!user.is_active) {
      await logAuthAttempt(user.id, email, false, request, env, 'User inactive');
      return createErrorResponse(403, 'Account is inactive', 'ACCOUNT_INACTIVE');
    }

    // Generate tokens
    const accessToken = await createJWT(
      {
        sub: user.id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
      },
      env.JWT_SECRET,
      3600 // 1 hour
    );

    const refreshToken = await createRefreshToken(user.id.toString(), env.JWT_SECRET);

    // Store session in KV
    const sessionData = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    await env.SESSIONS.put(
      `session:${accessToken}`,
      JSON.stringify(sessionData),
      { expirationTtl: 86400 } // 24 hours
    );

    // Log successful attempt
    await logAuthAttempt(user.id, email, true, request, env);

    // Return user data and tokens
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          is_verified: user.is_verified,
          organization: user.organization,
          department: user.department,
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 3600,
          token_type: 'Bearer',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    return createErrorResponse(500, 'Login failed', 'LOGIN_ERROR');
  }
}

/**
 * Handle user registration
 */
async function handleRegister(request: Request, env: Env): Promise<Response> {
  try {
    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(400, 'Invalid JSON body', 'INVALID_JSON');
    }

    // Validate input
    const validation = validateRequestBody(body, {
      email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      username: { required: true, type: 'string', minLength: 3, maxLength: 50 },
      password: { required: true, type: 'string', minLength: 8 },
      full_name: { required: true, type: 'string', minLength: 2 },
    });

    if (validation) {
      return createErrorResponse(400, 'Validation failed', 'VALIDATION_ERROR', validation.fields);
    }

    const { email, username, password, full_name, organization, department } = body;
    const db = createDatabase(env);

    // Check if email exists
    const existingEmail = await db.exists('users', { email: email.toLowerCase() });
    if (existingEmail) {
      return createErrorResponse(409, 'Email already registered', 'EMAIL_EXISTS');
    }

    // Check if username exists
    const existingUsername = await db.exists('users', { username: username.toLowerCase() });
    if (existingUsername) {
      return createErrorResponse(409, 'Username already taken', 'USERNAME_EXISTS');
    }

    // Hash password
    const { hash, salt } = await hashPassword(password);
    const hashedPassword = `${hash}:${salt}`;

    // Generate account hash for anonymous migration
    const accountHash = generateAccountHash();

    // Insert user
    const userId = await db.insert('users', {
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      full_name,
      hashed_password: hashedPassword,
      account_hash: accountHash,
      is_active: 1,
      is_verified: 0,
      role: 'researcher',
      organization,
      department,
    });

    // Generate tokens
    const accessToken = await createJWT(
      {
        sub: userId.toString(),
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        role: 'researcher',
      },
      env.JWT_SECRET,
      3600
    );

    const refreshToken = await createRefreshToken(userId.toString(), env.JWT_SECRET);

    // Store session
    const sessionData = {
      userId,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      role: 'researcher',
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    await env.SESSIONS.put(
      `session:${accessToken}`,
      JSON.stringify(sessionData),
      { expirationTtl: 86400 }
    );

    // TODO: Send verification email

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          full_name,
          role: 'researcher',
          is_verified: false,
          account_hash: accountHash,
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 3600,
          token_type: 'Bearer',
        },
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return createErrorResponse(500, 'Registration failed', 'REGISTRATION_ERROR');
  }
}

/**
 * Handle token refresh
 */
async function handleRefreshToken(request: Request, env: Env): Promise<Response> {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(400, 'Invalid JSON body', 'INVALID_JSON');
    }

    const { refresh_token } = body;
    if (!refresh_token) {
      return createErrorResponse(400, 'Refresh token required', 'REFRESH_TOKEN_REQUIRED');
    }

    // Verify refresh token
    const payload = await verifyJWT(refresh_token, env.JWT_SECRET);
    if (!payload || payload.type !== 'refresh') {
      return createErrorResponse(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const db = createDatabase(env);

    // Get user
    const user = await db.findOne<User>(
      'SELECT * FROM users WHERE id = ? AND is_active = 1',
      [payload.sub]
    );

    if (!user) {
      return createErrorResponse(401, 'User not found or inactive', 'USER_NOT_FOUND');
    }

    // Generate new access token
    const accessToken = await createJWT(
      {
        sub: user.id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
      },
      env.JWT_SECRET,
      3600
    );

    // Update session
    const sessionData = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    await env.SESSIONS.put(
      `session:${accessToken}`,
      JSON.stringify(sessionData),
      { expirationTtl: 86400 }
    );

    return new Response(
      JSON.stringify({
        success: true,
        tokens: {
          access_token: accessToken,
          refresh_token,
          expires_in: 3600,
          token_type: 'Bearer',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Token refresh error:', error);
    return createErrorResponse(500, 'Token refresh failed', 'TOKEN_REFRESH_ERROR');
  }
}

/**
 * Handle logout
 */
async function handleLogout(request: AuthRequest, env: Env): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Blacklist the token
    await env.SESSIONS.put(
      `blacklist:${token}`,
      '1',
      { expirationTtl: 86400 } // Keep blacklisted for 24 hours
    );

    // Delete session
    await env.SESSIONS.delete(`session:${token}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Logged out successfully' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return createErrorResponse(500, 'Logout failed', 'LOGOUT_ERROR');
  }
}

/**
 * Handle anonymous session creation
 */
async function handleAnonymousSession(request: Request, env: Env): Promise<Response> {
  try {
    // Generate anonymous session hash
    const sessionHash = generateAccountHash();

    // Create session data
    const sessionData = {
      sessionHash,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      data: {},
    };

    // Store in KV
    await env.ANONYMOUS_SESSIONS.put(
      sessionHash,
      JSON.stringify(sessionData),
      { expirationTtl: 86400 } // 24 hours
    );

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          hash: sessionHash,
          expires_in: 86400,
        },
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Anonymous session error:', error);
    return createErrorResponse(500, 'Failed to create anonymous session', 'ANONYMOUS_SESSION_ERROR');
  }
}

/**
 * Handle email verification
 */
async function handleEmailVerification(request: Request, env: Env): Promise<Response> {
  // TODO: Implement email verification
  return createErrorResponse(501, 'Email verification not implemented', 'NOT_IMPLEMENTED');
}

/**
 * Handle forgot password
 */
async function handleForgotPassword(request: Request, env: Env): Promise<Response> {
  // TODO: Implement forgot password
  return createErrorResponse(501, 'Forgot password not implemented', 'NOT_IMPLEMENTED');
}

/**
 * Handle reset password
 */
async function handleResetPassword(request: Request, env: Env): Promise<Response> {
  // TODO: Implement reset password
  return createErrorResponse(501, 'Reset password not implemented', 'NOT_IMPLEMENTED');
}

/**
 * Get current user
 */
async function handleGetCurrentUser(request: AuthRequest, env: Env): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  return new Response(
    JSON.stringify({
      success: true,
      user: {
        id: request.user.id,
        username: request.user.username,
        email: request.user.email,
        full_name: request.user.full_name,
        role: request.user.role,
        is_verified: request.user.is_verified,
        organization: request.user.organization,
        department: request.user.department,
        bio: request.user.bio,
        created_at: request.user.created_at,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Update current user
 */
async function handleUpdateCurrentUser(request: AuthRequest, env: Env): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(400, 'Invalid JSON body', 'INVALID_JSON');
    }

    const db = createDatabase(env);
    const updates: Record<string, any> = {};

    // Only allow updating certain fields
    const allowedFields = ['full_name', 'bio', 'organization', 'department', 'preferences'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = field === 'preferences' ? JSON.stringify(body[field]) : body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return createErrorResponse(400, 'No valid fields to update', 'NO_UPDATES');
    }

    await db.update('users', updates, { id: request.user.id });

    // Get updated user
    const updatedUser = await db.findOne<User>(
      'SELECT * FROM users WHERE id = ?',
      [request.user.id]
    );

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          full_name: updatedUser.full_name,
          role: updatedUser.role,
          is_verified: updatedUser.is_verified,
          organization: updatedUser.organization,
          department: updatedUser.department,
          bio: updatedUser.bio,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Update user error:', error);
    return createErrorResponse(500, 'Failed to update user', 'UPDATE_USER_ERROR');
  }
}

/**
 * Generate account hash for anonymous users
 */
function generateAccountHash(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let hash = '';
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);

  for (let i = 0; i < 16; i++) {
    hash += chars[array[i] % chars.length];
  }

  return hash;
}

/**
 * Log authentication attempt
 */
async function logAuthAttempt(
  userId: number | null,
  email: string,
  success: boolean,
  request: Request,
  env: Env,
  errorMessage?: string
): Promise<void> {
  try {
    const db = createDatabase(env);
    await db.insert('auth_logs', {
      user_id: userId,
      account_hash: email,
      success: success ? 1 : 0,
      ip_address: request.headers.get('CF-Connecting-IP') ||
                  request.headers.get('X-Forwarded-For')?.split(',')[0] ||
                  null,
      user_agent: request.headers.get('User-Agent'),
      error_message: errorMessage,
      login_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log auth attempt:', error);
  }
}