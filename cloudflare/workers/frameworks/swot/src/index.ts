/**
 * SWOT Framework Worker
 * Handles SWOT (Strengths, Weaknesses, Opportunities, Threats) analysis
 */

import { Env, AuthRequest, FrameworkSession } from '../../../shared/types';
import { createDatabase } from '../../../shared/database';
import { createErrorResponse, validateRequestBody } from '../../../gateway/src/middleware/errorHandler';
import { generateAISuggestions, validateWithAI } from './ai';
import { exportSWOT } from './export';
import {
  SWOTCreateRequest,
  SWOTAnalysisResponse,
  SWOTUpdateRequest,
  SWOTData,
  SWOTExportFormat,
} from './types';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return handleSWOTRequest(request as AuthRequest, env, ctx);
  },
};

/**
 * Main SWOT request handler
 */
export async function handleSWOTRequest(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Remove base path if present
  const swotPath = path.replace('/api/v1/frameworks/swot', '');

  // Route to appropriate handler
  switch (true) {
    case (swotPath === '' || swotPath === '/' || swotPath === '/create') && method === 'POST':
      return handleCreateSWOT(request, env);

    case swotPath.match(/^\/(\d+)$/) && method === 'GET':
      return handleGetSWOT(request, env, parseInt(swotPath.match(/^\/(\d+)$/)[1]));

    case swotPath.match(/^\/(\d+)$/) && method === 'PUT':
      return handleUpdateSWOT(request, env, parseInt(swotPath.match(/^\/(\d+)$/)[1]));

    case swotPath.match(/^\/(\d+)$/) && method === 'DELETE':
      return handleDeleteSWOT(request, env, parseInt(swotPath.match(/^\/(\d+)$/)[1]));

    case swotPath.match(/^\/(\d+)\/ai-suggestions$/) && method === 'POST':
      return handleAISuggestions(request, env, parseInt(swotPath.match(/^\/(\d+)/)[1]));

    case swotPath.match(/^\/(\d+)\/validate$/) && method === 'POST':
      return handleAIValidation(request, env, parseInt(swotPath.match(/^\/(\d+)/)[1]));

    case swotPath.match(/^\/(\d+)\/export$/) && method === 'POST':
      return handleExport(request, env, parseInt(swotPath.match(/^\/(\d+)/)[1]));

    case swotPath === '/templates/list' && method === 'GET':
      return handleListTemplates(request, env);

    case swotPath === '/ai/industry-analysis' && method === 'POST':
      return handleIndustryAnalysis(request, env);

    case swotPath === '/ai/competitive-intelligence' && method === 'POST':
      return handleCompetitiveIntelligence(request, env);

    case swotPath === '/ai/predictive-modeling' && method === 'POST':
      return handlePredictiveModeling(request, env);

    case swotPath === '/list' && method === 'GET':
      return handleListSWOT(request, env);

    default:
      return createErrorResponse(404, 'SWOT endpoint not found', 'ENDPOINT_NOT_FOUND');
  }
}

/**
 * Create new SWOT analysis
 */
