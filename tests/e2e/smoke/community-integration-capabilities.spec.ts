import { expect, test } from '@playwright/test'
import type { D1Database } from '@cloudflare/workers-types'
import { onRequest as applyApiMiddleware } from '../../../functions/api/_middleware'
import { onRequest } from '../../../functions/api/integrations/capabilities'
import { deriveIntegrationTokenHash } from '../../../functions/api/_shared/service-auth'

const CLIENT_ID = 'community_client_01'
const SECRET = 'A'.repeat(43)
const HASH_KEY = 'integration-test-key-material-0000000000000000'

interface CapabilityBody {
  schemaVersion: string
  requestId: string
  correlationId?: string
  identityType: string
  clientId?: string
  communityId?: string
  workspaceId?: string
  investigationId?: string
  scopes: string[]
  contractVersions: Record<string, string>
  capabilities: Record<string, boolean>
  limits: Record<string, number>
}

interface ErrorBody {
  schemaVersion: string
  error: { code: string; message: string; retryable: boolean }
}

async function serviceDb(includeTimelineScope = false, durableScopes: string[] = []): Promise<D1Database> {
  const secretHash = await deriveIntegrationTokenHash(HASH_KEY, CLIENT_ID, SECRET)
  const base = {
    client_id: CLIENT_ID,
    community_id: 'community-test',
    workspace_id: 'workspace-test',
    intake_investigation_id: 'investigation-test',
    principal_user_id: 73,
    client_environment: 'production',
    audience: 'researchtools-community-api.v1',
    maximum_visibility: 'community',
    client_status: 'active',
    token_id: 'token_identifier_00000001',
    token_slot: 'current',
    secret_hash: secretHash,
    hash_version: 'hmac-sha256.v1',
    token_created_at: 1,
    not_before: 1,
    expires_at: 4_000_000_000,
    revoked_at: null,
    principal_row_id: 73,
    principal_role: 'service',
    principal_active: 1,
    principal_username: `service_${CLIENT_ID}`,
    principal_user_hash: null,
    principal_account_hash: null,
    principal_email: `service+${CLIENT_ID}@service.invalid`,
    principal_oidc_sub: null,
    principal_oidc_provider: null,
    principal_oidc_email: null,
    principal_password: 'SERVICE_AUTH_DISABLED',
    bound_workspace_id: 'workspace-test',
    workspace_owner_id: 73,
    workspace_type: 'TEAM',
    workspace_is_public: 0,
    bound_investigation_id: 'investigation-test',
    investigation_workspace_id: 'workspace-test',
    investigation_created_by: 73,
    investigation_status: 'active',
    principal_memberships: 0,
  }
  const results = [
    { ...base, token_scope: 'community.events.write' },
    { ...base, token_scope: 'community.projections.read' },
    ...(includeTimelineScope ? [{ ...base, token_scope: 'community.research.execute' }] : []),
    ...durableScopes.map(token_scope=>({...base,token_scope})),
  ]
  return {
    prepare: (sql: string) => ({
      bind: () => ({
        all: async () => ({ success: true, results }),
        run: async () => ({ success: true }),
      }),
      all: async () => ({ success: true, results: sql.includes('SELECT') ? results : [] }),
      run: async () => ({ success: true }),
    }),
  } as unknown as D1Database
}

function context(request: Request, env: Record<string, unknown>) {
  return { request, env } as unknown as Parameters<typeof onRequest>[0]
}

