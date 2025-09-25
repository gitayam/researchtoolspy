/**
 * PMESII-PT Framework Worker
 * Handles PMESII-PT (Political, Military, Economic, Social, Information, Infrastructure - Physical Environment, Time) analysis
 */

import { Env, AuthRequest, FrameworkSession } from '../../../shared/types';
import { createDatabase } from '../../../shared/database';
import { createErrorResponse, validateRequestBody } from '../../../gateway/src/middleware/errorHandler';
import { generateAISuggestions, validateWithAI } from './ai';
import { exportPMESII } from './export';
import {
  PMESIICreateRequest,
  PMESIIAnalysisResponse,
  PMESIIUpdateRequest,
  PMESIIData,
  PMESIIExportFormat,
  PMESIICategory,
  PMESIIFactor,
} from './types';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return handlePMESIIRequest(request as AuthRequest, env, ctx);
  },
};

/**
 * Main PMESII-PT request handler
 */
export async function handlePMESIIRequest(
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
  const pmesiiPath = path.replace('/api/v1/frameworks/pmesii-pt', '');

  // Route to appropriate handler
  switch (true) {
    case (pmesiiPath === '' || pmesiiPath === '/' || pmesiiPath === '/create') && method === 'POST':
      return addCorsHeaders(await handleCreatePMESII(request, env), corsHeaders);

    case pmesiiPath.match(/^\/(\d+)$/) && method === 'GET':
      return addCorsHeaders(await handleGetPMESII(request, env, parseInt(pmesiiPath.match(/^\/(\d+)$/)[1])), corsHeaders);

    case pmesiiPath.match(/^\/(\d+)$/) && method === 'PUT':
      return addCorsHeaders(await handleUpdatePMESII(request, env, parseInt(pmesiiPath.match(/^\/(\d+)$/)[1])), corsHeaders);

    case pmesiiPath.match(/^\/(\d+)$/) && method === 'DELETE':
      return addCorsHeaders(await handleDeletePMESII(request, env, parseInt(pmesiiPath.match(/^\/(\d+)$/)[1])), corsHeaders);

    case pmesiiPath.match(/^\/(\d+)\/ai-suggestions$/) && method === 'POST':
      return addCorsHeaders(await handleAISuggestions(request, env, parseInt(pmesiiPath.match(/^\/(\d+)/)[1])), corsHeaders);

    case pmesiiPath.match(/^\/(\d+)\/validate$/) && method === 'POST':
      return addCorsHeaders(await handleAIValidation(request, env, parseInt(pmesiiPath.match(/^\/(\d+)/)[1])), corsHeaders);

    case pmesiiPath.match(/^\/(\d+)\/export$/) && method === 'POST':
      return addCorsHeaders(await handleExport(request, env, parseInt(pmesiiPath.match(/^\/(\d+)/)[1])), corsHeaders);

    case pmesiiPath.match(/^\/(\d+)\/analyze$/) && method === 'POST':
      return addCorsHeaders(await handleAnalyze(request, env, parseInt(pmesiiPath.match(/^\/(\d+)/)[1])), corsHeaders);

    case pmesiiPath === '/list' && method === 'GET':
      return addCorsHeaders(await handleListPMESII(request, env), corsHeaders);

    case pmesiiPath === '/templates/list' && method === 'GET':
      return addCorsHeaders(await handleListTemplates(request, env), corsHeaders);

    default:
      return addCorsHeaders(createErrorResponse(404, 'PMESII-PT endpoint not found', 'ENDPOINT_NOT_FOUND'), corsHeaders);
  }
}

/**
 * Create new PMESII-PT analysis
 */
