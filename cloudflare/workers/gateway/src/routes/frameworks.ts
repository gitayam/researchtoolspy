/**
 * Framework routes handler
 * Routes requests to appropriate framework Workers
 */

import { Env, AuthRequest } from '../../../shared/types';
import { createDatabase } from '../../../shared/database';
import { createErrorResponse } from '../middleware/errorHandler';

/**
 * Framework router - handles all /api/v1/frameworks/* routes
 */
export async function frameworkRouter(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Extract framework type from path
  const frameworkMatch = path.match(/^\/api\/v1\/frameworks\/([^\/]+)/);
  if (!frameworkMatch) {
    return handleListFrameworks(request, env);
  }

  const frameworkType = frameworkMatch[1];

  // Map framework types to their handlers
  switch (frameworkType) {
    case 'swot':
      return handleSWOTFramework(request, env, ctx);

    case 'ach':
      return handleACHFramework(request, env, ctx);

    case 'behavioral':
    case 'behavioral-analysis':
      return handleBehavioralFramework(request, env, ctx);

    case 'deception':
    case 'deception-detection':
      return handleDeceptionFramework(request, env, ctx);

    case 'dotmlpf':
      return handleDOTMLPFFramework(request, env, ctx);

    case 'pmesii-pt':
      return handlePMESIIPTFramework(request, env, ctx);

    case 'dime':
      return handleDIMEFramework(request, env, ctx);

    case 'pest':
      return handlePESTFramework(request, env, ctx);

    case 'vrio':
      return handleVRIOFramework(request, env, ctx);

    case 'stakeholder':
      return handleStakeholderFramework(request, env, ctx);

    case 'trend':
      return handleTrendFramework(request, env, ctx);

    case 'surveillance':
      return handleSurveillanceFramework(request, env, ctx);

    case 'causeway':
      return handleCausewayFramework(request, env, ctx);

    case 'cog':
      return handleCOGFramework(request, env, ctx);

    case 'starbursting':
      return handleStarburstingFramework(request, env, ctx);

    case 'fundamental-flow':
      return handleFundamentalFlowFramework(request, env, ctx);

    default:
      return createErrorResponse(404, `Framework '${frameworkType}' not found`, 'FRAMEWORK_NOT_FOUND');
  }
}

/**
 * List all available frameworks
 */
