import { expect, test } from '@playwright/test'
import {
  INTEGRATION_CAPABILITY_NAMES,
  INTEGRATION_SCOPES,
  TRANCHE_A_SERVER_SUPPORT,
  buildIntegrationCapabilitiesDocument,
  parseIntegrationScopes,
  readIntegrationCorrelationId,
  type IntegrationCapabilities,
  type ServiceIntegrationPrincipal,
} from '../../../functions/api/_shared/integration-contract'
import { ARTIFACT_LIMITS, WORKSPACE_SNAPSHOT_MAX_BYTES } from '../../../functions/api/_shared/timeline-artifact-contract'

const durableLimits = { timelineRequestBytes: ARTIFACT_LIMITS.requestBytes, timelineSnapshotBytes: WORKSPACE_SNAPSHOT_MAX_BYTES, timelineChanges: ARTIFACT_LIMITS.changes, timelineObjects: ARTIFACT_LIMITS.objects, timelinePageSize: ARTIFACT_LIMITS.pageSize }

function allCapabilities(value: boolean): IntegrationCapabilities {
  return Object.fromEntries(INTEGRATION_CAPABILITY_NAMES.map(name => [name, value])) as unknown as IntegrationCapabilities
}

const PRINCIPAL: ServiceIntegrationPrincipal = {
  identityType: 'service',
  clientId: 'community_client_01',
  tokenId: 'token_identifier_00000001',
  principalUserId: 73,
  communityId: 'community-test',
  workspaceId: 'workspace-test',
  investigationId: 'investigation-test',
  environment: 'production',
  maximumVisibility: 'community',
  scopes: [...INTEGRATION_SCOPES],
}