async function handleCreatePMESII(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    const body: PMESIICreateRequest = await request.json();

    // Validate input
    const validation = validateRequestBody(body, {
      title: { required: true, type: 'string', minLength: 1 },
      objective: { required: true, type: 'string', minLength: 1 },
      context: { required: false, type: 'string' },
      area_of_interest: { required: false, type: 'string' },
      time_frame: { required: false, type: 'string' },
    });

    if (validation) {
      return createErrorResponse(400, 'Validation failed', 'VALIDATION_ERROR', validation.fields);
    }

    const db = createDatabase(env);

    // Initialize PMESII-PT data with empty categories
    const pmesiiData: PMESIIData = {
      objective: body.objective,
      context: body.context || '',
      area_of_interest: body.area_of_interest,
      time_frame: body.time_frame,
      factors: {
        political: body.initial_factors?.political || [],
        military: body.initial_factors?.military || [],
        economic: body.initial_factors?.economic || [],
        social: body.initial_factors?.social || [],
        information: body.initial_factors?.information || [],
        infrastructure: body.initial_factors?.infrastructure || [],
        physical_environment: body.initial_factors?.physical_environment || [],
        time: body.initial_factors?.time || [],
      },
      interconnections: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Get AI suggestions if requested
    let aiSuggestions = null;
    if (body.request_ai_suggestions && env.OPENAI_API_KEY) {
      try {
        aiSuggestions = await generateAISuggestions(pmesiiData, env);

        // Merge AI suggestions with initial data
        if (aiSuggestions && aiSuggestions.factors) {
          for (const category of Object.keys(aiSuggestions.factors) as PMESIICategory[]) {
            if (aiSuggestions.factors[category]) {
              pmesiiData.factors[category] = mergeFactors(
                pmesiiData.factors[category],
                aiSuggestions.factors[category] || []
              );
            }
          }
        }

        if (aiSuggestions && aiSuggestions.interconnections) {
          pmesiiData.interconnections = aiSuggestions.interconnections;
        }

        pmesiiData.ai_suggestions = aiSuggestions;
      } catch (error) {
        console.error('AI suggestions error:', error);
        // Continue without AI suggestions
      }
    }

    // Create framework session
    const sessionId = await db.insert('framework_sessions', {
      title: body.title,
      description: body.objective,
      framework_type: 'pmesii_pt',
      status: 'draft',
      user_id: request.user.id,
      data: JSON.stringify(pmesiiData),
      config: JSON.stringify({ includeAI: body.request_ai_suggestions }),
      tags: body.tags ? JSON.stringify(body.tags) : null,
      version: 1,
      ai_suggestions: aiSuggestions ? JSON.stringify(aiSuggestions) : null,
      ai_analysis_count: aiSuggestions ? 1 : 0,
    });

    const response: PMESIIAnalysisResponse = {
      session_id: sessionId,
      title: body.title,
      objective: pmesiiData.objective,
      context: pmesiiData.context,
      area_of_interest: pmesiiData.area_of_interest,
      time_frame: pmesiiData.time_frame,
      factors: pmesiiData.factors,
      interconnections: pmesiiData.interconnections,
      ai_suggestions: aiSuggestions,
      status: 'draft',
      version: 1,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Create PMESII-PT error:', error);
    return createErrorResponse(500, 'Failed to create PMESII-PT analysis', 'CREATE_ERROR');
  }
}

/**
 * Get PMESII-PT analysis by session ID
 */
async function handleGetPMESII(
  request: AuthRequest,
  env: Env,
  sessionId: number
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    const db = createDatabase(env);

    // Get session
    const session = await db.findOne<FrameworkSession>(
      `SELECT * FROM framework_sessions
       WHERE id = ? AND user_id = ? AND framework_type = 'pmesii_pt'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'PMESII-PT analysis not found', 'NOT_FOUND');
    }

    const pmesiiData: PMESIIData = JSON.parse(session.data);
    const aiSuggestions = session.ai_suggestions ? JSON.parse(session.ai_suggestions) : null;

    const response: PMESIIAnalysisResponse = {
      session_id: session.id,
      title: session.title,
      objective: pmesiiData.objective,
      context: pmesiiData.context,
      area_of_interest: pmesiiData.area_of_interest,
      time_frame: pmesiiData.time_frame,
      factors: pmesiiData.factors,
      interconnections: pmesiiData.interconnections,
      ai_suggestions: aiSuggestions,
      status: session.status,
      version: session.version,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get PMESII-PT error:', error);
    return createErrorResponse(500, 'Failed to retrieve PMESII-PT analysis', 'GET_ERROR');
  }
}

/**
 * Update PMESII-PT analysis
 */
async function handleUpdatePMESII(
  request: AuthRequest,
  env: Env,
  sessionId: number
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    const body: PMESIIUpdateRequest = await request.json();
    const db = createDatabase(env);

    // Get existing session
    const session = await db.findOne<FrameworkSession>(
      `SELECT * FROM framework_sessions
       WHERE id = ? AND user_id = ? AND framework_type = 'pmesii_pt'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'PMESII-PT analysis not found', 'NOT_FOUND');
    }

    const pmesiiData: PMESIIData = JSON.parse(session.data);

    // Update fields
    if (body.objective !== undefined) pmesiiData.objective = body.objective;
    if (body.context !== undefined) pmesiiData.context = body.context;
    if (body.area_of_interest !== undefined) pmesiiData.area_of_interest = body.area_of_interest;
    if (body.time_frame !== undefined) pmesiiData.time_frame = body.time_frame;
    if (body.factors !== undefined) {
      for (const category of Object.keys(body.factors) as PMESIICategory[]) {
        if (body.factors[category]) {
          pmesiiData.factors[category] = body.factors[category] || [];
        }
      }
    }

    pmesiiData.updated_at = new Date().toISOString();

    // Update session
    await db.update(
      'framework_sessions',
      {
        title: body.title || session.title,
        data: JSON.stringify(pmesiiData),
        version: session.version + 1,
        status: body.status || session.status,
      },
      { id: sessionId }
    );

    const response: PMESIIAnalysisResponse = {
      session_id: sessionId,
      title: body.title || session.title,
      objective: pmesiiData.objective,
      context: pmesiiData.context,
      area_of_interest: pmesiiData.area_of_interest,
      time_frame: pmesiiData.time_frame,
      factors: pmesiiData.factors,
      interconnections: pmesiiData.interconnections,
      ai_suggestions: session.ai_suggestions ? JSON.parse(session.ai_suggestions) : null,
      status: body.status || session.status,
      version: session.version + 1,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Update PMESII-PT error:', error);
    return createErrorResponse(500, 'Failed to update PMESII-PT analysis', 'UPDATE_ERROR');
  }
}

