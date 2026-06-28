/**
 * Public URL-preview pure-helper guard (pure-Node, no browser, no HTTP server).
 *
 * Guards the dependency-free helpers behind the token-scoped public URL-preview
 * endpoint (E-5a):
 *   - validatePreviewUrl: http(s)-only + length-capped gate, applied BEFORE any
 *     network call. (Private-IP / SSRF rejection is enforced separately in the
 *     endpoint via isPrivateUrl; this asserts the protocol + length gate.)
 *   - shapePreview: maps an analyze-url (quick mode) result to the minimal
 *     confirm-card shape, tolerates missing fields, passes through duplicate +
 *     archive_url, and NEVER leaks the raw result or submitter IP / user-agent.
 */
import { test, expect } from '@playwright/test'
import {
  validatePreviewUrl,
  shapePreview,
  MAX_PREVIEW_URL_LENGTH,
} from '../../../functions/api/surveys/public/[token]/_preview-url'

// ---- validatePreviewUrl -----------------------------------------------------

test('@smoke validatePreviewUrl accepts a normal https URL', () => {
  const r = validatePreviewUrl('https://example.com/x')
  expect(r.ok).toBe(true)
  if (r.ok) expect(r.url).toBe('https://example.com/x')
})

test('@smoke validatePreviewUrl accepts http as well as https', () => {
  expect(validatePreviewUrl('http://example.com/').ok).toBe(true)
})

test('@smoke validatePreviewUrl rejects non-http(s) schemes', () => {
  for (const bad of ['ftp://example.com/x', 'javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd']) {
    const r = validatePreviewUrl(bad)
    expect(r.ok, `expected ${bad} to be rejected`).toBe(false)
  }
})

test('@smoke validatePreviewUrl rejects empty and whitespace-only strings', () => {
  expect(validatePreviewUrl('').ok).toBe(false)
  expect(validatePreviewUrl('   ').ok).toBe(false)
})

test('@smoke validatePreviewUrl rejects non-string input', () => {
  expect(validatePreviewUrl(undefined).ok).toBe(false)
  expect(validatePreviewUrl(null).ok).toBe(false)
  expect(validatePreviewUrl(42).ok).toBe(false)
  expect(validatePreviewUrl({ url: 'https://example.com' }).ok).toBe(false)
})

test('@smoke validatePreviewUrl rejects garbage that is not a URL', () => {
  expect(validatePreviewUrl('not a url').ok).toBe(false)
})

test('@smoke validatePreviewUrl rejects over-length URLs', () => {
  const tooLong = 'https://example.com/' + 'a'.repeat(MAX_PREVIEW_URL_LENGTH)
  const r = validatePreviewUrl(tooLong)
  expect(r.ok).toBe(false)
})

// ---- shapePreview -----------------------------------------------------------

const SAMPLE_ANALYZE = {
  // a realistic analyze-url quick-mode result (superset of what we keep)
  id: 123,
  url: 'https://news.example.org/story',
  title: 'Breaking: Something Happened',
  author: 'Jane Doe',
  publish_date: '2026-06-01',
  summary: 'A short summary of the article.',
  extracted_text: 'Full extracted body text that should not leak wholesale.',
  word_count: 4200,
  content_hash: 'deadbeef',
  entities: { people: ['Jane Doe'] },
  bypass_urls: { smry_ai: 'https://smry.ai/x' },
}

test('@smoke shapePreview maps the confirm-card fields from an analyze result', () => {
  const out = shapePreview(SAMPLE_ANALYZE, { duplicate: false, archiveUrl: 'https://web.archive.org/web/*/x' })
  expect(out.ok).toBe(true)
  expect(out.title).toBe('Breaking: Something Happened')
  expect(out.author).toBe('Jane Doe')
  expect(out.published_date).toBe('2026-06-01')
  expect(out.summary).toBe('A short summary of the article.')
  expect(out.archive_url).toBe('https://web.archive.org/web/*/x')
  expect(out.duplicate).toBe(false)
})

test('@smoke shapePreview tolerates a missing / empty analyze result without throwing', () => {
  const out = shapePreview(null, { duplicate: true })
  expect(out.ok).toBe(true)
  expect(out.duplicate).toBe(true)
  expect(out.title).toBeUndefined()
  expect(out.author).toBeUndefined()
  expect(out.published_date).toBeUndefined()
  expect(out.summary).toBeUndefined()

  const partial = shapePreview({ title: 'Only a title' }, { duplicate: false })
  expect(partial.title).toBe('Only a title')
  expect(partial.author).toBeUndefined()
})

test('@smoke shapePreview passes through duplicate and archive_url', () => {
  const out = shapePreview(SAMPLE_ANALYZE, { duplicate: true, archiveUrl: 'https://archive.is/y' })
  expect(out.duplicate).toBe(true)
  expect(out.archive_url).toBe('https://archive.is/y')
})

test('@smoke shapePreview does NOT include raw analyze fields or submitter PII', () => {
  const tainted = {
    ...SAMPLE_ANALYZE,
    submitter_ip_hash: 'should-not-appear',
    submitter_ip: '1.2.3.4',
    user_agent: 'Mozilla/5.0 evil',
    entities: { people: ['x'] },
  }
  const out = shapePreview(tainted as Record<string, unknown>, { duplicate: false, archiveUrl: 'https://web.archive.org/web/*/x' })
  const serialized = JSON.stringify(out)
  // No raw / heavy fields
  expect(serialized).not.toContain('extracted_text')
  expect(serialized).not.toContain('entities')
  expect(serialized).not.toContain('word_count')
  expect(serialized).not.toContain('content_hash')
  expect(serialized).not.toContain('bypass_urls')
  // No submitter PII
  expect(serialized).not.toContain('submitter_ip')
  expect(serialized).not.toContain('user_agent')
  expect(serialized).not.toContain('1.2.3.4')
  expect(serialized).not.toContain('evil')
  // Only the allowed keys may be present
  expect(Object.keys(out).sort()).toEqual(
    ['archive_url', 'author', 'duplicate', 'excerpt', 'ok', 'published_date', 'summary', 'title', 'url'].sort()
  )
})
