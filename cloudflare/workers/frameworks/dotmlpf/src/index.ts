/**
 * DOTMLPF Framework Worker
 * Handles DOTMLPF (Doctrine, Organization, Training, Materiel, Leadership, Personnel, Facilities) analysis
 */

import { Env, AuthRequest, FrameworkSession } from '../../../shared/types';
import { createDatabase } from '../../../shared/database';
import { createErrorResponse, validateRequestBody } from '../../../gateway/src/middleware/errorHandler';
import {
  DOTMLPFCreateRequest,
  DOTMLPFAnalysisResponse,
  DOTMLPFUpdateRequest,
  DOTMLPFData,
  DOTMLPFExportFormat,
  DOTMLPFCategory,
  DOTMLPFElement,
} from './types';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return handleDOTMLPFRequest(request as AuthRequest, env, ctx);
  },
};

/**
 * Main DOTMLPF request handler
 */
export async function handleDOTMLPFRequest(
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
  const dotmlpfPath = path.replace('/api/v1/frameworks/dotmlpf', '');

  // Route to appropriate handler
  switch (true) {
    case (dotmlpfPath === '' || dotmlpfPath === '/' || dotmlpfPath === '/create') && method === 'POST':
      return addCorsHeaders(await handleCreateDOTMLPF(request, env), corsHeaders);

    case dotmlpfPath.match(/^\/(\d+)$/) && method === 'GET':
      return addCorsHeaders(await handleGetDOTMLPF(request, env, parseInt(dotmlpfPath.match(/^\/(\d+)$/)[1])), corsHeaders);

    case dotmlpfPath.match(/^\/(\d+)$/) && method === 'PUT':
      return addCorsHeaders(await handleUpdateDOTMLPF(request, env, parseInt(dotmlpfPath.match(/^\/(\d+)$/)[1])), corsHeaders);

    case dotmlpfPath.match(/^\/(\d+)$/) && method === 'DELETE':
      return addCorsHeaders(await handleDeleteDOTMLPF(request, env, parseInt(dotmlpfPath.match(/^\/(\d+)$/)[1])), corsHeaders);

    case dotmlpfPath === '/list' && method === 'GET':
      return addCorsHeaders(await handleListDOTMLPF(request, env), corsHeaders);

    default:
      return addCorsHeaders(createErrorResponse(404, 'DOTMLPF endpoint not found', 'ENDPOINT_NOT_FOUND'), corsHeaders);
  }
}

/**
 * Create new DOTMLPF analysis
 */