async function handleListFrameworks(
  request: AuthRequest,
  env: Env
): Promise<Response> {
  const frameworks = [
    {
      id: 'swot',
      name: 'SWOT Analysis',
      description: 'Analyze Strengths, Weaknesses, Opportunities, and Threats',
      category: 'strategic',
      ai_enabled: true,
    },
    {
      id: 'ach',
      name: 'Analysis of Competing Hypotheses',
      description: 'Systematic method for evaluating multiple hypotheses',
      category: 'intelligence',
      ai_enabled: true,
    },
    {
      id: 'behavioral',
      name: 'Behavioral Analysis (COM-B)',
      description: 'Analyze behavior using Capability, Opportunity, Motivation model',
      category: 'behavioral',
      ai_enabled: true,
    },
    {
      id: 'deception',
      name: 'Deception Detection',
      description: 'Identify and analyze potential deception in information',
      category: 'intelligence',
      ai_enabled: true,
    },
    {
      id: 'dotmlpf',
      name: 'DOTMLPF-P Assessment',
      description: 'Military capability assessment framework',
      category: 'military',
      ai_enabled: true,
    },
    {
      id: 'pmesii-pt',
      name: 'PMESII-PT Analysis',
      description: 'Environmental factor analysis for operations',
      category: 'military',
      ai_enabled: true,
    },
    {
      id: 'dime',
      name: 'DIME Analysis',
      description: 'Diplomatic, Information, Military, Economic power analysis',
      category: 'strategic',
      ai_enabled: true,
    },
    {
      id: 'pest',
      name: 'PEST Analysis',
      description: 'Political, Economic, Social, Technological factors',
      category: 'business',
      ai_enabled: true,
    },
    {
      id: 'vrio',
      name: 'VRIO Framework',
      description: 'Valuable, Rare, Inimitable, Organized resource analysis',
      category: 'business',
      ai_enabled: true,
    },
    {
      id: 'stakeholder',
      name: 'Stakeholder Analysis',
      description: 'Map and analyze stakeholder influence and interest',
      category: 'strategic',
      ai_enabled: true,
    },
    {
      id: 'trend',
      name: 'Trend Analysis',
      description: 'Identify and analyze patterns over time',
      category: 'analytical',
      ai_enabled: true,
    },
    {
      id: 'surveillance',
      name: 'Surveillance Analysis',
      description: 'Systematic monitoring and analysis framework',
      category: 'intelligence',
      ai_enabled: true,
    },
    {
      id: 'causeway',
      name: 'Causeway Analysis',
      description: 'Analyze causal relationships and pathways',
      category: 'analytical',
      ai_enabled: true,
    },
    {
      id: 'cog',
      name: 'Center of Gravity',
      description: 'Identify critical capabilities and vulnerabilities',
      category: 'military',
      ai_enabled: true,
    },
    {
      id: 'starbursting',
      name: 'Starbursting',
      description: 'Systematic questioning technique using 5W1H',
      category: 'analytical',
      ai_enabled: true,
    },
    {
      id: 'fundamental-flow',
      name: 'Fundamental Flow',
      description: 'Analyze fundamental processes and workflows',
      category: 'analytical',
      ai_enabled: false,
    },
  ];

  // If user is authenticated, include their usage stats
  if (request.user) {
    const db = createDatabase(env);
    const userSessions = await db.execute(
      `SELECT framework_type, COUNT(*) as count
       FROM framework_sessions
       WHERE user_id = ?
       GROUP BY framework_type`,
      [request.user.id]
    );

    const usageMap = new Map(
      userSessions.results.map((row: any) => [row.framework_type, row.count])
    );

    frameworks.forEach(framework => {
      (framework as any).user_sessions_count = usageMap.get(framework.id) || 0;
    });
  }

  return new Response(JSON.stringify(frameworks), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handle SWOT framework requests
 */
async function handleSWOTFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Import and use the SWOT worker
  const { handleSWOTRequest } = await import('../../../frameworks/swot/src/index');
  return handleSWOTRequest(request, env, ctx);
}

/**
 * Placeholder handlers for other frameworks
 * These will be implemented as we migrate each framework
 */

async function handleACHFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Import and use the ACH worker
  const { handleACHRequest } = await import('../../../frameworks/ach/src/index');
  return handleACHRequest(request, env, ctx);
}

async function handleBehavioralFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'Behavioral Analysis framework not yet implemented', 'NOT_IMPLEMENTED');
}

async function handleDeceptionFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'Deception Detection framework not yet implemented', 'NOT_IMPLEMENTED');
}

async function handleDOTMLPFFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'DOTMLPF framework not yet implemented', 'NOT_IMPLEMENTED');
}

async function handlePMESIIPTFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'PMESII-PT framework not yet implemented', 'NOT_IMPLEMENTED');
}

async function handleDIMEFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'DIME framework not yet implemented', 'NOT_IMPLEMENTED');
}

async function handlePESTFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'PEST framework not yet implemented', 'NOT_IMPLEMENTED');
}

async function handleVRIOFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'VRIO framework not yet implemented', 'NOT_IMPLEMENTED');
}

async function handleStakeholderFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'Stakeholder Analysis framework not yet implemented', 'NOT_IMPLEMENTED');
}

async function handleTrendFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'Trend Analysis framework not yet implemented', 'NOT_IMPLEMENTED');
}

async function handleSurveillanceFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'Surveillance Analysis framework not yet implemented', 'NOT_IMPLEMENTED');
}

async function handleCausewayFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'Causeway Analysis framework not yet implemented', 'NOT_IMPLEMENTED');
}

async function handleCOGFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'Center of Gravity framework not yet implemented', 'NOT_IMPLEMENTED');
}

async function handleStarburstingFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'Starbursting framework not yet implemented', 'NOT_IMPLEMENTED');
}

async function handleFundamentalFlowFramework(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'Fundamental Flow framework not yet implemented', 'NOT_IMPLEMENTED');
}

/**
 * Get user's framework sessions
 */
export async function getUserFrameworkSessions(
  userId: number,
  env: Env,
  options?: {
    framework_type?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<any> {
  const db = createDatabase(env);

  const where: Record<string, any> = { user_id: userId };
  if (options?.framework_type) {
    where.framework_type = options.framework_type;
  }
  if (options?.status) {
    where.status = options.status;
  }

  return db.paginate(
    'framework_sessions',
    options?.page || 1,
    options?.pageSize || 20,
    {
      where,
      orderBy: {
        column: 'updated_at',
        direction: 'desc',
      },
    }
  );
}