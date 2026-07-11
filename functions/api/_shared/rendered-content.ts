import type { ArticleExtraction } from './article-extractor'

export interface RendererBinding { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> }

export function shouldRenderFallback(article: ArticleExtraction, html: string): boolean {
  if (article.quality === 'empty') return true
  if (article.quality === 'good') return false
  const scripts = (html.match(/<script\b/gi) || []).length
  return scripts >= 5 || /__NEXT_DATA__|id=["'](?:root|app|__next)["']|enable javascript/i.test(html)
}

export async function renderArticleFallback(
  renderer: RendererBinding | undefined,
  url: string,
): Promise<string | null> {
  if (!renderer) return null
  try {
    const response = await renderer.fetch('https://browser-renderer.internal/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(35_000),
    })
    if (!response.ok) return null
    const data = await response.json() as { markdown?: unknown }
    return typeof data.markdown === 'string' && data.markdown.trim().length >= 40
      ? data.markdown.trim().slice(0, 100_000)
      : null
  } catch (error) {
    console.error('[rendered-content] Browser Run fallback failed:', error)
    return null
  }
}