async function handleCreateSWOT(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    const body: SWOTCreateRequest = await request.json();

    // Validate input
    const validation = validateRequestBody(body, {
      title: { required: true, type: 'string', minLength: 1 },
      objective: { required: true, type: 'string', minLength: 1 },
      context: { required: false, type: 'string' },
      initial_strengths: { required: false, type: 'array' },
      initial_weaknesses: { required: false, type: 'array' },
      initial_opportunities: { required: false, type: 'array' },
      initial_threats: { required: false, type: 'array' },
    });

    if (validation) {
      return createErrorResponse(400, 'Validation failed', 'VALIDATION_ERROR', validation.fields);
    }

    const db = createDatabase(env);

    // Initialize SWOT data
    const swotData: SWOTData = {
      objective: body.objective,
      context: body.context || '',
      strengths: body.initial_strengths || [],
      weaknesses: body.initial_weaknesses || [],
      opportunities: body.initial_opportunities || [],
      threats: body.initial_threats || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Get AI suggestions if requested
    let aiSuggestions = null;
    if (body.request_ai_suggestions && env.OPENAI_API_KEY) {
      try {
        aiSuggestions = await generateAISuggestions(swotData, env);

        // Merge AI suggestions with initial data
        if (aiSuggestions) {
          swotData.strengths = mergUnique(swotData.strengths, aiSuggestions.strengths || []);
          swotData.weaknesses = mergeUnique(swotData.weaknesses, aiSuggestions.weaknesses || []);
          swotData.opportunities = mergeUnique(swotData.opportunities, aiSuggestions.opportunities || []);
          swotData.threats = mergeUnique(swotData.threats, aiSuggestions.threats || []);
          swotData.ai_suggestions = aiSuggestions;
        }
      } catch (error) {
        console.error('AI suggestions error:', error);
        // Continue without AI suggestions
      }
    }

    // Create framework session
    const sessionId = await db.insert('framework_sessions', {
      title: body.title,
      description: body.objective,
      framework_type: 'swot',
      status: 'draft',
      user_id: request.user.id,
      data: JSON.stringify(swotData),
      config: JSON.stringify({ includeAI: body.request_ai_suggestions }),
      tags: body.tags ? JSON.stringify(body.tags) : null,
      version: 1,
      ai_suggestions: aiSuggestions ? JSON.stringify(aiSuggestions) : null,
      ai_analysis_count: aiSuggestions ? 1 : 0,
    });

    const response: SWOTAnalysisResponse = {
      session_id: sessionId,
      title: body.title,
      objective: swotData.objective,
      context: swotData.context,
      strengths: swotData.strengths,
      weaknesses: swotData.weaknesses,
      opportunities: swotData.opportunities,
      threats: swotData.threats,
      ai_suggestions: aiSuggestions,
      status: 'draft',
      version: 1,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Create SWOT error:', error);
    return createErrorResponse(500, 'Failed to create SWOT analysis', 'CREATE_ERROR');
  }
}

/**
 * Get SWOT analysis by session ID
 */
async function handleGetSWOT(
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
       WHERE id = ? AND user_id = ? AND framework_type = 'swot'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'SWOT analysis not found', 'NOT_FOUND');
    }

    const swotData: SWOTData = JSON.parse(session.data);
    const aiSuggestions = session.ai_suggestions ? JSON.parse(session.ai_suggestions) : null;

    const response: SWOTAnalysisResponse = {
      session_id: session.id,
      title: session.title,
      objective: swotData.objective,
      context: swotData.context,
      strengths: swotData.strengths,
      weaknesses: swotData.weaknesses,
      opportunities: swotData.opportunities,
      threats: swotData.threats,
      ai_suggestions: aiSuggestions,
      status: session.status,
      version: session.version,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get SWOT error:', error);
    return createErrorResponse(500, 'Failed to retrieve SWOT analysis', 'GET_ERROR');
  }
}

/**
 * Update SWOT analysis
 */
