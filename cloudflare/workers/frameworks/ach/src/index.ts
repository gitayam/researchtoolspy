/**
 * ACH (Analysis of Competing Hypotheses) Framework Worker
 * Provides structured analysis of multiple competing hypotheses
 */

import { Env, AuthRequest, FrameworkSession } from '../../../shared/types';
import { createDatabase } from '../../../shared/database';
import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  createNotFoundResponse,
  createValidationErrorResponse,
} from '../../../shared/responses';
import { ACHData, Hypothesis, Evidence, ConsistencyRating } from './types';
import { generateACHSuggestions, analyzeHypothesis, evaluateEvidence } from './ai';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return handleACHRequest(request as AuthRequest, env, ctx);
  },
};

export async function handleACHRequest(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Route ACH-specific endpoints
  if (request.method === 'GET' && path.endsWith('/sessions')) {
    return handleListSessions(request, env);
  }

  if (request.method === 'POST' && path.endsWith('/sessions')) {
    return handleCreateSession(request, env);
  }

  const sessionMatch = path.match(/\/sessions\/(\d+)$/);
  if (sessionMatch) {
    const sessionId = parseInt(sessionMatch[1]);

    switch (request.method) {
      case 'GET':
        return handleGetSession(request, env, sessionId);
      case 'PUT':
        return handleUpdateSession(request, env, sessionId);
      case 'DELETE':
        return handleDeleteSession(request, env, sessionId);
    }
  }

  // ACH-specific analysis endpoints
  if (request.method === 'POST' && path.endsWith('/analyze')) {
    return handleAnalyze(request, env);
  }

  if (request.method === 'POST' && path.endsWith('/evaluate-evidence')) {
    return handleEvaluateEvidence(request, env);
  }

  if (request.method === 'POST' && path.endsWith('/generate-matrix')) {
    return handleGenerateMatrix(request, env);
  }

  return createErrorResponse(404, 'Endpoint not found');
}

async function handleListSessions(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required');
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20');

  const db = createDatabase(env);
  const result = await db.paginate('framework_sessions', page, pageSize, {
    where: {
      user_id: request.user.id,
      framework_type: 'ach',
    },
    orderBy: {
      column: 'updated_at',
      direction: 'desc',
    },
  });

  return createPaginatedResponse(
    result.items,
    result.page,
    result.pageSize,
    result.total
  );
}

async function handleCreateSession(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required');
  }

  const body = await request.json() as {
    title: string;
    description?: string;
    hypotheses?: Hypothesis[];
    evidence?: Evidence[];
    generateSuggestions?: boolean;
  };

  if (!body.title) {
    return createValidationErrorResponse({
      title: ['Title is required'],
    });
  }

  const achData: ACHData = {
    title: body.title,
    description: body.description || '',
    hypotheses: body.hypotheses || [],
    evidence: body.evidence || [],
    matrix: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Generate AI suggestions if requested
  if (body.generateSuggestions && env.OPENAI_API_KEY) {
    const suggestions = await generateACHSuggestions(
      body.title,
      body.description || '',
      env
    );

    if (suggestions.hypotheses) {
      achData.hypotheses = [...achData.hypotheses, ...suggestions.hypotheses];
    }
    if (suggestions.evidence) {
      achData.evidence = [...achData.evidence, ...suggestions.evidence];
    }

    achData.ai_suggestions = suggestions;
  }

  // Generate initial matrix
  achData.matrix = generateMatrix(achData.hypotheses, achData.evidence);

  const db = createDatabase(env);
  const session = await db.insert('framework_sessions', {
    title: body.title,
    description: body.description,
    framework_type: 'ach',
    status: 'draft',
    user_id: request.user.id,
    data: JSON.stringify(achData),
    ai_analysis_count: body.generateSuggestions ? 1 : 0,
  });

  return createSuccessResponse(session);
}

async function handleGetSession(
  request: AuthRequest,
  env: Env,
  sessionId: number
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required');
  }

  const db = createDatabase(env);
  const session = await db.findOne('framework_sessions', {
    id: sessionId,
    user_id: request.user.id,
    framework_type: 'ach',
  });

  if (!session) {
    return createNotFoundResponse('ACH session');
  }

  // Parse the stored data
  if (session.data) {
    session.data = JSON.parse(session.data);
  }

  return createSuccessResponse(session);
}