test.describe('community integration capabilities endpoint @smoke', () => {
  test('@smoke anonymous discovery reports only locally ready public capabilities', async () => {
    const response = await onRequest(context(
      new Request('https://researchtools.net/api/integrations/capabilities'),
      { DB: {} as D1Database, OPENAI_API_KEY: 'configured-for-readiness-only' },
    ))
    const body = await response.json() as CapabilityBody

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(body.identityType).toBe('anonymous')
    expect(body.scopes).toEqual([])
    expect(body.capabilities.anonymousAnalysis).toBe(true)
    expect(body.capabilities.publicBcw).toBe(true)
    expect(body.capabilities.communityIngest).toBe(false)
    expect(body.capabilities).not.toHaveProperty('timelineAnalysis')
    expect(body.capabilities).not.toHaveProperty('timelineRead')
    expect(body.capabilities).not.toHaveProperty('timelineWrite')
    expect(body.contractVersions).not.toHaveProperty('timelineArtifact')
    expect(body.limits).toEqual({})
    expect(body).not.toHaveProperty('workspaceId')
  })

  test('@smoke valid service identity returns its binding but advertises no unshipped service operation', async () => {
    const db = await serviceDb()
    const response = await onRequest(context(
      new Request('https://researchtools.net/api/integrations/capabilities', {
        headers: {
          Authorization: `Bearer rt_svc_${CLIENT_ID}.${SECRET}`,
          'X-Correlation-ID': 'client-request-0001',
        },
      }),
      {
        DB: db,
        ENVIRONMENT: 'production',
        INTEGRATION_TOKEN_HASH_KEY: HASH_KEY,
        COMMUNITY_INTEGRATIONS_ENABLED: 'true',
        OPENAI_API_KEY: 'configured-for-readiness-only',
      },
    ))
    const body = await response.json() as CapabilityBody

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      schemaVersion: 'integration-capabilities.v1',
      correlationId: 'client-request-0001',
      identityType: 'service',
      clientId: CLIENT_ID,
      communityId: 'community-test',
      workspaceId: 'workspace-test',
      investigationId: 'investigation-test',
      scopes: ['community.events.write', 'community.projections.read'],
      contractVersions: { capabilities: 'integration-capabilities.v1' },
      limits: {},
    })
    expect(body.requestId).toMatch(/^req-/)
    expect(body.capabilities.communityIngest).toBe(false)
    expect(body.capabilities.projectionRead).toBe(false)
    expect(body.capabilities).not.toHaveProperty('timelineAnalysis')
  })

  test('@smoke advertises timeline analysis only to a ready scoped service', async () => {
    const response = await onRequest(context(
      new Request('https://researchtools.net/api/integrations/capabilities', {
        headers: { Authorization: `Bearer rt_svc_${CLIENT_ID}.${SECRET}` },
      }),
      {
        DB: await serviceDb(true),
        ENVIRONMENT: 'production',
        INTEGRATION_TOKEN_HASH_KEY: HASH_KEY,
        COMMUNITY_INTEGRATIONS_ENABLED: 'true',
        OPENAI_API_KEY: 'configured-for-readiness-only',
      },
    ))
    const body = await response.json() as CapabilityBody

    expect(response.status).toBe(200)
    expect(body.scopes).toContain('community.research.execute')
    expect(body.capabilities.timelineAnalysis).toBe(true)
    expect(body.contractVersions.timelineAnalysis).toBe('timeline-analysis.v1')
  })

  test('@smoke durable discovery separates read/write and requires no model key', async () => {
    for(const scopes of [[],['timeline.read'],['timeline.write'],['timeline.read','timeline.write']]) {
      for(const enabled of [true,false]) {
        const response=await onRequest(context(new Request('https://researchtools.net/api/integrations/capabilities',{headers:{Authorization:`Bearer rt_svc_${CLIENT_ID}.${SECRET}`}}),{
          DB:await serviceDb(true,scopes),ENVIRONMENT:'production',INTEGRATION_TOKEN_HASH_KEY:HASH_KEY,
          COMMUNITY_INTEGRATIONS_ENABLED:String(enabled),
        }))
        expect(response.status).toBe(200)
        const body=await response.json() as CapabilityBody
        for(const [scope,capability] of [['timeline.read','timelineRead'],['timeline.write','timelineWrite']]) {
          if(enabled&&scopes.includes(scope)) expect(body.capabilities[capability]).toBe(true)
          else expect(body.capabilities).not.toHaveProperty(capability)
        }
        // Even a research scope cannot advertise extraction without its model runtime.
        expect(body.capabilities).not.toHaveProperty('timelineAnalysis')
        expect(body.contractVersions).not.toHaveProperty('timelineAnalysis')
        expect(body.capabilities.persistentWorkspace).toBe(false)
        expect(body.capabilities.artifactRead).toBe(false)
        if(enabled&&scopes.length) {
          expect(body.contractVersions.timelineArtifact).toBe('timeline-artifact.v1')
          expect(body.limits).toEqual({timelineRequestBytes:65536,timelineSnapshotBytes:61440,timelineChanges:10,timelineObjects:1000,timelinePageSize:100})
        } else {
          expect(body.contractVersions).not.toHaveProperty('timelineArtifact')
          expect(body.limits).toEqual({})
        }
      }
    }
    const anonymous=await onRequest(context(new Request('https://researchtools.net/api/integrations/capabilities'),{COMMUNITY_INTEGRATIONS_ENABLED:'true'}))
    const anonymousBody=await anonymous.json() as CapabilityBody
    expect(anonymousBody.capabilities).not.toHaveProperty('timelineRead')
    expect(anonymousBody.capabilities).not.toHaveProperty('timelineWrite')
    expect(anonymousBody.limits).toEqual({})
  })

  test('@smoke invalid supplied credentials return the bounded error contract without secrets', async () => {
    const response = await onRequest(context(
      new Request('https://researchtools.net/api/integrations/capabilities', {
        headers: { Authorization: `Bearer rt_svc_${CLIENT_ID}.${'Z'.repeat(43)}` },
      }),
      {
        DB: await serviceDb(),
        ENVIRONMENT: 'production',
        INTEGRATION_TOKEN_HASH_KEY: HASH_KEY,
      },
    ))
    const rawBody = await response.text()
    const body = JSON.parse(rawBody)
    expect(response.status).toBe(401)
    expect(body.schemaVersion).toBe('integration-error.v1')
    expect(body.error).toEqual({
      code: 'invalid_service_token',
      message: 'The service credential is invalid or inactive.',
      retryable: false,
    })
    expect(rawBody).not.toContain('Z'.repeat(43))
    expect(rawBody).not.toContain('workspace-test')
  })

  test('@smoke unsupported methods and query parameters use bounded errors', async () => {
    const methodResponse = await onRequest(context(
      new Request('https://researchtools.net/api/integrations/capabilities', { method: 'POST' }),
      {},
    ))
    expect(methodResponse.status).toBe(405)
    expect(methodResponse.headers.get('Allow')).toBe('GET, OPTIONS')
    expect((await methodResponse.json() as ErrorBody).error.code).toBe('method_not_allowed')

    const queryResponse = await onRequest(context(
      new Request('https://researchtools.net/api/integrations/capabilities?probe=true'),
      {},
    ))
    expect(queryResponse.status).toBe(400)
    expect((await queryResponse.json() as ErrorBody).error.code).toBe('invalid_request')
  })

  test('@smoke API middleware preserves auth cache variance and allows correlation preflight', async () => {
    const request = new Request('https://researchtools.net/api/integrations/capabilities', {
      headers: { Origin: 'https://researchtools.net' },
    })
    const response = await applyApiMiddleware({
      request,
      env: {},
      next: async () => new Response('{}', { headers: { Vary: 'Authorization' } }),
    })
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('X-Correlation-ID')
    expect(response.headers.get('Vary')?.split(',').map(value => value.trim()))
      .toEqual(expect.arrayContaining(['Authorization', 'Origin']))
  })
})
