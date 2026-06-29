/**
 * deep-scrape — pure-Node unit test for `canDeepScrape` + handoff constants (E-15).
 *
 * Guards the reviewer's "Deep scrape" gate: the button only shows for a usable
 * http(s) source URL (so we never set the `pending_url_analysis` handoff key for
 * an un-fetchable or unsafe URL). Also pins the localStorage key + route the
 * Content Intelligence page reads on mount, so a rename there can't silently
 * break the handoff. No `page` fixture, no server — mirrors cite-source.spec.ts.
 */
import { test, expect } from '@playwright/test'
import {
  canDeepScrape,
  PENDING_URL_ANALYSIS_KEY,
  CONTENT_INTEL_ROUTE,
} from '../../../src/lib/deep-scrape'

test.describe('canDeepScrape @smoke', () => {
  test('@smoke handoff constants match the Content Intelligence page contract', () => {
    expect(PENDING_URL_ANALYSIS_KEY).toBe('pending_url_analysis')
    expect(CONTENT_INTEL_ROUTE).toBe('/dashboard/tools/content-intelligence')
  })

  test('@smoke true for non-empty http(s) URLs', () => {
    expect(canDeepScrape('https://x.com/a')).toBe(true)
    expect(canDeepScrape('http://x.com')).toBe(true)
    // Surrounding whitespace is trimmed before parsing.
    expect(canDeepScrape('  https://x.com/a  ')).toBe(true)
  })

  test('@smoke false for empty / nullish / whitespace', () => {
    expect(canDeepScrape('')).toBe(false)
    expect(canDeepScrape(null)).toBe(false)
    expect(canDeepScrape(undefined)).toBe(false)
    expect(canDeepScrape('   ')).toBe(false)
  })

  test('@smoke false for non-http schemes and bare domains', () => {
    expect(canDeepScrape('ftp://x.com')).toBe(false)
    expect(canDeepScrape('javascript:alert(1)')).toBe(false)
    // Bare domain has no protocol, so `new URL()` throws -> not scrapable.
    expect(canDeepScrape('x.com')).toBe(false)
  })
})
