import { expect, test } from '@playwright/test'
import { SafeFetchError } from '../../../functions/api/_shared/safe-fetch'
import {
  fetchFixedProviderBytes,
  fetchFixedProviderJson,
} from '../../../functions/api/_shared/fixed-provider'
import {
  extractDocKmlFromZipAsync,
  onRequestPost as geoconfirmedPost,
} from '../../../functions/api/tools/geoconfirmed'
import { onRequestPost as virusTotalPost } from '../../../functions/api/content-intelligence/virustotal-lookup'

const publicResolver = async () => ['93.184.216.34']
const sessions = {
  get: async (token: string) => token === 'session-token' ? JSON.stringify({ user_id: 7 }) : null,
}

test.describe('fixed provider outbound policy @smoke', () => {
  test('@smoke scopes credentials to one HTTPS origin and encodes path/query input', async () => {
    const calls: Array<{ url: string; headers: Headers }> = []
    const result = await fetchFixedProviderJson<{ ok: boolean }>(
      'https://provider.example',
      ['api', 'domains', 'name/with/slash'],
      {
        searchParams: { query: 'sensitive value' },
        credentialHeaders: { 'x-api-key': 'provider-secret' },
        resolveHostname: publicResolver,
        fetchImpl: async (input, init) => {
          calls.push({ url: String(input), headers: new Headers(init?.headers) })
          return Response.json({ ok: true })
        },
      },
    )

    expect(result.data).toEqual({ ok: true })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://provider.example/api/domains/name%2Fwith%2Fslash?query=sensitive+value')
    expect(calls[0].headers.get('x-api-key')).toBe('provider-secret')
  })

  test('@smoke rejects redirects before credentials or transport reach another origin', async () => {
    const calls: string[] = []
    let caught: unknown
    try {
      await fetchFixedProviderJson('https://provider.example', ['api', 'report'], {
        credentialHeaders: { Authorization: 'Bearer provider-secret' },
        resolveHostname: publicResolver,
        fetchImpl: async (input) => {
          calls.push(String(input))
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://attacker.example/collect' },
          })
        },
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(SafeFetchError)
    expect((caught as SafeFetchError).code).toBe('redirect_limit')
    expect(calls).toEqual(['https://provider.example/api/report'])
  })

  test('@smoke rejects oversized, wrong-MIME, and malformed provider success responses', async () => {
    const cases = [
      {
        response: new Response('{}', {
          headers: { 'Content-Type': 'application/json', 'Content-Length': '2048' },
        }),
        code: 'response_too_large',
      },
      {
        response: new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }),
        code: 'unsupported_content_type',
      },
      {
        response: new Response('{broken', { headers: { 'Content-Type': 'application/json' } }),
        code: 'unsupported_content_type',
      },
    ] as const

    for (const scenario of cases) {
      let caught: unknown
      try {
        await fetchFixedProviderJson('https://provider.example', ['api', 'report'], {
          maxResponseBytes: 32,
          resolveHostname: publicResolver,
          fetchImpl: async () => scenario.response,
        })
      } catch (error) {
        caught = error
      }
      expect(caught).toBeInstanceOf(SafeFetchError)
      expect((caught as SafeFetchError).code).toBe(scenario.code)
    }
  })

  test('@smoke bounds fixed-provider binary responses under an explicit MIME contract', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const result = await fetchFixedProviderBytes('https://provider.example', ['api', 'export'], {
      allowedContentTypes: ['application/zip'],
      maxResponseBytes: 32,
      resolveHostname: publicResolver,
      fetchImpl: async () => new Response(bytes, { headers: { 'Content-Type': 'application/zip' } }),
    })
    expect([...result.bytes]).toEqual([...bytes])
  })

  test('@smoke rejects a KMZ entry whose declared expansion exceeds the decompression budget', async () => {
    const filename = new TextEncoder().encode('doc.kml')
    const archive = new Uint8Array(30 + filename.length + 1)
    archive.set([0x50, 0x4b, 0x03, 0x04], 0)
    const view = new DataView(archive.buffer)
    view.setUint16(8, 0, true)
    view.setUint32(18, 1, true)
    view.setUint32(22, 16 * 1024 * 1024 + 1, true)
    view.setUint16(26, filename.length, true)
    archive.set(filename, 30)

    await expect(extractDocKmlFromZipAsync(archive)).rejects.toThrow('KMZ entry exceeds')
  })

  test('@smoke provider routes reject malformed targets before outbound transport', async () => {
    const originalFetch = globalThis.fetch
    let fetchCalls = 0
    globalThis.fetch = async () => {
      fetchCalls += 1
      throw new Error('outbound transport must not run')
    }
    const auth = { Authorization: 'Bearer session-token', 'Content-Type': 'application/json' }
    try {
      const geoconfirmed = await geoconfirmedPost({
        request: new Request('https://researchtools.example/api/tools/geoconfirmed', {
          method: 'POST', headers: auth,
          body: JSON.stringify({ url: 'https://evilgeoconfirmed.org/iran/event' }),
        }),
        env: { SESSIONS: sessions }, params: {},
      } as never)
      const virusTotal = await virusTotalPost({
        request: new Request('https://researchtools.example/api/content-intelligence/virustotal-lookup', {
          method: 'POST', headers: auth,
          body: JSON.stringify({ url: 'ftp://example.com/file' }),
        }),
        env: { SESSIONS: sessions, VIRUSTOTAL_API_KEY: 'test-key' }, params: {},
      } as never)

      expect(geoconfirmed.status).toBe(400)
      expect(virusTotal.status).toBe(400)
      expect(fetchCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
