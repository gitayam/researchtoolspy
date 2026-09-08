export const INTEGRATION_CAPABILITIES_SCHEMA_VERSION = 'integration-capabilities.v1' as const
export const INTEGRATION_ERROR_SCHEMA_VERSION = 'integration-error.v1' as const

export const INTEGRATION_SCOPES = [
  'community.events.write',
  'community.jobs.read',
  'community.artifacts.read',
  'community.projections.read',
  'community.claims.execute',
  'community.research.execute',
  'community.cop.write',
  'community.behavior.write',
  'community.feeds.manage',
  'community.webhooks.manage',
] as const

export type IntegrationScope = typeof INTEGRATION_SCOPES[number]
export type IntegrationVisibility = 'private' | 'community' | 'public'

const INTEGRATION_SCOPE_SET = new Set<string>(INTEGRATION_SCOPES)

export function isIntegrationScope(value: unknown): value is IntegrationScope {
  return typeof value === 'string' && INTEGRATION_SCOPE_SET.has(value)
}

export function parseIntegrationScopes(values: readonly unknown[]): IntegrationScope[] | null {
  const scopes: IntegrationScope[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (!isIntegrationScope(value) || seen.has(value)) return null
    seen.add(value)
    scopes.push(value)
  }
  return scopes.sort()
}

export interface ServiceIntegrationPrincipal {
  identityType: 'service'
  clientId: string
  tokenId: string
  principalUserId: number
  communityId: string
  workspaceId: string
  investigationId: string
  environment: 'development' | 'staging' | 'production'
  maximumVisibility: IntegrationVisibility
  scopes: IntegrationScope[]
}

export const INTEGRATION_CAPABILITY_NAMES = [
  'anonymousAnalysis',
  'publicBcw',
  'timelineAnalysis',
  'communityIngest',
  'jobStatus',
  'artifactRead',
  'projectionRead',
  'persistentWorkspace',
  'researchQuestions',
  'cop',
  'behaviorIntake',
  'claimMatch',
  'feedJobs',
  'webhookManagement',
] as const

export type IntegrationCapabilityName = typeof INTEGRATION_CAPABILITY_NAMES[number]
export type IntegrationCapabilities = Record<IntegrationCapabilityName, boolean>
export type AdvertisedIntegrationCapabilities =
  Omit<IntegrationCapabilities, 'timelineAnalysis'>
  & Partial<Pick<IntegrationCapabilities, 'timelineAnalysis'>>

const REQUIRED_SCOPE: Partial<Record<IntegrationCapabilityName, IntegrationScope>> = {
  timelineAnalysis: 'community.research.execute',
  communityIngest: 'community.events.write',
  jobStatus: 'community.jobs.read',
  artifactRead: 'community.artifacts.read',
  projectionRead: 'community.projections.read',
  claimMatch: 'community.claims.execute',
  researchQuestions: 'community.research.execute',
  cop: 'community.cop.write',
  behaviorIntake: 'community.behavior.write',
  feedJobs: 'community.feeds.manage',
  webhookManagement: 'community.webhooks.manage',
}

/** Timeline analysis is the first scoped service-compute operation. */
export const TRANCHE_A_SERVER_SUPPORT: Readonly<IntegrationCapabilities> = Object.freeze({
  anonymousAnalysis: true,
  publicBcw: true,
  timelineAnalysis: true,
  communityIngest: false,
  jobStatus: false,
  artifactRead: false,
  projectionRead: false,
  persistentWorkspace: false,
  researchQuestions: false,
  cop: false,
  behaviorIntake: false,
  claimMatch: false,
  feedJobs: false,
  webhookManagement: false,
})

export interface IntegrationCapabilityLimits {
  claimMatchCandidates?: number
  maxBatchUrls?: number
}

export interface IntegrationCapabilitiesDocument {
  schemaVersion: typeof INTEGRATION_CAPABILITIES_SCHEMA_VERSION
  requestId: string
  correlationId?: string
  identityType: 'anonymous' | 'service'
  clientId?: string
  communityId?: string
  workspaceId?: string
  investigationId?: string
  environment?: ServiceIntegrationPrincipal['environment']
  maximumVisibility?: IntegrationVisibility
  contractVersions: {
    capabilities: typeof INTEGRATION_CAPABILITIES_SCHEMA_VERSION
    timelineAnalysis?: 'timeline-analysis.v1'
    sourceEvent?: 'community-source-event.v1'
    artifact?: 'source-artifact.v1'
    projection?: 'community-enrichment.v1'
  }
  scopes: IntegrationScope[]
  /** Additive v1 extensions are omitted while unavailable for old strict clients. */
  capabilities: AdvertisedIntegrationCapabilities
  limits: IntegrationCapabilityLimits
}

export interface BuildIntegrationCapabilitiesOptions {
  requestId: string
  correlationId?: string
  principal: ServiceIntegrationPrincipal | null
  integrationsEnabled: boolean
  serverSupport: Readonly<IntegrationCapabilities>
  runtimeReady: Readonly<IntegrationCapabilities>
  limits?: IntegrationCapabilityLimits
}