test.describe('community integration contract @smoke', () => {
  test('@smoke accepts only exact, unique service scopes', () => {
    expect(parseIntegrationScopes(INTEGRATION_SCOPES)).toEqual([...INTEGRATION_SCOPES].sort())
    expect(parseIntegrationScopes(['community.*'])).toBeNull()
    expect(parseIntegrationScopes(['community.events.write', 'community.events.write'])).toBeNull()
    expect(parseIntegrationScopes(['COMMUNITY.EVENTS.WRITE'])).toBeNull()
    expect(parseIntegrationScopes(['timeline.read','timeline.write'])).toEqual(['timeline.read','timeline.write'])
    for (const scope of ['timeline.*','TIMELINE.READ','community.timelines.read','timeline.read ']) expect(parseIntegrationScopes([scope])).toBeNull()
  })

  test('@smoke advertises the shipped scoped timeline operation', () => {
    const runtimeReady = allCapabilities(true)
    const result = buildIntegrationCapabilitiesDocument({
      requestId: 'req-contract-0001',
      principal: PRINCIPAL,
      integrationsEnabled: true,
      serverSupport: TRANCHE_A_SERVER_SUPPORT,
      runtimeReady,
      limits: { claimMatchCandidates: 25, maxBatchUrls: 100 },
    })

    expect(result.identityType).toBe('service')
    expect(result.capabilities.anonymousAnalysis).toBe(true)
    expect(result.capabilities.publicBcw).toBe(true)
    for (const name of INTEGRATION_CAPABILITY_NAMES) {
      if (!['anonymousAnalysis','publicBcw','timelineAnalysis','timelineRead','timelineWrite'].includes(name)) {
        expect(result.capabilities[name], name).toBe(false)
      }
    }
    expect(result.capabilities.timelineAnalysis).toBe(true)
    expect(result.capabilities.timelineRead).toBe(true)
    expect(result.capabilities.timelineWrite).toBe(true)
    expect(result.contractVersions).toEqual({
      capabilities: 'integration-capabilities.v1',
      timelineAnalysis: 'timeline-analysis.v1',
      timelineArtifact: 'timeline-artifact.v1',
    })
    expect(result.limits).toEqual(durableLimits)
  })

  test('@smoke capability matrix intersects flag, runtime, exact scope, and hard limit', () => {
    const support = allCapabilities(true)
    const runtimeReady = allCapabilities(true)
    const enabled = buildIntegrationCapabilitiesDocument({
      requestId: 'req-contract-0002',
      principal: PRINCIPAL,
      integrationsEnabled: true,
      serverSupport: support,
      runtimeReady,
      limits: { claimMatchCandidates: 25, maxBatchUrls: 100 },
    })
    expect(Object.values(enabled.capabilities).every(Boolean)).toBe(true)
    expect(enabled.limits).toEqual({ claimMatchCandidates: 25, maxBatchUrls: 100, ...durableLimits })
    expect(enabled.contractVersions).toEqual({
      capabilities: 'integration-capabilities.v1',
      timelineAnalysis: 'timeline-analysis.v1',
      timelineArtifact: 'timeline-artifact.v1',
      sourceEvent: 'community-source-event.v1',
      artifact: 'source-artifact.v1',
      projection: 'community-enrichment.v1',
    })

    const noFlag = buildIntegrationCapabilitiesDocument({
      requestId: 'req-contract-0003',
      principal: PRINCIPAL,
      integrationsEnabled: false,
      serverSupport: support,
      runtimeReady,
      limits: { claimMatchCandidates: 25, maxBatchUrls: 100 },
    })
    expect(noFlag.capabilities.anonymousAnalysis).toBe(true)
    expect(noFlag.capabilities.publicBcw).toBe(true)
    expect(noFlag.capabilities.communityIngest).toBe(false)
    expect(noFlag.capabilities.persistentWorkspace).toBe(false)

    const withoutClaimScope = {
      ...PRINCIPAL,
      scopes: PRINCIPAL.scopes.filter(scope => scope !== 'community.claims.execute'),
    }
    const noClaimScope = buildIntegrationCapabilitiesDocument({
      requestId: 'req-contract-0004',
      principal: withoutClaimScope,
      integrationsEnabled: true,
      serverSupport: support,
      runtimeReady,
      limits: { claimMatchCandidates: 25, maxBatchUrls: 100 },
    })
    expect(noClaimScope.capabilities.claimMatch).toBe(false)
    expect(noClaimScope.capabilities.communityIngest).toBe(true)

    const noBudgets = buildIntegrationCapabilitiesDocument({
      requestId: 'req-contract-0005',
      principal: PRINCIPAL,
      integrationsEnabled: true,
      serverSupport: support,
      runtimeReady,
      limits: {},
    })
    expect(noBudgets.capabilities.claimMatch).toBe(false)
    expect(noBudgets.capabilities.communityIngest).toBe(false)
    expect(noBudgets.limits).toEqual(durableLimits)
  })

  test('@smoke durable scopes are independent and unavailable extensions are omitted', () => {
    const build = (scopes: ServiceIntegrationPrincipal['scopes'], overrides: Partial<Parameters<typeof buildIntegrationCapabilitiesDocument>[0]> = {}) => buildIntegrationCapabilitiesDocument({
      requestId:'req-durable-matrix', principal:{...PRINCIPAL,scopes}, integrationsEnabled:true,
      serverSupport:TRANCHE_A_SERVER_SUPPORT, runtimeReady:allCapabilities(true), ...overrides,
    })
    for (const [scopes,read,write] of [
      [[],false,false], [['community.artifacts.read','community.research.execute'],false,false],
      [['timeline.read'],true,false], [['timeline.write'],false,true], [['timeline.read','timeline.write'],true,true],
    ] as const) {
      const result=build([...scopes])
      if(read) expect(result.capabilities.timelineRead).toBe(true)
      else expect(result.capabilities).not.toHaveProperty('timelineRead')
      if(write) expect(result.capabilities.timelineWrite).toBe(true)
      else expect(result.capabilities).not.toHaveProperty('timelineWrite')
      expect(result.capabilities.persistentWorkspace).toBe(false)
      expect(result.capabilities.artifactRead).toBe(false)
      if(read||write) {
        expect(result.contractVersions.timelineArtifact).toBe('timeline-artifact.v1')
        expect(result.limits).toEqual(durableLimits)
      } else {
        expect(result.contractVersions).not.toHaveProperty('timelineArtifact')
        expect(result.limits).toEqual({})
      }
    }
    for(const overrides of [
      {principal:null}, {integrationsEnabled:false}, {runtimeReady:allCapabilities(false)},
      {serverSupport:{...TRANCHE_A_SERVER_SUPPORT,timelineRead:false,timelineWrite:false}},
    ]) {
      const result=build(['timeline.read','timeline.write'],overrides)
      expect(result.capabilities).not.toHaveProperty('timelineRead')
      expect(result.capabilities).not.toHaveProperty('timelineWrite')
      expect(result.contractVersions).not.toHaveProperty('timelineArtifact')
      expect(result.limits).toEqual({})
    }
    const readOnlyRuntime=build(['timeline.read','timeline.write'],{runtimeReady:{...allCapabilities(true),timelineWrite:false}})
    expect(readOnlyRuntime.capabilities.timelineRead).toBe(true)
    expect(readOnlyRuntime.capabilities).not.toHaveProperty('timelineWrite')
    const extraction=build(['community.research.execute'])
    expect(extraction.capabilities.timelineAnalysis).toBe(true)
    expect(extraction.contractVersions).toEqual({capabilities:'integration-capabilities.v1',timelineAnalysis:'timeline-analysis.v1'})
  })

  test('@smoke correlation identifiers are bounded opaque values', () => {
    const valid = new Request('https://researchtools.net/api/integrations/capabilities', {
      headers: { 'X-Correlation-ID': 'client-request-0001' },
    })
    const invalid = new Request('https://researchtools.net/api/integrations/capabilities', {
      headers: { 'X-Correlation-ID': 'contains user@example.com' },
    })
    expect(readIntegrationCorrelationId(valid)).toBe('client-request-0001')
    expect(readIntegrationCorrelationId(invalid)).toBeUndefined()
  })
})
