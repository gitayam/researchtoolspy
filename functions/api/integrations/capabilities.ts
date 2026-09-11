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

interface Env extends IntegrationAuthEnv {
  COMMUNITY_INTEGRATIONS_ENABLED?: string
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
    runtimeReady.persistentWorkspace = Boolean(principal)

    const body = buildIntegrationCapabilitiesDocument({
      requestId,
      correlationId,
      principal,
      integrationsEnabled: env.COMMUNITY_INTEGRATIONS_ENABLED === 'true',
      serverSupport: TRANCHE_A_SERVER_SUPPORT,
      runtimeReady,
      limits: {},
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
