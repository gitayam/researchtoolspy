#!/bin/bash

# Framework configurations with their specific details
frameworks=(
    "pest|PEST|pest|Political, Economic, Social, Technological analysis"
    "vrio|VRIO|vrio|Value, Rarity, Imitability, Organization analysis"
    "trend|TREND|trend|Trend Analysis Framework"
    "dime|DIME|dime|Diplomatic, Information, Military, Economic analysis"
    "cog|COG|cog|Center of Gravity Analysis"
    "stakeholder|STAKEHOLDER|stakeholder|Stakeholder Analysis Framework"
    "starbursting|STARBURSTING|starbursting|Starbursting Question Framework"
    "fundamental-flow|FUNDAMENTAL_FLOW|fundamental_flow|Fundamental Flow Analysis"
    "behavior|BEHAVIOR|behavioral_analysis|Behavioral Analysis Framework"
    "causeway|CAUSEWAY|causeway|Causeway Analysis Framework"
    "surveillance|SURVEILLANCE|surveillance|Surveillance Framework"
    "deception|DECEPTION|deception_detection|Deception Detection Framework"
)

BASE_DIR="/Users/sac/Git/researchtoolspy/cloudflare/workers/frameworks"

# Function to create a basic index.ts template
create_index_ts() {
    local framework=$1
    local NAME=$2
    local db_type=$3
    local description=$4

    cat > "$BASE_DIR/$framework/src/index.ts" << EOF
/**
 * $NAME Framework Worker
 * $description
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
    return handle${NAME}Request(request as AuthRequest, env, ctx);
  },
};

/**
 * Main $NAME request handler
 */
export async function handle${NAME}Request(
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
  const ${framework}Path = path.replace('/api/v1/frameworks/$framework', '');

  // Route to appropriate handler
  switch (true) {
    case (${framework}Path === '' || ${framework}Path === '/' || ${framework}Path === '/create') && method === 'POST':
      return addCorsHeaders(await handleCreate${NAME}(request, env), corsHeaders);

    case ${framework}Path.match(/^\/(\d+)$/) && method === 'GET':
      return addCorsHeaders(await handleGet${NAME}(request, env, parseInt(${framework}Path.match(/^\/(\d+)$/)[1])), corsHeaders);

    case ${framework}Path.match(/^\/(\d+)$/) && method === 'PUT':
      return addCorsHeaders(await handleUpdate${NAME}(request, env, parseInt(${framework}Path.match(/^\/(\d+)$/)[1])), corsHeaders);

    case ${framework}Path.match(/^\/(\d+)$/) && method === 'DELETE':
      return addCorsHeaders(await handleDelete${NAME}(request, env, parseInt(${framework}Path.match(/^\/(\d+)$/)[1])), corsHeaders);

    case ${framework}Path === '/list' && method === 'GET':
      return addCorsHeaders(await handleList${NAME}(request, env), corsHeaders);

    default:
      return addCorsHeaders(createErrorResponse(404, '$NAME endpoint not found', 'ENDPOINT_NOT_FOUND'), corsHeaders);
  }
}

/**
 * Create new $NAME analysis
 */
async function handleCreate${NAME}(
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
      framework_type: '$db_type',
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
    console.error('Create $NAME error:', error);
    return createErrorResponse(500, 'Failed to create $NAME analysis', 'CREATE_ERROR');
  }
}

/**
 * Get $NAME analysis by session ID
 */
async function handleGet${NAME}(
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
      \`SELECT * FROM framework_sessions WHERE id = ? AND user_id = ? AND framework_type = '$db_type'\`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, '$NAME analysis not found', 'NOT_FOUND');
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
    console.error('Get $NAME error:', error);
    return createErrorResponse(500, 'Failed to retrieve $NAME analysis', 'GET_ERROR');
  }
}

/**
 * Update $NAME analysis
 */
async function handleUpdate${NAME}(
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
      \`SELECT * FROM framework_sessions WHERE id = ? AND user_id = ? AND framework_type = '$db_type'\`,
      [sessionId, request.user.id]
    );

    if (!session) {
      return createErrorResponse(404, '$NAME analysis not found', 'NOT_FOUND');
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
    console.error('Update $NAME error:', error);
    return createErrorResponse(500, 'Failed to update $NAME analysis', 'UPDATE_ERROR');
  }
}

/**
 * Delete $NAME analysis
 */
async function handleDelete${NAME}(
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
      framework_type: '$db_type',
    });

    if (deleted === 0) {
      return createErrorResponse(404, '$NAME analysis not found', 'NOT_FOUND');
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete $NAME error:', error);
    return createErrorResponse(500, 'Failed to delete $NAME analysis', 'DELETE_ERROR');
  }
}

/**
 * List user's $NAME analyses
 */
async function handleList${NAME}(
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
        framework_type: '$db_type',
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
    console.error('List $NAME error:', error);
    return createErrorResponse(500, 'Failed to list $NAME analyses', 'LIST_ERROR');
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
EOF
}

# Function to create basic types.ts
create_types_ts() {
    local framework=$1
    local NAME=$2

    cat > "$BASE_DIR/$framework/src/types.ts" << EOF
/**
 * $NAME Framework Type Definitions
 */

// Core data structure
export interface ${NAME}Data {
  objective: string;
  context: string;
  created_at: string;
  updated_at: string;
  // Add framework-specific fields here
}

// Request/Response types
export interface ${NAME}CreateRequest {
  title: string;
  objective: string;
  context?: string;
  tags?: string[];
}

export interface ${NAME}UpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

export interface ${NAME}AnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context: string;
  status: string;
  version: number;
  data: ${NAME}Data;
}

// Export types
export type ${NAME}ExportFormat = 'pdf' | 'docx' | 'json';
EOF
}

# Generate workers for all frameworks
for config in "${frameworks[@]}"; do
    IFS='|' read -r framework NAME db_type description <<< "$config"

    echo "Creating $framework ($NAME) worker files..."

    # Create types.ts
    create_types_ts "$framework" "$NAME"

    # Create index.ts
    create_index_ts "$framework" "$NAME" "$db_type" "$description"

    echo "Created $framework worker files"
done

echo "All framework worker files created successfully!"