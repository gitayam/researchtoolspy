/**
 * Archive-URL builder guard (pure-Node, no browser, no HTTP server).
 *
 * Root cause this guards against (COP-9): generateArchiveUrls() used to emit a
 * `screenshot: /api/content-intelligence/screenshot?url=...` link, but that
 * handler was never implemented (`// TODO: Implement`), so every analyzed URL
 * advertised a dead link. The fix drops the screenshot key until a real
 * screenshot service exists. This asserts only resolvable archive destinations
 * are returned and the dead screenshot key never comes back.
 */
import { test, expect } from '@playwright/test'
import { generateArchiveUrls } from '../../../functions/api/content-intelligence/_archive-urls'

test('@smoke generateArchiveUrls returns only wayback + archive_is (no dead screenshot)', () => {
  const urls = generateArchiveUrls('https://example.com/a')
  expect(Object.keys(urls).sort()).toEqual(['archive_is', 'wayback'])
  expect(urls).not.toHaveProperty('screenshot')
})

test('@smoke generateArchiveUrls never points at the unimplemented screenshot endpoint', () => {
  const urls = generateArchiveUrls('https://example.com/b')
  for (const v of Object.values(urls)) {
    expect(v).not.toContain('/api/content-intelligence/screenshot')
  }
})

test('@smoke generateArchiveUrls embeds the target URL in each destination', () => {
  const target = 'https://news.example.org/story?id=7'
  const urls = generateArchiveUrls(target)
  expect(urls.wayback).toContain(target)
  expect(urls.archive_is).toContain(target)
})
