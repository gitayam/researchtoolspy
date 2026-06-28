/**
 * Public-form URL confirm-card pure-helper guard (pure-Node, no browser).
 *
 * Guards isPreviewableUrl — the browser-side gate that decides whether the inline
 * UrlConfirmCard (E-5b) fires a preview request. It must accept only complete
 * http(s) URLs (so we never fire on partial / mid-typing input) and reject empty,
 * whitespace, garbage, non-http(s) schemes, and bare domains (no scheme).
 *
 * The card's rendering needs a browser/DOM, so this covers only the pure helper.
 */
import { test, expect } from '@playwright/test'
import { isPreviewableUrl } from '../../../src/lib/url-confirm'

test('@smoke isPreviewableUrl accepts a complete https URL', () => {
  expect(isPreviewableUrl('https://x.com/a')).toBe(true)
})

test('@smoke isPreviewableUrl accepts http as well as https', () => {
  expect(isPreviewableUrl('http://x.com')).toBe(true)
})

test('@smoke isPreviewableUrl rejects empty and whitespace-only input', () => {
  expect(isPreviewableUrl('')).toBe(false)
  expect(isPreviewableUrl('   ')).toBe(false)
})

test('@smoke isPreviewableUrl rejects garbage that is not a URL', () => {
  expect(isPreviewableUrl('notaurl')).toBe(false)
})

test('@smoke isPreviewableUrl rejects non-http(s) schemes', () => {
  expect(isPreviewableUrl('ftp://x')).toBe(false)
  expect(isPreviewableUrl('javascript:alert(1)')).toBe(false)
})

test('@smoke isPreviewableUrl rejects a bare domain with no scheme', () => {
  // Avoid firing previews while the user is still typing — "x.com" is incomplete.
  expect(isPreviewableUrl('x.com')).toBe(false)
})
