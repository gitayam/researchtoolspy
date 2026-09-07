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
  })

  test('@smoke Tranche A reports public readiness without advertising future service routes', () => {
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
      if (name !== 'anonymousAnalysis' && name !== 'publicBcw') {
        expect(result.capabilities[name], name).toBe(false)
      }
    }
    expect(result.contractVersions).toEqual({ capabilities: 'integration-capabilities.v1' })
    expect(result.limits).toEqual({})
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
    expect(enabled.limits).toEqual({ claimMatchCandidates: 25, maxBatchUrls: 100 })
    expect(enabled.contractVersions).toEqual({
      capabilities: 'integration-capabilities.v1',
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
    expect(noBudgets.limits).toEqual({})
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
