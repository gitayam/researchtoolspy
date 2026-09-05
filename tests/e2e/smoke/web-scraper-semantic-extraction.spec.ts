import { expect, test } from '@playwright/test'
import { onRequest } from '../../../functions/api/web-scraper'

test.describe('web scraper semantic extraction @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke returns main content and versioned quality without navigation boilerplate', async () => {
    const originalFetch = globalThis.fetch
    const articleHtml = `<html><head>
      <meta content="Semantic report" property="og:title">
      <meta name="author" content="Case Reporter">
      <meta property="og:description" content="Verified report description">
    </head><body>
      <nav>${'Navigation story '.repeat(40)}</nav>
      <article>
        <p>${'Verified main article evidence and context. '.repeat(25)}</p>
        <p>${'A second substantive paragraph preserves the source account. '.repeat(20)}</p>
      </article>
      <footer>Privacy Terms Contact</footer>
    </body></html>`
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com' || url.hostname === 'dns.google') {
        const ipv6 = url.searchParams.get('type') === 'AAAA'
        return Response.json({
          Status: 0,
          Answer: [{ type: ipv6 ? 28 : 1, data: ipv6 ? '2606:2800:220:1:248:1893:25c8:1946' : '93.184.216.34' }],
        })
      }
      if (url.hostname === 'example.com') {
        return new Response(articleHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      }
      throw new Error(`Unexpected test request to ${url.hostname}`)
    }) as typeof fetch

    try {
      const response = await onRequest({
        request: new Request('https://researchtools.test/api/web-scraper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-session' },
          body: JSON.stringify({ url: 'https://example.com/report', extract_mode: 'full' }),
        }),
        env: {
          SESSIONS: { get: async () => JSON.stringify({ user_id: 42 }) },
        },
      } as never)

      expect(response.status).toBe(200)
      const payload = await response.json() as {
        success: boolean
        data: { content: { text: string }; metadata: Record<string, unknown> }
      }
      expect(payload.success).toBe(true)
      expect(payload.data.content.text).toContain('Verified main article evidence')
      expect(payload.data.content.text).not.toContain('Navigation story')
      expect(payload.data.content.text).not.toContain('Privacy Terms')
      expect(payload.data.metadata.extractor_version).toBe('heuristic.v2')
      expect(payload.data.metadata.extraction_quality).toMatchObject({
        version: 'article-quality.v2',
        accepted: true,
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
