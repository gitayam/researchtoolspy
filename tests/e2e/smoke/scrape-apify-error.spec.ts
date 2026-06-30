/**
 * Source-guard smoke test for #21 — scrape apifyError logging.
 *
 * Verifies that scrape.ts:
 *   1. References `apifyError` in a logEvent call (not just parsed and discarded).
 *   2. Has no bare `console.error` calls remaining in error paths — all upgraded to
 *      the logEvent / buildUpstreamFailureLog pattern.
 *
 * Pure-Node, no browser, no HTTP server — reads source as a string and asserts on
 * the code structure to catch future regressions that reintroduce the lint violation.
 */
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import * as path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SCRAPE_TS = path.resolve(
  __dirname,
  '../../../functions/api/cop/[id]/scrape.ts'
)

test.describe('scrape.ts apifyError logging source-guard @smoke', () => {
  let source: string

  test.beforeAll(() => {
    source = fs.readFileSync(SCRAPE_TS, 'utf-8')
  })

  test('@smoke apifyError is passed into a logEvent call', () => {
    // The variable must appear inside a logEvent(...) invocation, not just be declared.
    // We look for logEvent(...apifyError...) in the source — either on the same line
    // or in a multi-line call that contains "apifyError".
    const logEventBlock = source.match(/logEvent\([\s\S]*?apifyError[\s\S]*?\)/)
    expect(
      logEventBlock,
      'Expected apifyError to be referenced inside a logEvent() call in scrape.ts'
    ).not.toBeNull()
  })

  test('@smoke no bare console.error remains in error paths', () => {
    // Any remaining console.error in scrape.ts is a regression — all error paths
    // must use logEvent / buildUpstreamFailureLog instead.
    const bareConsoleErrors = source.match(/console\.error/g)
    expect(
      bareConsoleErrors,
      'Found bare console.error in scrape.ts — upgrade to logEvent(env, buildUpstreamFailureLog(...))'
    ).toBeNull()
  })

  test('@smoke logEvent uses the guarded .catch(() => {}) pattern for run-start failures', () => {
    // The logEvent call in the run-start error path must be guarded with .catch(() => {})
    // so a D1 write error cannot abort the HTTP response.
    const guardedPattern = /logEvent\(env,\s*buildUpstreamFailureLog\('cop\/scrape\/run-start'[\s\S]*?\)\s*\)\.catch\(\s*\(\)\s*=>\s*\{\}\s*\)/
    expect(
      guardedPattern.test(source),
      'logEvent for run-start in scrape.ts must be guarded with .catch(() => {})'
    ).toBe(true)
  })

  test('@smoke buildUpstreamFailureLog is called for both run-start and status-check errors', () => {
    const runStartCalls = (source.match(/buildUpstreamFailureLog\('cop\/scrape\/run-start'/g) || []).length
    const statusCheckCalls = (source.match(/buildUpstreamFailureLog\('cop\/scrape\/status-check'/g) || []).length

    expect(runStartCalls).toBeGreaterThanOrEqual(2) // non-OK response + catch block
    expect(statusCheckCalls).toBeGreaterThanOrEqual(1) // GET handler catch block
  })
})
