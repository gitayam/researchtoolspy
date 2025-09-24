/**
 * User management routes handler
 */

import { Env, AuthRequest } from '../../../shared/types';
import { createDatabase } from '../../../shared/database';
import { createErrorResponse } from '../middleware/errorHandler';
import { requireRole } from '../middleware/auth';

/**
 * Users router - handles all /api/v1/users/* routes
 */
export async function usersRouter(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Require authentication for all user routes
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  // Route to specific handler
  switch (true) {
    case path === '/api/v1/users' && method === 'GET':
      // Admin only - list all users
      const roleCheck = requireRole(request.user, ['admin']);
      if (roleCheck) return roleCheck;
      return handleListUsers(request, env);

    case path.match(/^\/api\/v1\/users\/(\d+)$/) && method === 'GET':
      return handleGetUser(request, env, parseInt(path.match(/^\/api\/v1\/users\/(\d+)$/)[1]));

    case path.match(/^\/api\/v1\/users\/(\d+)$/) && method === 'PATCH':
      return handleUpdateUser(request, env, parseInt(path.match(/^\/api\/v1\/users\/(\d+)$/)[1]));

    case path.match(/^\/api\/v1\/users\/(\d+)$/) && method === 'DELETE':
      return handleDeleteUser(request, env, parseInt(path.match(/^\/api\/v1\/users\/(\d+)$/)[1]));

    case path === '/api/v1/users/search' && method === 'GET':
      return handleSearchUsers(request, env);

    case path === '/api/v1/users/stats' && method === 'GET':
      return handleUserStats(request, env);

    default:
      return createErrorResponse(404, 'User endpoint not found', 'ENDPOINT_NOT_FOUND');
  }
}

async function handleListUsers(request: AuthRequest, env: Env): Promise<Response> {
  const db = createDatabase(env);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20');

  const result = await db.paginate('users', page, pageSize, {
    orderBy: { column: 'created_at', direction: 'desc' },
  });

  // Remove sensitive data
  result.items = result.items.map((user: any) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
    is_verified: user.is_verified,
    organization: user.organization,
    department: user.department,
    created_at: user.created_at,
  }));

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetUser(
  request: AuthRequest,
  env: Env,
  userId: number
): Promise<Response> {
  // Users can only view their own profile unless they're admin
  if (request.user.id !== userId && request.user.role !== 'admin') {
    return createErrorResponse(403, 'Forbidden', 'FORBIDDEN');
  }

  const db = createDatabase(env);
  const user = await db.findOne(
    'SELECT id, username, email, full_name, role, is_active, is_verified, organization, department, bio, created_at, updated_at FROM users WHERE id = ?',
    [userId]
  );

  if (!user) {
    return createErrorResponse(404, 'User not found', 'NOT_FOUND');
  }

  return new Response(JSON.stringify(user), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleUpdateUser(
  request: AuthRequest,
  env: Env,
  userId: number
): Promise<Response> {
  // Users can only update their own profile unless they're admin
  if (request.user.id !== userId && request.user.role !== 'admin') {
    return createErrorResponse(403, 'Forbidden', 'FORBIDDEN');
  }

  const body = await request.json();
  const db = createDatabase(env);

  // Allowed fields for self-update
  const allowedSelfUpdate = ['full_name', 'bio', 'organization', 'department'];
  // Additional fields for admin update
  const allowedAdminUpdate = [...allowedSelfUpdate, 'role', 'is_active', 'is_verified'];

  const updates: Record<string, any> = {};
  const allowedFields = request.user.role === 'admin' ? allowedAdminUpdate : allowedSelfUpdate;

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return createErrorResponse(400, 'No valid fields to update', 'NO_UPDATES');
  }

  await db.update('users', updates, { id: userId });

  const updatedUser = await db.findOne(
    'SELECT id, username, email, full_name, role, is_active, is_verified, organization, department, bio, created_at, updated_at FROM users WHERE id = ?',
    [userId]
  );

  return new Response(JSON.stringify(updatedUser), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleDeleteUser(
  request: AuthRequest,
  env: Env,
  userId: number
): Promise<Response> {
  // Only admins can delete users
  const roleCheck = requireRole(request.user, ['admin']);
  if (roleCheck) return roleCheck;

  // Prevent self-deletion
  if (request.user.id === userId) {
    return createErrorResponse(400, 'Cannot delete your own account', 'SELF_DELETE');
  }

  const db = createDatabase(env);
  const deleted = await db.delete('users', { id: userId });

  if (deleted === 0) {
    return createErrorResponse(404, 'User not found', 'NOT_FOUND');
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleSearchUsers(request: AuthRequest, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query || query.length < 2) {
    return createErrorResponse(400, 'Search query must be at least 2 characters', 'INVALID_QUERY');
  }

  const db = createDatabase(env);
  const results = await db.execute(
    `SELECT id, username, email, full_name, role, organization, department
     FROM users
     WHERE (username LIKE ? OR email LIKE ? OR full_name LIKE ?)
     AND is_active = 1
     LIMIT 20`,
    [`%${query}%`, `%${query}%`, `%${query}%`]
  );

  return new Response(JSON.stringify(results.results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleUserStats(request: AuthRequest, env: Env): Promise<Response> {
  // Only show stats for current user unless admin
  const userId = request.user.role === 'admin'
    ? parseInt(new URL(request.url).searchParams.get('userId') || request.user.id.toString())
    : request.user.id;

  const db = createDatabase(env);

  const stats = await db.execute(
    `SELECT
      COUNT(DISTINCT fs.id) as total_sessions,
      COUNT(DISTINCT CASE WHEN fs.status = 'completed' THEN fs.id END) as completed_sessions,
      COUNT(DISTINCT fs.framework_type) as frameworks_used,
      SUM(fs.ai_analysis_count) as total_ai_analyses,
      COUNT(DISTINCT fe.id) as total_exports
     FROM users u
     LEFT JOIN framework_sessions fs ON u.id = fs.user_id
     LEFT JOIN framework_exports fe ON fs.id = fe.session_id
     WHERE u.id = ?`,
    [userId]
  );

  return new Response(JSON.stringify(stats.results[0]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}