/**
 * Delete PMESII-PT analysis
 */
async function handleDeletePMESII(
  request: AuthRequest,
  env: Env,
  sessionId: number
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    const db = createDatabase(env);

    // Check ownership and delete
    const deleted = await db.delete('framework_sessions', {
      id: sessionId,
      user_id: request.user.id,
      framework_type: 'pmesii_pt',
    });

    if (deleted === 0) {
      return createErrorResponse(404, 'PMESII-PT analysis not found', 'NOT_FOUND');
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete PMESII-PT error:', error);
    return createErrorResponse(500, 'Failed to delete PMESII-PT analysis', 'DELETE_ERROR');
  }
}

/**
 * Generate AI suggestions for PMESII-PT
 */
async function handleAISuggestions(
  request: AuthRequest,
  env: Env,
  sessionId: number
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  if (!env.OPENAI_API_KEY) {
    return createErrorResponse(503, 'AI service not available', 'AI_UNAVAILABLE');
  }

  try {
    const db = createDatabase(env);

    // Get session
    const session = await db.findOne<FrameworkSession>(
      `SELECT * FROM framework_sessions
       WHERE id = ? AND user_id = ? AND framework_type = 'pmesii_pt'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'PMESII-PT analysis not found', 'NOT_FOUND');
    }

    const pmesiiData: PMESIIData = JSON.parse(session.data);

    // Generate AI suggestions
    const suggestions = await generateAISuggestions(pmesiiData, env);

    // Update session with new suggestions
    await db.update(
      'framework_sessions',
      {
        ai_suggestions: JSON.stringify(suggestions),
        ai_analysis_count: session.ai_analysis_count + 1,
      },
      { id: sessionId }
    );

    return new Response(JSON.stringify(suggestions), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI suggestions error:', error);
    return createErrorResponse(500, 'Failed to generate AI suggestions', 'AI_ERROR');
  }
}

/**
 * Validate PMESII-PT with AI
 */
async function handleAIValidation(
  request: AuthRequest,
  env: Env,
  sessionId: number
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  if (!env.OPENAI_API_KEY) {
    return createErrorResponse(503, 'AI service not available', 'AI_UNAVAILABLE');
  }

  try {
    const db = createDatabase(env);

    // Get session
    const session = await db.findOne<FrameworkSession>(
      `SELECT * FROM framework_sessions
       WHERE id = ? AND user_id = ? AND framework_type = 'pmesii_pt'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'PMESII-PT analysis not found', 'NOT_FOUND');
    }

    const pmesiiData: PMESIIData = JSON.parse(session.data);

    // Validate with AI
    const validation = await validateWithAI(pmesiiData, env);

    return new Response(JSON.stringify(validation), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI validation error:', error);
    return createErrorResponse(500, 'Failed to validate PMESII-PT analysis', 'VALIDATION_ERROR');
  }
}

