/**
 * CSP map-allowlist guard (pure-Node, no browser, no HTTP server).
 *
 * Root cause this guards against (COP-13): the CSP in `public/_headers` (added by
 * commit d1866dae8) had NO `worker-src` — so maplibre-gl's `blob:` render workers
 * fell back to `default-src 'self'` and were blocked — and `connect-src` omitted the
 * CartoCDN basemap host actually used by CopMap, so the dark-matter basemap (style,
 * tiles, sprite, glyphs) and the nominatim place-search were refused. The COP map was
 * fully non-functional in prod. The fix adds `worker-src 'self' blob:` and the
 * `*.cartocdn.com` + `nominatim.openstreetmap.org` connect-src hosts.
 *
 * This reads the shipped `public/_headers` (the single authoritative CSP, copied
 * verbatim to dist/_headers at build) and asserts the map-critical directives, so a
 * future CSP tightening can't silently break the map again.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readCsp(): string {
  const headers = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8')
  const line = headers.split('\n').find((l) => l.includes('Content-Security-Policy:'))
  expect(line, 'public/_headers must define a Content-Security-Policy').toBeTruthy()
  return (line as string).split('Content-Security-Policy:')[1].trim()
}

/** Extract a single CSP directive's value (everything up to the next `;`). */
function directive(csp: string, name: string): string {
  const re = new RegExp(`(?:^|;)\\s*${name}\\s+([^;]+)`)
  const m = csp.match(re)
  return m ? m[1].trim() : ''
}

test('@smoke CSP allows maplibre blob: workers (worker-src)', () => {
  const csp = readCsp()
  const workerSrc = directive(csp, 'worker-src')
  expect(workerSrc, 'worker-src directive must be present (else falls back to default-src and blocks maplibre)').toBeTruthy()
  expect(workerSrc).toContain('blob:')
})

test('@smoke CSP connect-src allows the CartoCDN basemap + nominatim place search', () => {
  const csp = readCsp()
  const connectSrc = directive(csp, 'connect-src')
  expect(connectSrc).toContain('https://*.cartocdn.com')
  expect(connectSrc).toContain('https://nominatim.openstreetmap.org')
  // The map and same-origin API must still be allowed.
  expect(connectSrc).toContain("'self'")
})
