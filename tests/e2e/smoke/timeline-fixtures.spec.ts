import { test, expect } from '@playwright/test'
import Ajv from 'ajv'
import { readFileSync } from 'node:fs'
import { normalizeTimelineModelPayload, TIMELINE_EVENT_CATEGORIES, TIMELINE_EVENT_IMPORTANCE } from '../../../functions/api/_shared/timeline-contract'
import { buildIntegrationCapabilitiesDocument, buildIntegrationErrorDocument, TRANCHE_A_SERVER_SUPPORT } from '../../../functions/api/_shared/integration-contract'
import { onRequestPost } from '../../../functions/api/tools/extract-timeline'
import { createTimelineClient, isTimelineResult, isIntegrationError } from '../../../examples/timeline-client/client'

const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const corpus = readJson('../../../benchmarks/timeline/corpus-v1/fixtures.json')
const manifest = readJson('../../../benchmarks/timeline/corpus-v1/manifest.json')
const schema = readJson('../../../docs/api/schemas/timeline-analysis.v1.schema.json')
const errorSchema = readJson('../../../docs/api/schemas/integration-error.v1.schema.json')
const openapi = readJson('../../../docs/api/openapi/timeline-analysis.v1.json')
const ajv = new Ajv({ allErrors: true })
ajv.addSchema(schema)
const validateSuccess = ajv.getSchema(schema.$id)!
const validateRequest = ajv.compile({ $ref: `${schema.$id}#/definitions/request` })
const validateError = ajv.compile(errorSchema)

