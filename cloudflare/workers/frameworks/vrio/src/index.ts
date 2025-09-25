/**
 * VRIO Framework Worker
 * Value, Rarity, Imitability, Organization analysis
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
    return handleVRIORequest(request as AuthRequest, env, ctx);
  },
};

/**
 * Main VRIO request handler
 */
export async function handleVRIORequest(
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
  const vrioPath = path.replace('/api/v1/frameworks/vrio', '');

  // Route to appropriate handler
  switch (true) {
    case (vrioPath === '' || vrioPath === '/' || vrioPath === '/create') && method === 'POST':
      return addCorsHeaders(await handleCreateVRIO(request, env), corsHeaders);

    case vrioPath.match(/^\/(\d+)$/) && method === 'GET':
      return addCorsHeaders(await handleGetVRIO(request, env, parseInt(vrioPath.match(/^\/(\d+)$/)[1])), corsHeaders);

    case vrioPath.match(/^\/(\d+)$/) && method === 'PUT':
      return addCorsHeaders(await handleUpdateVRIO(request, env, parseInt(vrioPath.match(/^\/(\d+)$/)[1])), corsHeaders);

    case vrioPath.match(/^\/(\d+)$/) && method === 'DELETE':
      return addCorsHeaders(await handleDeleteVRIO(request, env, parseInt(vrioPath.match(/^\/(\d+)$/)[1])), corsHeaders);

    case vrioPath === '/list' && method === 'GET':
      return addCorsHeaders(await handleListVRIO(request, env), corsHeaders);

    default:
      return addCorsHeaders(createErrorResponse(404, 'VRIO endpoint not found', 'ENDPOINT_NOT_FOUND'), corsHeaders);
  }
}

/**
 * Create new VRIO analysis
 */
async function handleCreateVRIO(
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
      framework_type: 'vrio',
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
    console.error('Create VRIO error:', error);
    return createErrorResponse(500, 'Failed to create VRIO analysis', 'CREATE_ERROR');
  }
}

/**
 * Get VRIO analysis by session ID
 */
async function handleGetVRIO(
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
      `SELECT * FROM framework_sessions WHERE id = ? AND user_id = ? AND framework_type = 'vrio'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'VRIO analysis not found', 'NOT_FOUND');
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
    console.error('Get VRIO error:', error);
    return createErrorResponse(500, 'Failed to retrieve VRIO analysis', 'GET_ERROR');
  }
}

/**
 * Update VRIO analysis
 */
async function handleUpdateVRIO(
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
      `SELECT * FROM framework_sessions WHERE id = ? AND user_id = ? AND framework_type = 'vrio'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'VRIO analysis not found', 'NOT_FOUND');
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
    console.error('Update VRIO error:', error);
    return createErrorResponse(500, 'Failed to update VRIO analysis', 'UPDATE_ERROR');
  }
}

/**
 * Delete VRIO analysis
 */
async function handleDeleteVRIO(
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
      framework_type: 'vrio',
    });

    if (deleted === 0) {
      return createErrorResponse(404, 'VRIO analysis not found', 'NOT_FOUND');
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete VRIO error:', error);
    return createErrorResponse(500, 'Failed to delete VRIO analysis', 'DELETE_ERROR');
  }
}

/**
 * List user's VRIO analyses
 */
async function handleListVRIO(
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
        framework_type: 'vrio',
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
    console.error('List VRIO error:', error);
    return createErrorResponse(500, 'Failed to list VRIO analyses', 'LIST_ERROR');
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