async function handleUpdateSWOT(
  request: AuthRequest,
  env: Env,
  sessionId: number
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    const body: SWOTUpdateRequest = await request.json();
    const db = createDatabase(env);

    // Get existing session
    const session = await db.findOne<FrameworkSession>(
      `SELECT * FROM framework_sessions
       WHERE id = ? AND user_id = ? AND framework_type = 'swot'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'SWOT analysis not found', 'NOT_FOUND');
    }

    const swotData: SWOTData = JSON.parse(session.data);

    // Update fields
    if (body.objective !== undefined) swotData.objective = body.objective;
    if (body.context !== undefined) swotData.context = body.context;
    if (body.strengths !== undefined) swotData.strengths = body.strengths;
    if (body.weaknesses !== undefined) swotData.weaknesses = body.weaknesses;
    if (body.opportunities !== undefined) swotData.opportunities = body.opportunities;
    if (body.threats !== undefined) swotData.threats = body.threats;

    swotData.updated_at = new Date().toISOString();

    // Update session
    await db.update(
      'framework_sessions',
      {
        title: body.title || session.title,
        data: JSON.stringify(swotData),
        version: session.version + 1,
        status: body.status || session.status,
      },
      { id: sessionId }
    );

    const response: SWOTAnalysisResponse = {
      session_id: sessionId,
      title: body.title || session.title,
      objective: swotData.objective,
      context: swotData.context,
      strengths: swotData.strengths,
      weaknesses: swotData.weaknesses,
      opportunities: swotData.opportunities,
      threats: swotData.threats,
      ai_suggestions: session.ai_suggestions ? JSON.parse(session.ai_suggestions) : null,
      status: body.status || session.status,
      version: session.version + 1,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Update SWOT error:', error);
    return createErrorResponse(500, 'Failed to update SWOT analysis', 'UPDATE_ERROR');
  }
}

/**
 * Delete SWOT analysis
 */
async function handleDeleteSWOT(
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
      framework_type: 'swot',
    });

    if (deleted === 0) {
      return createErrorResponse(404, 'SWOT analysis not found', 'NOT_FOUND');
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete SWOT error:', error);
    return createErrorResponse(500, 'Failed to delete SWOT analysis', 'DELETE_ERROR');
  }
}

/**
 * Generate AI suggestions for SWOT
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
       WHERE id = ? AND user_id = ? AND framework_type = 'swot'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'SWOT analysis not found', 'NOT_FOUND');
    }

    const swotData: SWOTData = JSON.parse(session.data);

    // Generate AI suggestions
    const suggestions = await generateAISuggestions(swotData, env);

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
 * Validate SWOT with AI
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
       WHERE id = ? AND user_id = ? AND framework_type = 'swot'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'SWOT analysis not found', 'NOT_FOUND');
    }

    const swotData: SWOTData = JSON.parse(session.data);

    // Validate with AI
    const validation = await validateWithAI(swotData, env);

    return new Response(JSON.stringify(validation), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI validation error:', error);
    return createErrorResponse(500, 'Failed to validate SWOT analysis', 'VALIDATION_ERROR');
  }
}

/**
 * Export SWOT analysis
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
    const body: { format: SWOTExportFormat } = await request.json();

    if (!['pdf', 'docx', 'json'].includes(body.format)) {
      return createErrorResponse(400, 'Invalid export format', 'INVALID_FORMAT');
    }

    const db = createDatabase(env);

    // Get session
    const session = await db.findOne<FrameworkSession>(
      `SELECT * FROM framework_sessions
       WHERE id = ? AND user_id = ? AND framework_type = 'swot'`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, 'SWOT analysis not found', 'NOT_FOUND');
    }

    const swotData: SWOTData = JSON.parse(session.data);

    // Generate export
    const exportResult = await exportSWOT(
      session,
      swotData,
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
    return createErrorResponse(500, 'Failed to export SWOT analysis', 'EXPORT_ERROR');
  }
}

/**
 * List SWOT templates
 */
async function handleListTemplates(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  try {
    const db = createDatabase(env);

    const templates = await db.find('framework_templates', {
      where: {
        framework_type: 'swot',
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
 * List user's SWOT analyses
 */
async function handleListSWOT(
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
        framework_type: 'swot',
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
    console.error('List SWOT error:', error);
    return createErrorResponse(500, 'Failed to list SWOT analyses', 'LIST_ERROR');
  }
}

/**
 * Handle industry analysis
 */
async function handleIndustryAnalysis(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  // TODO: Implement industry-specific SWOT analysis
  return createErrorResponse(501, 'Industry analysis not yet implemented', 'NOT_IMPLEMENTED');
}

/**
 * Handle competitive intelligence
 */
async function handleCompetitiveIntelligence(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  // TODO: Implement competitive intelligence analysis
  return createErrorResponse(501, 'Competitive intelligence not yet implemented', 'NOT_IMPLEMENTED');
}

/**
 * Handle predictive modeling
 */
async function handlePredictiveModeling(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  // TODO: Implement predictive SWOT modeling
  return createErrorResponse(501, 'Predictive modeling not yet implemented', 'NOT_IMPLEMENTED');
}

/**
 * Merge arrays removing duplicates while preserving order
 */
function mergeUnique(arr1: string[], arr2: string[]): string[] {
  const seen = new Set(arr1);
  const result = [...arr1];

  for (const item of arr2) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }

  return result;
}