test.describe('timeline frozen synthetic corpus and published schemas @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('manifest is versioned, traceable and honest about unsupported quality evidence', () => {
    expect(manifest.schemaVersion).toBe('timeline-fixture-manifest.v1')
    expect(corpus.schemaVersion).toBe('timeline-regression-fixtures.v1')
    expect(manifest.fixtures.map((fixture: { id: string }) => fixture.id)).toEqual(corpus.fixtures.map((fixture: { id: string }) => fixture.id))
    expect(manifest.pendingCapabilities).toContain('analyst-reviewed historical gold')
    for (const fixture of manifest.fixtures) {
      expect(fixture.reviewStatus).toBe('synthetic-unreviewed')
      expect(fixture.retrievedAt).toBeNull()
      expect(fixture.publisherTimezone).toBeNull()
      expect(Number.isFinite(Date.parse(fixture.asOf))).toBe(true)
      expect(fixture.dataThrough).toBe(manifest.dataThrough)
      expect(fixture.usageConstraints).toBeTruthy()
      const source = corpus.fixtures.find((item: { id: string }) => item.id === fixture.id)
      expect(source.request.url).toBe(fixture.sourceUrl)
      for (const assertion of source.requiredAssertions) expect(source.request.content.text).toContain(assertion.evidenceQuote)
    }
  })

  test('Ajv validates request/response/errors and rejects missing fields and incompatible values', () => {
    for (const fixture of corpus.fixtures) expect(validateRequest(fixture.request), JSON.stringify(validateRequest.errors)).toBe(true)
    expect(validateSuccess(corpus.successResponse), JSON.stringify(validateSuccess.errors)).toBe(true)
    expect(isTimelineResult(corpus.successResponse)).toBe(true)
    for (const item of corpus.serviceErrors) {
      const error = buildIntegrationErrorDocument({ requestId: 'req-fixture-error', correlationId: 'correlation-fixture-01', code: item.code, message: 'Synthetic failure', retryable: item.retryable })
      expect(validateError(error), JSON.stringify(validateError.errors)).toBe(true)
      expect(isIntegrationError(error)).toBe(true)
      expect(validateError({ ...error, error: { ...error.error, code: 'invented_code' } })).toBe(false)
    }
    for (const key of schema.definitions.response.required) {
      const missing = { ...corpus.successResponse }
      delete missing[key]
      expect(validateSuccess(missing), `required response field ${key}`).toBe(false)
    }
    for (const request of [{ url: 'https://publisher.example' }, { ...corpus.fixtures[0].request, schemaVersion: 'timeline-analysis.v2' }, { ...corpus.fixtures[0].request, extra: true }, { ...corpus.fixtures[0].request, content: { text: 'article', source: 'unknown' } }]) expect(validateRequest(request)).toBe(false)
    const event = corpus.successResponse.events[0]
    for (const response of [
      { ...corpus.successResponse, events: [] },
      { ...corpus.successResponse, outcome: 'no_events' },
      { ...corpus.successResponse, events: [{ ...event, datePrecision: 'day' }] },
      { ...corpus.successResponse, events: [{ ...event, category: 'unknown' }] },
      { ...corpus.successResponse, events: Array.from({ length: 101 }, () => event) },
      { ...corpus.successResponse, extraction: { ...corpus.successResponse.extraction, quality: { ...corpus.successResponse.extraction.quality, accepted: false } } },
    ]) expect(validateSuccess(response)).toBe(false)
    expect(validateSuccess({ ...corpus.successResponse, futureAdditiveField: 1 })).toBe(true)
    // Calendar semantics and UTF-8/UTF-16 budgets are explicitly additional runtime checks.
    const falsePrecision = { ...corpus.successResponse, events: [{ ...event, eventDate: '2026-02-29', datePrecision: 'day' }] }
    expect(isTimelineResult(falsePrecision)).toBe(false)
    expect(schema.definitions.request['x-maxUtf8Bytes']).toBe(112 * 1024)
    expect(schema.definitions.request.properties.content.properties.text['x-maxUtf8Bytes']).toBe(100 * 1024)
    expect(schema.definitions.event.properties.category.enum).toEqual([...TIMELINE_EVENT_CATEGORIES])
    expect(schema.definitions.event.properties.importance.enum).toEqual([...TIMELINE_EVENT_IMPORTANCE])
    expect(openapi.paths['/api/tools/extract-timeline'].post.requestBody.content['application/json'].schema.$ref).toBe('../schemas/timeline-analysis.v1.schema.json#/definitions/request')
    expect(openapi.paths['/api/tools/extract-timeline'].post.responses['429']).toBeDefined()
  })

  test('published discovery schema and generic client accept the real capability builder', async () => {
    const document = buildIntegrationCapabilitiesDocument({
      requestId: 'req-capability-fixture', integrationsEnabled: true,
      serverSupport: TRANCHE_A_SERVER_SUPPORT, runtimeReady: TRANCHE_A_SERVER_SUPPORT,
      principal: { identityType: 'service', clientId: 'fixture-client-01', tokenId: 'token-fixture', principalUserId: 7, communityId: 'community-fixture', workspaceId: 'workspace-fixture', investigationId: 'investigation-fixture', environment: 'development', maximumVisibility: 'private', scopes: ['community.research.execute'] },
    })
    const validate = ajv.compile(openapi.components.schemas.Capabilities)
    expect(validate(document), JSON.stringify(validate.errors)).toBe(true)
    const client = createTimelineClient({ baseUrl: 'https://researchtools.example', serviceToken: `rt_svc_fixture-client-01.${'a'.repeat(43)}`, fetch: (async () => Response.json(document)) as typeof fetch })
    expect(await client.discover()).toEqual(document)
    expect(validate({ ...document, identityType: 'service', clientId: undefined })).toBe(false)
  })

  for (const fixture of corpus.fixtures) {
    test(`actual supplied route agrees with frozen ${fixture.id} contract`, async () => {
      expect(normalizeTimelineModelPayload(fixture.modelPayload)).toEqual(fixture.expected)
      const originalFetch = globalThis.fetch
      const calls: string[] = []
      globalThis.fetch = (async (url: RequestInfo | URL) => {
        calls.push(String(url))
        if (String(url) !== 'https://api.openai.com/v1/chat/completions') throw new Error('Unexpected fixture transport')
        return Response.json({ choices: [{ message: { content: JSON.stringify(fixture.modelPayload) } }] })
      }) as typeof fetch
      try {
        const response = await onRequestPost({
          request: new Request('https://researchtools.example/api/tools/extract-timeline', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fixture-session' }, body: JSON.stringify(fixture.request) }),
          env: { SESSIONS: { get: async (key: string) => key === 'fixture-session' ? JSON.stringify({ user_id: 7 }) : null }, OPENAI_API_KEY: 'synthetic-test-key' }, params: {},
        } as never)
        const payload = await response.json() as Record<string, unknown>
        expect(calls).toEqual(['https://api.openai.com/v1/chat/completions'])
        if (fixture.expected.status === 'invalid_output') {
          expect(response.status).toBe(502)
          // Identity controls error shape: browser/session path remains legacy even for strict input.
          expect(payload).toMatchObject({ code: 'MODEL_OUTPUT_INVALID' })
        } else {
          expect(response.status).toBe(200)
          expect(validateSuccess(payload), JSON.stringify(validateSuccess.errors)).toBe(true)
          expect(isTimelineResult(payload)).toBe(true)
          expect(payload.events).toEqual(fixture.expected.events)
          expect(payload).toMatchObject({ outcome: fixture.expected.status === 'ok' ? 'events' : 'no_events', extraction: { sourceMode: 'supplied', contentSource: 'publisher-feed', quality: { accepted: true } }, model: { rejectedEventCount: fixture.expected.rejectedEventCount } })
          if (fixture.id === 'precision-and-dedup') expect({ ...payload, requestId: 'req-synthetic-fixture' }).toEqual(corpus.successResponse)
        }
      } finally { globalThis.fetch = originalFetch }
    })
  }
})
