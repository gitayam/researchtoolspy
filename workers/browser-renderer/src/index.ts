interface Env { BROWSER: { quickAction(action: string, input: Record<string, unknown>): Promise<unknown> } }

function validPublicUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.length > 4096) return null
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0' || host === '::1') return null
    if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return null
    return url
  } catch { return null }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const body = await request.json().catch(() => null) as { url?: unknown } | null
    const url = validPublicUrl(body?.url)
    if (!url) return Response.json({ error: 'Invalid public HTTP(S) URL' }, { status: 400 })
    try {
      const rendered = await env.BROWSER.quickAction('markdown', {
        url: url.toString(),
        gotoOptions: { waitUntil: 'domcontentloaded', timeout: 20_000 },
        rejectRequestPattern: ['*.css', '*.woff*', '*.mp4', '*.webm', '*.avi'],
      })
      const value = rendered as any
      const markdown = typeof value === 'string' ? value : value?.result || value?.markdown || ''
      if (typeof markdown !== 'string' || markdown.trim().length < 40) {
        return Response.json({ error: 'Rendered page contained insufficient text' }, { status: 422 })
      }
      return Response.json({ markdown: markdown.slice(0, 100_000), source: 'cloudflare-browser-run' })
    } catch (error) {
      console.error('[browser-renderer] render failed', error)
      return Response.json({ error: 'Browser rendering failed' }, { status: 502 })
    }
  },
}
