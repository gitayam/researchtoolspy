/**
 * AI Gateway header contract (pure-Node, no browser, no HTTP server).
 *
 * Pins what makes the gateway switchable to authenticated without a code change:
 * `cf-aig-authorization` is sent exactly when AI_GATEWAY_TOKEN is set, and the
 * metadata stays inside the gateway's five-entry limit while carrying app/feature
 * for cost attribution. Positive and negative cases are both asserted.
 */
import { test, expect } from '@playwright/test'
import {
  buildGatewayMetadata,
  gatewayChatUrl,
  gatewayHeaders,
  callOpenAIViaGateway,
} from '../../../functions/api/_shared/ai-gateway'

test.describe('AI gateway headers @smoke', () => {
  test('@smoke authorization header only when the token is set', () => {
    const without = gatewayHeaders({}, 300, { endpoint: 'x' })
    expect(without['cf-aig-authorization']).toBeUndefined()
    expect(without['cf-aig-cache-ttl']).toBe('300')

    const withToken = gatewayHeaders({ AI_GATEWAY_TOKEN: 'tok' }, 300, { endpoint: 'x' })
    expect(withToken['cf-aig-authorization']).toBe('Bearer tok')
  })

  test('@smoke metadata leads with app/feature, keeps caller keys, caps at five', () => {
    const md = buildGatewayMetadata({
      endpoint: 'pmesii-pt',
      operation: 'import-url',
      content_hash: 'abc',
      user_id: 7,
      extra: 'dropped by the cap',
    })
    expect(md).toEqual({
      app: 'researchtools',
      feature: 'pmesii-pt:import-url',
      endpoint: 'pmesii-pt',
      operation: 'import-url',
      content_hash: 'abc',
    })
    expect(Object.keys(md)).toHaveLength(5)
  })

  test('@smoke non-primitive metadata values are dropped, missing feature is labelled', () => {
    const md = buildGatewayMetadata({ nested: { a: 1 }, list: [1], gone: undefined, nil: null, userId: 153 })
    expect(md).toEqual({ app: 'researchtools', feature: 'unspecified', userId: 153 })
  })

  test('@smoke gateway URL from env, with the historical gateway name by default', () => {
    expect(gatewayChatUrl({ AI_GATEWAY_ACCOUNT_ID: ' acct ' }))
      .toBe('https://gateway.ai.cloudflare.com/v1/acct/research-tools-ai/openai/chat/completions')
    expect(gatewayChatUrl({ AI_GATEWAY_ACCOUNT_ID: 'acct', AI_GATEWAY_ID: 'other' }))
      .toBe('https://gateway.ai.cloudflare.com/v1/acct/other/openai/chat/completions')
  })

  test('@smoke a call sends the token and metadata through the gateway, and none when unset', async () => {
    const originalFetch = globalThis.fetch
    const calls: Array<{ url: string; headers: Headers }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), headers: new Headers(init?.headers) })
      return Response.json({ choices: [{ message: { content: 'ok' } }] })
    }) as typeof fetch
    try {
      const base = { OPENAI_API_KEY: 'k', AI_GATEWAY_ACCOUNT_ID: 'acct' }
      const req = { tier: 'cheap', messages: [{ role: 'user', content: 'hi' }] }

      await callOpenAIViaGateway({ ...base, AI_GATEWAY_TOKEN: 'tok' }, req, { metadata: { endpoint: 'e' } })
      await callOpenAIViaGateway(base, req, { metadata: { endpoint: 'e' } })

      expect(calls).toHaveLength(2)
      expect(calls[0].url).toContain('gateway.ai.cloudflare.com/v1/acct/research-tools-ai/')
      expect(calls[0].headers.get('cf-aig-authorization')).toBe('Bearer tok')
      expect(JSON.parse(calls[0].headers.get('cf-aig-metadata')!)).toEqual({
        app: 'researchtools', feature: 'e', endpoint: 'e',
      })
      expect(calls[1].headers.get('cf-aig-authorization')).toBeNull()
      // The OpenAI key still travels as the provider key either way.
      expect(calls[1].headers.get('Authorization')).toBe('Bearer k')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