async function handleCreateDOTMLPF(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    const body: DOTMLPFCreateRequest = await request.json();

    // Validate input
    const validation = validateRequestBody(body, {
      title: { required: true, type: 'string', minLength: 1 },
      objective: { required: true, type: 'string', minLength: 1 },
    });

    if (validation) {
      return createErrorResponse(400, 'Validation failed', 'VALIDATION_ERROR', validation.fields);
    }

    const db = createDatabase(env);

    // Initialize DOTMLPF data
    const dotmlpfData: DOTMLPFData = {
      objective: body.objective,
      context: body.context || '',
      scope: body.scope,
      current_situation: body.current_situation,
      elements: {
        doctrine: body.initial_elements?.doctrine || [],
        organization: body.initial_elements?.organization || [],
        training: body.initial_elements?.training || [],
        materiel: body.initial_elements?.materiel || [],
        leadership: body.initial_elements?.leadership || [],
        personnel: body.initial_elements?.personnel || [],
        facilities: body.initial_elements?.facilities || [],
      },
      gap_summary: {
        critical_gaps: [],
        high_priority_gaps: [],
        quick_wins: [],
        resource_intensive: [],
        category_readiness: {
          doctrine: { readiness_percentage: 0, critical_gaps: 0, recommendations: [] },
          organization: { readiness_percentage: 0, critical_gaps: 0, recommendations: [] },
          training: { readiness_percentage: 0, critical_gaps: 0, recommendations: [] },
          materiel: { readiness_percentage: 0, critical_gaps: 0, recommendations: [] },
          leadership: { readiness_percentage: 0, critical_gaps: 0, recommendations: [] },
          personnel: { readiness_percentage: 0, critical_gaps: 0, recommendations: [] },
          facilities: { readiness_percentage: 0, critical_gaps: 0, recommendations: [] },
        },
      },
      implementation_roadmap: {
        phases: [],
        total_timeline: 'TBD',
        resource_summary: {
          personnel: [],
          budget: [],
          facilities: [],
          equipment: [],
        },
        risk_mitigation: [],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Create framework session
    const sessionId = await db.insert('framework_sessions', {
      title: body.title,
      description: body.objective,
      framework_type: 'dotmlpf',
      status: 'draft',
      user_id: request.user.id,
      data: JSON.stringify(dotmlpfData),
      config: JSON.stringify({}),
      tags: body.tags ? JSON.stringify(body.tags) : null,
      version: 1,
      ai_analysis_count: 0,
    });

    const response: DOTMLPFAnalysisResponse = {
      session_id: sessionId,
      title: body.title,
      objective: dotmlpfData.objective,
      context: dotmlpfData.context,
      scope: dotmlpfData.scope,
      current_situation: dotmlpfData.current_situation,
      elements: dotmlpfData.elements,
      gap_summary: dotmlpfData.gap_summary,
      implementation_roadmap: dotmlpfData.implementation_roadmap,
      ai_suggestions: null,
      status: 'draft',
      version: 1,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Create DOTMLPF error:', error);
    return createErrorResponse(500, 'Failed to create DOTMLPF analysis', 'CREATE_ERROR');
  }
}

/**
 * Get DOTMLPF analysis by session ID
 */
async function handleGetDOTMLPF(
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
      `SELECT * FROM framework_sessions WHERE id = ? AND user_id = ? AND framework_type = 'dotmlpf'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'DOTMLPF analysis not found', 'NOT_FOUND');
    }

    const dotmlpfData: DOTMLPFData = JSON.parse(session.data);

    const response: DOTMLPFAnalysisResponse = {
      session_id: session.id,
      title: session.title,
      objective: dotmlpfData.objective,
      context: dotmlpfData.context,
      scope: dotmlpfData.scope,
      current_situation: dotmlpfData.current_situation,
      elements: dotmlpfData.elements,
      gap_summary: dotmlpfData.gap_summary,
      implementation_roadmap: dotmlpfData.implementation_roadmap,
      ai_suggestions: null,
      status: session.status,
      version: session.version,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get DOTMLPF error:', error);
    return createErrorResponse(500, 'Failed to retrieve DOTMLPF analysis', 'GET_ERROR');
  }
}

/**
 * Update DOTMLPF analysis
 */
async function handleUpdateDOTMLPF(
  request: AuthRequest,
  env: Env,
  sessionId: number
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    const body: DOTMLPFUpdateRequest = await request.json();
    const db = createDatabase(env);

    const session = await db.findOne<FrameworkSession>(
      `SELECT * FROM framework_sessions WHERE id = ? AND user_id = ? AND framework_type = 'dotmlpf'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'DOTMLPF analysis not found', 'NOT_FOUND');
    }

    const dotmlpfData: DOTMLPFData = JSON.parse(session.data);

    // Update fields
    if (body.objective !== undefined) dotmlpfData.objective = body.objective;
    if (body.context !== undefined) dotmlpfData.context = body.context;
    if (body.scope !== undefined) dotmlpfData.scope = body.scope;
    if (body.current_situation !== undefined) dotmlpfData.current_situation = body.current_situation;
    if (body.elements !== undefined) {
      for (const category of Object.keys(body.elements) as DOTMLPFCategory[]) {
        if (body.elements[category]) {
          dotmlpfData.elements[category] = body.elements[category] || [];
        }
      }
    }

    dotmlpfData.updated_at = new Date().toISOString();

    await db.update(
      'framework_sessions',
      {
        title: body.title || session.title,
        data: JSON.stringify(dotmlpfData),
        version: session.version + 1,
        status: body.status || session.status,
      },
      { id: sessionId }
    );

    const response: DOTMLPFAnalysisResponse = {
      session_id: sessionId,
      title: body.title || session.title,
      objective: dotmlpfData.objective,
      context: dotmlpfData.context,
      scope: dotmlpfData.scope,
      current_situation: dotmlpfData.current_situation,
      elements: dotmlpfData.elements,
      gap_summary: dotmlpfData.gap_summary,
      implementation_roadmap: dotmlpfData.implementation_roadmap,
      ai_suggestions: null,
      status: body.status || session.status,
      version: session.version + 1,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Update DOTMLPF error:', error);
    return createErrorResponse(500, 'Failed to update DOTMLPF analysis', 'UPDATE_ERROR');
  }
}

/**
 * Delete DOTMLPF analysis
 */
async function handleDeleteDOTMLPF(
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
      framework_type: 'dotmlpf',
    });

    if (deleted === 0) {
      return createErrorResponse(404, 'DOTMLPF analysis not found', 'NOT_FOUND');
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete DOTMLPF error:', error);
    return createErrorResponse(500, 'Failed to delete DOTMLPF analysis', 'DELETE_ERROR');
  }
}

/**
 * List user's DOTMLPF analyses
 */
async function handleListDOTMLPF(
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
        framework_type: 'dotmlpf',
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
    console.error('List DOTMLPF error:', error);
    return createErrorResponse(500, 'Failed to list DOTMLPF analyses', 'LIST_ERROR');
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