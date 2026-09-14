import { presentationRoute, readTimelinePresentation, type TimelinePresentationEnv } from '../api/_shared/timeline-presentation-store'
import type { TimelinePresentation } from '../../src/lib/timeline-presentation-contract'
import { timelineLinkPreview } from '../../src/lib/timeline-link-preview'

type Env = TimelinePresentationEnv & { ASSETS: { fetch(request: Request): Promise<Response> } }
const policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"
function headers() {
  return new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex,nofollow', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': policy })
}
function escape(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}
function unavailable(status: number, head: boolean): Response {
  return new Response(head ? null : '<!doctype html><html lang="en"><head><title>Timeline presentation unavailable</title></head><body><p>Timeline presentation unavailable.</p></body></html>', { status, headers: headers() })
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const head = request.method === 'HEAD'
  if (request.method !== 'GET' && !head) {
    const response = unavailable(405, false)
    response.headers.set('Allow', 'GET, HEAD')
    return response
  }
  try {
    const url = new URL(request.url)
    const match = /^\/present\/([0-9a-f]{64})$/.exec(url.pathname)
    let status = 404
    let preview: ReturnType<typeof timelineLinkPreview> | undefined
    if (match && !url.search && !url.href.includes('?')) {
      const stored = await presentationRoute(() => readTimelinePresentation(request, env, match[1]))
      if (stored.status === 200) {
        const presentation = await stored.json() as TimelinePresentation
        preview = timelineLinkPreview(presentation.timeline)
        status = 200
      } else if (stored.status !== 404) status = 503
    }
    const asset = await env.ASSETS.fetch(new Request(new URL('/index.html', url.origin), { method: 'GET' }))
    if (!asset.ok || !/^text\/html(?:\s*;|$)/i.test(asset.headers.get('Content-Type') || '')) return unavailable(503, head)
    // ASSETS is the trusted built index, not arbitrary HTML. A service binding
    // can surface an interrupted stream as EOF; HTMLRewriter alone tolerates
    // that truncation. Require the explicit shell structure before injecting
    // presentation metadata. This is a completeness check, not an HTML sanitizer.
    const shell = await asset.text()
    const exactlyOne = (pattern: RegExp) => (shell.match(pattern) || []).length === 1
    const shellComplete = /^\s*<!doctype html>/i.test(shell)
      && exactlyOne(/<html(?:\s[^>]*)?>/gi) && /<\/html>\s*$/i.test(shell)
      && exactlyOne(/<head(?:\s[^>]*)?>/gi) && exactlyOne(/<\/head\s*>/gi)
      && exactlyOne(/<body(?:\s[^>]*)?>/gi) && exactlyOne(/<\/body\s*>/gi)
      && exactlyOne(/<title(?:\s[^>]*)?>/gi) && exactlyOne(/<\/title\s*>/gi)
      && /<head(?:\s[^>]*)?>[\s\S]*<title(?:\s[^>]*)?>[\s\S]*<\/title\s*>[\s\S]*<\/head\s*>\s*<body(?:\s[^>]*)?>[\s\S]*<\/body\s*>\s*<\/html>\s*$/i.test(shell)
      && /<div\b[^>]*\bid=["']root["'][^>]*>\s*<\/div\s*>/i.test(shell)
      && /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']\/assets\/[A-Za-z0-9_.-]+\.js["'])[^>]*>\s*<\/script\s*>/i.test(shell)
    if (!shellComplete) return unavailable(503, head)
    const title = preview?.title || 'Timeline presentation unavailable'
    const description = preview?.description || 'This shared timeline presentation is unavailable.'
    const canonical = url.origin + (preview ? url.pathname : '/present')
    const image = url.origin + '/timeline-share-card.png'
    const tags = [
      `<meta name="description" content="${escape(description)}">`,
      `<link rel="canonical" href="${escape(canonical)}">`,
      '<meta property="og:type" content="website">',
      `<meta property="og:url" content="${escape(canonical)}">`,
      `<meta property="og:title" content="${escape(title)}">`,
      `<meta property="og:description" content="${escape(description)}">`,
      `<meta property="og:image" content="${escape(image)}">`,
      '<meta property="og:image:type" content="image/png">',
      ...(url.protocol === 'https:' ? [`<meta property="og:image:secure_url" content="${escape(image)}">`] : []),
      '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
      `<meta property="og:image:alt" content="${escape(preview?.imageAlt || 'Timeline presentation card with connected events')}">`,
      '<meta property="og:site_name" content="ResearchTools">',
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${escape(title)}">`,
      `<meta name="twitter:description" content="${escape(description)}">`,
      `<meta name="twitter:image" content="${escape(image)}">`,
      `<meta name="twitter:image:alt" content="${escape(preview?.imageAlt || 'Timeline presentation card with connected events')}">`,
    ].join('')
    const rewritten = new HTMLRewriter()
      .on('title', { element(element) { element.setInnerContent(title) } })
      .on('meta', { element(element) {
        const name = (element.getAttribute('name') || '').toLowerCase()
        const property = (element.getAttribute('property') || '').toLowerCase()
        if (name === 'description' || name.startsWith('twitter:') || name.startsWith('og:') || property.startsWith('og:') || property.startsWith('twitter:')) element.remove()
      } })
      .on('link', { element(element) { if ((element.getAttribute('rel') || '').toLowerCase().split(/\s+/).includes('canonical')) element.remove() } })
      .on('head', { element(element) { element.append(tags, { html: true }) } })
      .on('body', { element(element) { element.prepend(`<noscript><h1>${escape(title)}</h1><p>${escape(description)}</p></noscript>`, { html: true }) } })
      .transform(new Response(shell, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
    // Complete rewriting before returning so asset/rewriter failures cannot leak
    // a partial success document; never log token, metadata or exceptions.
    const html = await rewritten.text()
    return new Response(head ? null : html, { status, headers: headers() })
  } catch { return unavailable(503, head) }
}
