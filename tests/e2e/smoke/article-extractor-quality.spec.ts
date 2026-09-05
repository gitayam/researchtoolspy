import { expect, test } from '@playwright/test'
import {
  ARTICLE_EXTRACTOR_VERSION,
  ARTICLE_QUALITY_VERSION,
  extractArticle,
} from '../../../functions/api/_shared/article-extractor'

test.describe('versioned article extraction and quality @smoke', () => {
  test('@smoke reads metadata independent of attribute order and preserves apostrophes', () => {
    const html = `<!doctype html><html><head>
      <meta content="A reporter's field notes" data-extra="x" property="og:title">
      <meta content='Ada Lovelace' name='author'>
      <meta name="keywords" content="research, evidence">
      <meta content="2026-09-04" property="article:published_time">
    </head><body><article><p>${'Evidence based reporting sentence. '.repeat(30)}</p></article></body></html>`

    const result = extractArticle(html, 'https://example.com/report')
    expect(result.extractorVersion).toBe(ARTICLE_EXTRACTOR_VERSION)
    expect(result.qualitySignals.version).toBe(ARTICLE_QUALITY_VERSION)
    expect(result.title).toBe("A reporter's field notes")
    expect(result.author).toBe('Ada Lovelace')
    expect(result.publishedTime).toBe('2026-09-04')
    expect(result.keywords).toEqual(['research', 'evidence'])
  })

  test('@smoke accepts a structured short primary document instead of using length alone', () => {
    const html = `<html><head><title>Official public notice</title></head><body><main>
      <p>${'The agency published a concise verified update for residents today. '.repeat(5)}</p>
      <p>${'The notice includes dates contacts locations and the next public meeting. '.repeat(5)}</p>
    </main></body></html>`
    const result = extractArticle(html, 'https://example.gov/notice')
    expect(result.wordCount).toBeGreaterThanOrEqual(40)
    expect(result.wordCount).toBeLessThan(150)
    expect(result.qualitySignals.accepted).toBe(true)
    expect(result.quality).toBe('good')
    expect(result.qualitySignals.reasons).toEqual([])
  })

  test('@smoke rejects short login placeholders with an explainable reason', () => {
    const html = `<html><head><title>Subscriber article</title></head><body><main>
      <p>Sign in to continue reading this premium content.</p>
      <p>Create an account to continue.</p>
    </main></body></html>`
    const result = extractArticle(html, 'https://example.com/subscriber')
    expect(result.qualitySignals.accepted).toBe(false)
    expect(result.qualitySignals.reasons).toContain('login_or_paywall')
  })

  test('@smoke extracts article text without navigation boilerplate', () => {
    const html = `<html><head><title>Investigation</title></head><body>
      <nav>${'<a href="/section">Navigation item</a>'.repeat(30)}</nav>
      <article><p>${'Substantive investigation evidence and context. '.repeat(35)}</p></article>
      <footer>Privacy Terms Contact</footer>
    </body></html>`
    const result = extractArticle(html, 'https://example.com/investigation')
    expect(result.text).toContain('Substantive investigation')
    expect(result.text).not.toContain('Navigation item')
    expect(result.text).not.toContain('Privacy Terms')
    expect(result.qualitySignals.accepted).toBe(true)
  })

  test('@smoke leaves invalid numeric entities inert instead of throwing', () => {
    const result = extractArticle(
      '<html><head><title>Entity test</title></head><body><p>&#x110000; &#55296; safe text</p></body></html>',
      'https://example.com/entities',
    )
    expect(result.text).toContain('&#x110000;')
    expect(result.text).toContain('&#55296;')
  })
})