/**
 * Export PMESII-PT analysis
 */
async function handleExport(
  request: AuthRequest,
  env: Env,
  sessionId: number
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    const body: { format: PMESIIExportFormat } = await request.json();

    if (!['pdf', 'docx', 'json'].includes(body.format)) {
      return createErrorResponse(400, 'Invalid export format', 'INVALID_FORMAT');
    }

    const db = createDatabase(env);

    // Get session
    const session = await db.findOne<FrameworkSession>(
      `SELECT * FROM framework_sessions
       WHERE id = ? AND user_id = ? AND framework_type = 'pmesii_pt'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'PMESII-PT analysis not found', 'NOT_FOUND');
    }

    const pmesiiData: PMESIIData = JSON.parse(session.data);

    // Generate export
    const exportResult = await exportPMESII(
      session,
      pmesiiData,
      body.format,
      env,
      request.user.id
    );

    return new Response(JSON.stringify(exportResult), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Export error:', error);
    return createErrorResponse(500, 'Failed to export PMESII-PT analysis', 'EXPORT_ERROR');
  }
}

/**
 * Analyze PMESII-PT data
 */
async function handleAnalyze(
  request: AuthRequest,
  env: Env,
  sessionId: number
): Promise<Response> {
  // TODO: Implement comprehensive PMESII-PT analysis
  return createErrorResponse(501, 'PMESII-PT analysis not yet implemented', 'NOT_IMPLEMENTED');
}

/**
 * List user's PMESII-PT analyses
 */
async function handleListPMESII(
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
        framework_type: 'pmesii_pt',
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
    console.error('List PMESII-PT error:', error);
    return createErrorResponse(500, 'Failed to list PMESII-PT analyses', 'LIST_ERROR');
  }
}

/**
 * List PMESII-PT templates
 */
async function handleListTemplates(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  try {
    const db = createDatabase(env);

    const templates = await db.find('framework_templates', {
      where: {
        framework_type: 'pmesii_pt',
        is_public: 1,
      },
      orderBy: {
        column: 'usage_count',
        direction: 'desc',
      },
      limit: 20,
    });

    return new Response(JSON.stringify(templates), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('List templates error:', error);
    return createErrorResponse(500, 'Failed to list templates', 'LIST_ERROR');
  }
}

/**
 * Merge factors removing duplicates while preserving order
 */
function mergeFactors(arr1: PMESIIFactor[], arr2: PMESIIFactor[]): PMESIIFactor[] {
  const seen = new Set(arr1.map(f => f.id));
  const result = [...arr1];

  for (const factor of arr2) {
    if (!seen.has(factor.id)) {
      seen.add(factor.id);
      result.push(factor);
    }
  }

  return result;
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