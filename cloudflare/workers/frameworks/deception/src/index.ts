/**
 * DECEPTION Framework Worker
 * Deception Detection Framework
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
    return handleDECEPTIONRequest(request as AuthRequest, env, ctx);
  },
};

/**
 * Main DECEPTION request handler
 */
export async function handleDECEPTIONRequest(
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
  const deceptionPath = path.replace('/api/v1/frameworks/deception', '');

  // Route to appropriate handler
  switch (true) {
    case (deceptionPath === '' || deceptionPath === '/' || deceptionPath === '/create') && method === 'POST':
      return addCorsHeaders(await handleCreateDECEPTION(request, env), corsHeaders);

    case deceptionPath.match(/^\/(\d+)$/) && method === 'GET':
      return addCorsHeaders(await handleGetDECEPTION(request, env, parseInt(deceptionPath.match(/^\/(\d+)$/)[1])), corsHeaders);

    case deceptionPath.match(/^\/(\d+)$/) && method === 'PUT':
      return addCorsHeaders(await handleUpdateDECEPTION(request, env, parseInt(deceptionPath.match(/^\/(\d+)$/)[1])), corsHeaders);

    case deceptionPath.match(/^\/(\d+)$/) && method === 'DELETE':
      return addCorsHeaders(await handleDeleteDECEPTION(request, env, parseInt(deceptionPath.match(/^\/(\d+)$/)[1])), corsHeaders);

    case deceptionPath === '/list' && method === 'GET':
      return addCorsHeaders(await handleListDECEPTION(request, env), corsHeaders);

    default:
      return addCorsHeaders(createErrorResponse(404, 'DECEPTION endpoint not found', 'ENDPOINT_NOT_FOUND'), corsHeaders);
  }
}

/**
 * Create new DECEPTION analysis
 */
async function handleCreateDECEPTION(
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
      framework_type: 'deception_detection',
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
    console.error('Create DECEPTION error:', error);
    return createErrorResponse(500, 'Failed to create DECEPTION analysis', 'CREATE_ERROR');
  }
}

/**
 * Get DECEPTION analysis by session ID
 */
async function handleGetDECEPTION(
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
      `SELECT * FROM framework_sessions WHERE id = ? AND user_id = ? AND framework_type = 'deception_detection'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'DECEPTION analysis not found', 'NOT_FOUND');
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
    console.error('Get DECEPTION error:', error);
    return createErrorResponse(500, 'Failed to retrieve DECEPTION analysis', 'GET_ERROR');
  }
}

/**
 * Update DECEPTION analysis
 */
async function handleUpdateDECEPTION(
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
      `SELECT * FROM framework_sessions WHERE id = ? AND user_id = ? AND framework_type = 'deception_detection'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'DECEPTION analysis not found', 'NOT_FOUND');
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
    console.error('Update DECEPTION error:', error);
    return createErrorResponse(500, 'Failed to update DECEPTION analysis', 'UPDATE_ERROR');
  }
}

/**
 * Delete DECEPTION analysis
 */
async function handleDeleteDECEPTION(
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
      framework_type: 'deception_detection',
    });

    if (deleted === 0) {
      return createErrorResponse(404, 'DECEPTION analysis not found', 'NOT_FOUND');
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete DECEPTION error:', error);
    return createErrorResponse(500, 'Failed to delete DECEPTION analysis', 'DELETE_ERROR');
  }
}

/**
 * List user's DECEPTION analyses
 */
async function handleListDECEPTION(
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
        framework_type: 'deception_detection',
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
    console.error('List DECEPTION error:', error);
    return createErrorResponse(500, 'Failed to list DECEPTION analyses', 'LIST_ERROR');
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