async function handleUpdateSession(
  request: AuthRequest,
  env: Env,
  sessionId: number
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required');
  }

  const body = await request.json() as {
    title?: string;
    description?: string;
    status?: string;
    data?: ACHData;
  };

  const db = createDatabase(env);
  const existing = await db.findOne('framework_sessions', {
    id: sessionId,
    user_id: request.user.id,
    framework_type: 'ach',
  });

  if (!existing) {
    return createNotFoundResponse('ACH session');
  }

  const updates: any = {
    updated_at: new Date().toISOString(),
  };

  if (body.title) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status) updates.status = body.status;

  if (body.data) {
    // Regenerate matrix if hypotheses or evidence changed
    body.data.matrix = generateMatrix(body.data.hypotheses, body.data.evidence);
    body.data.updated_at = new Date().toISOString();
    updates.data = JSON.stringify(body.data);
  }

  const updated = await db.update('framework_sessions', sessionId, updates);

  if (updated.data) {
    updated.data = JSON.parse(updated.data);
  }

  return createSuccessResponse(updated);
}

async function handleDeleteSession(
  request: AuthRequest,
  env: Env,
  sessionId: number
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required');
  }

  const db = createDatabase(env);
  const existing = await db.findOne('framework_sessions', {
    id: sessionId,
    user_id: request.user.id,
    framework_type: 'ach',
  });

  if (!existing) {
    return createNotFoundResponse('ACH session');
  }

  await db.delete('framework_sessions', sessionId);

  return createSuccessResponse({ deleted: true });
}

async function handleAnalyze(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required');
  }

  const body = await request.json() as {
    sessionId: number;
    hypothesisId?: string;
  };

  if (!body.sessionId) {
    return createValidationErrorResponse({
      sessionId: ['Session ID is required'],
    });
  }

  const db = createDatabase(env);
  const session = await db.findOne('framework_sessions', {
    id: body.sessionId,
    user_id: request.user.id,
    framework_type: 'ach',
  });

  if (!session) {
    return createNotFoundResponse('ACH session');
  }

  const achData: ACHData = JSON.parse(session.data);

  if (!env.OPENAI_API_KEY) {
    return createErrorResponse(503, 'AI service not configured');
  }

  // Analyze specific hypothesis or all
  if (body.hypothesisId) {
    const hypothesis = achData.hypotheses.find(h => h.id === body.hypothesisId);
    if (!hypothesis) {
      return createNotFoundResponse('Hypothesis');
    }

    const analysis = await analyzeHypothesis(hypothesis, achData.evidence, env);
    hypothesis.analysis = analysis.analysis;
    hypothesis.likelihood = analysis.likelihood;
  } else {
    // Analyze all hypotheses
    for (const hypothesis of achData.hypotheses) {
      const analysis = await analyzeHypothesis(hypothesis, achData.evidence, env);
      hypothesis.analysis = analysis.analysis;
      hypothesis.likelihood = analysis.likelihood;
    }
  }

  // Update session
  await db.update('framework_sessions', body.sessionId, {
    data: JSON.stringify(achData),
    ai_analysis_count: (session.ai_analysis_count || 0) + 1,
    updated_at: new Date().toISOString(),
  });

  return createSuccessResponse(achData);
}

async function handleEvaluateEvidence(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required');
  }

  const body = await request.json() as {
    evidence: Evidence;
    hypotheses: Hypothesis[];
  };

  if (!body.evidence || !body.hypotheses) {
    return createValidationErrorResponse({
      evidence: ['Evidence is required'],
      hypotheses: ['Hypotheses are required'],
    });
  }

  if (!env.OPENAI_API_KEY) {
    return createErrorResponse(503, 'AI service not configured');
  }

  const evaluation = await evaluateEvidence(body.evidence, body.hypotheses, env);

  return createSuccessResponse(evaluation);
}

async function handleGenerateMatrix(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  if (!request.user) {
    return createErrorResponse(401, 'Authentication required');
  }

  const body = await request.json() as {
    hypotheses: Hypothesis[];
    evidence: Evidence[];
  };

  if (!body.hypotheses || !body.evidence) {
    return createValidationErrorResponse({
      hypotheses: ['Hypotheses are required'],
      evidence: ['Evidence are required'],
    });
  }

  const matrix = generateMatrix(body.hypotheses, body.evidence);

  return createSuccessResponse({ matrix });
}

/**
 * Generate consistency matrix for hypotheses and evidence
 */
function generateMatrix(
  hypotheses: Hypothesis[],
  evidence: Evidence[]
): Record<string, Record<string, ConsistencyRating>> {
  const matrix: Record<string, Record<string, ConsistencyRating>> = {};

  hypotheses.forEach(hypothesis => {
    matrix[hypothesis.id] = {};
    evidence.forEach(evidence => {
      // Find existing rating or default to neutral
      const existingRating = hypothesis.evidence_ratings?.find(
        er => er.evidence_id === evidence.id
      );
      matrix[hypothesis.id][evidence.id] = existingRating?.consistency || 'neutral';
    });
  });

  return matrix;
}