function positiveInteger(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

export function buildIntegrationCapabilitiesDocument(
  options: BuildIntegrationCapabilitiesOptions,
): IntegrationCapabilitiesDocument {
  const { principal, serverSupport, runtimeReady } = options
  const serviceReady = Boolean(principal && options.integrationsEnabled)
  const scopeSet = new Set(principal?.scopes ?? [])
  const available = (name: IntegrationCapabilityName): boolean => (
    serverSupport[name] && runtimeReady[name]
  )
  const scoped = (name: IntegrationCapabilityName): boolean => {
    const required = REQUIRED_SCOPE[name]
    return serviceReady && available(name) && Boolean(required && scopeSet.has(required))
  }

  const claimLimit = positiveInteger(options.limits?.claimMatchCandidates)
  const batchLimit = positiveInteger(options.limits?.maxBatchUrls)
  const capabilities: IntegrationCapabilities = {
    anonymousAnalysis: available('anonymousAnalysis'),
    publicBcw: available('publicBcw'),
    timelineAnalysis: scoped('timelineAnalysis'),
    communityIngest: scoped('communityIngest') && batchLimit !== null,
    jobStatus: scoped('jobStatus'),
    artifactRead: scoped('artifactRead'),
    projectionRead: scoped('projectionRead'),
    persistentWorkspace: serviceReady && available('persistentWorkspace'),
    researchQuestions: scoped('researchQuestions'),
    cop: scoped('cop'),
    behaviorIntake: scoped('behaviorIntake'),
    claimMatch: scoped('claimMatch') && claimLimit !== null,
    feedJobs: scoped('feedJobs'),
    webhookManagement: scoped('webhookManagement'),
  }

  const document: IntegrationCapabilitiesDocument = {
    schemaVersion: INTEGRATION_CAPABILITIES_SCHEMA_VERSION,
    requestId: options.requestId,
    ...(options.correlationId ? { correlationId: options.correlationId } : {}),
    identityType: principal ? 'service' : 'anonymous',
    ...(principal ? {
      clientId: principal.clientId,
      communityId: principal.communityId,
      workspaceId: principal.workspaceId,
      investigationId: principal.investigationId,
      environment: principal.environment,
      maximumVisibility: principal.maximumVisibility,
    } : {}),
    contractVersions: {
      capabilities: INTEGRATION_CAPABILITIES_SCHEMA_VERSION,
      ...(capabilities.timelineAnalysis ? { timelineAnalysis: 'timeline-analysis.v1' as const } : {}),
      ...(capabilities.communityIngest ? { sourceEvent: 'community-source-event.v1' as const } : {}),
      ...(capabilities.artifactRead ? { artifact: 'source-artifact.v1' as const } : {}),
      ...(capabilities.projectionRead ? { projection: 'community-enrichment.v1' as const } : {}),
    },
    scopes: principal ? [...principal.scopes] : [],
    capabilities: capabilities.timelineAnalysis
      ? capabilities
      : Object.fromEntries(
          Object.entries(capabilities).filter(([name]) => name !== 'timelineAnalysis'),
        ) as AdvertisedIntegrationCapabilities,
    limits: {
      ...(capabilities.claimMatch && claimLimit !== null ? { claimMatchCandidates: claimLimit } : {}),
      ...(capabilities.communityIngest && batchLimit !== null ? { maxBatchUrls: batchLimit } : {}),
    },
  }
  return document
}

export type IntegrationErrorCode =
  | 'invalid_request'
  | 'authentication_required'
  | 'invalid_service_token'
  | 'expired_service_token'
  | 'scope_denied'
  | 'workspace_denied'
  | 'content_unavailable'
  | 'upstream_invalid_response'
  | 'method_not_allowed'
  | 'internal_error'
  | 'auth_datastore_unavailable'

export interface IntegrationErrorDocument {
  schemaVersion: typeof INTEGRATION_ERROR_SCHEMA_VERSION
  requestId: string
  correlationId?: string
  error: {
    code: IntegrationErrorCode
    message: string
    retryable: boolean
  }
}

export function buildIntegrationErrorDocument(options: {
  requestId: string
  correlationId?: string
  code: IntegrationErrorCode
  message: string
  retryable: boolean
}): IntegrationErrorDocument {
  return {
    schemaVersion: INTEGRATION_ERROR_SCHEMA_VERSION,
    requestId: options.requestId,
    ...(options.correlationId ? { correlationId: options.correlationId } : {}),
    error: {
      code: options.code,
      message: options.message,
      retryable: options.retryable,
    },
  }
}

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/

export function readIntegrationCorrelationId(request: Request): string | undefined {
  const value = request.headers.get('X-Correlation-ID')
  return value && CORRELATION_ID_PATTERN.test(value) ? value : undefined
}
