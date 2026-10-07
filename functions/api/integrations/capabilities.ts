import {
  INTEGRATION_CAPABILITY_NAMES,
  TRANCHE_A_SERVER_SUPPORT,
  buildIntegrationCapabilitiesDocument,
  buildIntegrationErrorDocument,
  readIntegrationCorrelationId,
  type IntegrationCapabilities,
  type IntegrationErrorCode,
} from '../_shared/integration-contract'
import {
  IntegrationAuthError,
  getIntegrationPrincipalFromRequest,
  type IntegrationAuthEnv,
} from '../_shared/service-auth'
import { REMARKS_LIMITS } from '../_shared/remarks-contract'

interface Env extends IntegrationAuthEnv {
  COMMUNITY_INTEGRATIONS_ENABLED?: string
  RESEARCH_QUESTIONS_SERVICE_ENABLED?: string
  REMARKS_SERVICE_ENABLED?: string
  OPENAI_API_KEY?: string
}

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': 'https://researchtools.net',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Correlation-ID, X-Workspace-ID',
  'Vary': 'Authorization, Origin',
} as const

function allCapabilities(value: boolean): IntegrationCapabilities {
  return Object.fromEntries(
    INTEGRATION_CAPABILITY_NAMES.map(name => [name, value]),
  ) as unknown as IntegrationCapabilities
}

function errorResponse(options: {
  requestId: string
  correlationId?: string
  code: IntegrationErrorCode
  message: string
  retryable: boolean
  status: number
  allow?: string
}): Response {
  return new Response(JSON.stringify(buildIntegrationErrorDocument(options)), {
    status: options.status,
    headers: {
      ...RESPONSE_HEADERS,
      ...(options.allow ? { Allow: options.allow } : {}),
      ...(options.status === 503 ? { 'Retry-After': '2' } : {}),
    },
  })
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: RESPONSE_HEADERS })
  }

  const requestId = `req-${crypto.randomUUID()}`
  const correlationId = readIntegrationCorrelationId(request)

  if (request.method !== 'GET') {
    return errorResponse({
      requestId,
      correlationId,
      code: 'method_not_allowed',
      message: 'This endpoint supports GET only.',
      retryable: false,
      status: 405,
      allow: 'GET, OPTIONS',
    })
  }

  if (new URL(request.url).search !== '') {
    return errorResponse({
      requestId,
      correlationId,
      code: 'invalid_request',
      message: 'Capability discovery does not accept query parameters.',
      retryable: false,
      status: 400,
    })
  }

  try {
    const principal = await getIntegrationPrincipalFromRequest(request, env)
    const runtimeReady = allCapabilities(false)
    runtimeReady.publicBcw = true
    runtimeReady.anonymousAnalysis = Boolean(env.DB && env.OPENAI_API_KEY)
    runtimeReady.timelineAnalysis = Boolean(env.DB && env.OPENAI_API_KEY)
    runtimeReady.timelineRead = Boolean(env.DB)
    runtimeReady.timelineWrite = Boolean(env.DB)
    runtimeReady.timelineHandoffMint = Boolean(env.DB)
    // Off unless the operator sets the exact flag; the route enforces the same check.
    runtimeReady.researchQuestions = Boolean(env.OPENAI_API_KEY)
      && env.RESEARCH_QUESTIONS_SERVICE_ENABLED === 'true'
    runtimeReady.persistentWorkspace = Boolean(principal)
    // Same shape as research questions: the route enforces the identical gate.
    // budget/check modes need no model, but the capability is advertised as a
    // whole, so the key is required for the flag to show.
    runtimeReady.remarksPlanning = Boolean(env.OPENAI_API_KEY)
      && env.REMARKS_SERVICE_ENABLED === 'true'

    const body = buildIntegrationCapabilitiesDocument({
      requestId,
      correlationId,
      principal,
      integrationsEnabled: env.COMMUNITY_INTEGRATIONS_ENABLED === 'true',
      serverSupport: TRANCHE_A_SERVER_SUPPORT,
      runtimeReady,
      limits: {
        remarksRequestBytes: REMARKS_LIMITS.requestBytes,
        remarksScriptChars: REMARKS_LIMITS.scriptChars,
        remarksBranchItems: REMARKS_LIMITS.branchItems,
        remarksVoiceChars: REMARKS_LIMITS.voiceChars,
      },
    })
    return new Response(JSON.stringify(body), { status: 200, headers: RESPONSE_HEADERS })
  } catch (error) {
    if (error instanceof IntegrationAuthError) {
      return errorResponse({
        requestId,
        correlationId,
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        status: error.status,
      })
    }
    return errorResponse({
      requestId,
      correlationId,
      code: 'internal_error',
      message: 'Capability discovery failed.',
      retryable: true,
      status: 500,
    })
  }
}
