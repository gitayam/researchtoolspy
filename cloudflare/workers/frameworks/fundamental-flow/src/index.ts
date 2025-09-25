/**
 * FUNDAMENTAL_FLOW Framework Worker
 * Fundamental Flow Analysis
 */

import { Env, AuthRequest, FrameworkSession } from '../../../shared/types';
import { createDatabase } from '../../../shared/database';
import { createErrorResponse, validateRequestBody } from '../../../gateway/src/middleware/errorHandler';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return handleFUNDAMENTAL_FLOWRequest(request as AuthRequest, env, ctx);
  },
};

/**
 * Main FUNDAMENTAL_FLOW request handler
 */
export async function handleFUNDAMENTAL_FLOWRequest(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Remove base path if present
  const fundamental-flowPath = path.replace('/api/v1/frameworks/fundamental-flow', '');

  // Route to appropriate handler
  switch (true) {
    case (fundamental-flowPath === '' || fundamental-flowPath === '/' || fundamental-flowPath === '/create') && method === 'POST':
      return addCorsHeaders(await handleCreateFUNDAMENTAL_FLOW(request, env), corsHeaders);

    case fundamental-flowPath.match(/^\/(\d+)$/) && method === 'GET':
      return addCorsHeaders(await handleGetFUNDAMENTAL_FLOW(request, env, parseInt(fundamental-flowPath.match(/^\/(\d+)$/)[1])), corsHeaders);

    case fundamental-flowPath.match(/^\/(\d+)$/) && method === 'PUT':
      return addCorsHeaders(await handleUpdateFUNDAMENTAL_FLOW(request, env, parseInt(fundamental-flowPath.match(/^\/(\d+)$/)[1])), corsHeaders);

    case fundamental-flowPath.match(/^\/(\d+)$/) && method === 'DELETE':
      return addCorsHeaders(await handleDeleteFUNDAMENTAL_FLOW(request, env, parseInt(fundamental-flowPath.match(/^\/(\d+)$/)[1])), corsHeaders);

    case fundamental-flowPath === '/list' && method === 'GET':
      return addCorsHeaders(await handleListFUNDAMENTAL_FLOW(request, env), corsHeaders);

    default:
      return addCorsHeaders(createErrorResponse(404, 'FUNDAMENTAL_FLOW endpoint not found', 'ENDPOINT_NOT_FOUND'), corsHeaders);
  }
}

/**
 * Create new FUNDAMENTAL_FLOW analysis
 */
async function handleCreateFUNDAMENTAL_FLOW(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    const body = await request.json();

    // Validate input
    const validation = validateRequestBody(body, {
      title: { required: true, type: 'string', minLength: 1 },
      objective: { required: true, type: 'string', minLength: 1 },
    });

    if (validation) {
      return createErrorResponse(400, 'Validation failed', 'VALIDATION_ERROR', validation.fields);
    }

    const db = createDatabase(env);

    // Initialize framework data
    const frameworkData = {
      objective: body.objective,
      context: body.context || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Create framework session
    const sessionId = await db.insert('framework_sessions', {
      title: body.title,
      description: body.objective,
      framework_type: 'fundamental_flow',
      status: 'draft',
      user_id: request.user.id,
      data: JSON.stringify(frameworkData),
      config: JSON.stringify({}),
      tags: body.tags ? JSON.stringify(body.tags) : null,
      version: 1,
      ai_analysis_count: 0,
    });

    const response = {
      session_id: sessionId,
      title: body.title,
      objective: frameworkData.objective,
      context: frameworkData.context,
      status: 'draft',
      version: 1,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Create FUNDAMENTAL_FLOW error:', error);
    return createErrorResponse(500, 'Failed to create FUNDAMENTAL_FLOW analysis', 'CREATE_ERROR');
  }
}

/**
 * Get FUNDAMENTAL_FLOW analysis by session ID
 */
async function handleGetFUNDAMENTAL_FLOW(
  request: AuthRequest,
  env: Env,
  sessionId: number
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    const db = createDatabase(env);

    const session = await db.findOne<FrameworkSession>(
      `SELECT * FROM framework_sessions WHERE id = ? AND user_id = ? AND framework_type = 'fundamental_flow'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'FUNDAMENTAL_FLOW analysis not found', 'NOT_FOUND');
    }

    const frameworkData = JSON.parse(session.data);

    const response = {
      session_id: session.id,
      title: session.title,
      objective: frameworkData.objective,
      context: frameworkData.context,
      status: session.status,
      version: session.version,
      data: frameworkData,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get FUNDAMENTAL_FLOW error:', error);
    return createErrorResponse(500, 'Failed to retrieve FUNDAMENTAL_FLOW analysis', 'GET_ERROR');
  }
}

/**
 * Update FUNDAMENTAL_FLOW analysis
 */
async function handleUpdateFUNDAMENTAL_FLOW(
  request: AuthRequest,
  env: Env,
  sessionId: number
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    const body = await request.json();
    const db = createDatabase(env);

    const session = await db.findOne<FrameworkSession>(
      `SELECT * FROM framework_sessions WHERE id = ? AND user_id = ? AND framework_type = 'fundamental_flow'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'FUNDAMENTAL_FLOW analysis not found', 'NOT_FOUND');
    }

    const frameworkData = JSON.parse(session.data);

    // Update fields
    if (body.objective !== undefined) frameworkData.objective = body.objective;
    if (body.context !== undefined) frameworkData.context = body.context;
    frameworkData.updated_at = new Date().toISOString();

    await db.update(
      'framework_sessions',
      {
        title: body.title || session.title,
        data: JSON.stringify(frameworkData),
        version: session.version + 1,
        status: body.status || session.status,
      },
      { id: sessionId }
    );

    const response = {
      session_id: sessionId,
      title: body.title || session.title,
      objective: frameworkData.objective,
      context: frameworkData.context,
      status: body.status || session.status,
      version: session.version + 1,
      data: frameworkData,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Update FUNDAMENTAL_FLOW error:', error);
    return createErrorResponse(500, 'Failed to update FUNDAMENTAL_FLOW analysis', 'UPDATE_ERROR');
  }
}

/**
 * Delete FUNDAMENTAL_FLOW analysis
 */
async function handleDeleteFUNDAMENTAL_FLOW(
  request: AuthRequest,
  env: Env,
  sessionId: number
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    const db = createDatabase(env);

    const deleted = await db.delete('framework_sessions', {
      id: sessionId,
      user_id: request.user.id,
      framework_type: 'fundamental_flow',
    });

    if (deleted === 0) {
      return createErrorResponse(404, 'FUNDAMENTAL_FLOW analysis not found', 'NOT_FOUND');
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete FUNDAMENTAL_FLOW error:', error);
    return createErrorResponse(500, 'Failed to delete FUNDAMENTAL_FLOW analysis', 'DELETE_ERROR');
  }
}

/**
 * List user's FUNDAMENTAL_FLOW analyses
 */
async function handleListFUNDAMENTAL_FLOW(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    const db = createDatabase(env);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');

    const result = await db.paginate('framework_sessions', page, pageSize, {
      where: {
        user_id: request.user.id,
        framework_type: 'fundamental_flow',
      },
      orderBy: {
        column: 'updated_at',
        direction: 'desc',
      },
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('List FUNDAMENTAL_FLOW error:', error);
    return createErrorResponse(500, 'Failed to list FUNDAMENTAL_FLOW analyses', 'LIST_ERROR');
  }
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: Response, corsHeaders: Record<string, string>): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
