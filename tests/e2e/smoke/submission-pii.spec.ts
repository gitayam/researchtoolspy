/**
 * Submitter PII guard (pure-Node, no browser, no HTTP server).
 *
 * Privacy directive E-1: a normal research-form creator must NEVER be able to
 * capture or see a submitter's raw IP address or user-agent. The legacy
 * System-B public submit handler (`research/submit/[hashId].ts`) used to
 * auto-capture `CF-Connecting-IP` / `X-Forwarded-For` and the `User-Agent`
 * header and store them on `form_submissions`. That handler has now been
 * RETIRED entirely (E-4b-3+4) — System A is the live engine — so the capture
 * path is structurally gone. This spec asserts the handler stays deleted and
 * that the live reviewer list endpoint (System A) still does not select or
 * return submitter IP / user-agent.
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function readSource(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf8')
}

const SUBMIT_HANDLER = 'functions/api/research/submit/[hashId].ts'
const LIST_ENDPOINT = 'functions/api/research/submissions/list.ts'

test('@smoke retired System-B submit handler stays deleted (no IP/UA capture path can return)', () => {
  // The legacy handler was the only place that read submitter IP/UA. With it
  // gone, the capture path cannot silently regress.
  expect(
    existsSync(resolve(process.cwd(), SUBMIT_HANDLER)),
    'legacy System-B submit handler must not be re-introduced (it captured submitter IP/UA)'
  ).toBe(false)
})

test('@smoke reviewer list endpoint does not select or return submitter IP / user-agent', () => {
  const src = readSource(LIST_ENDPOINT)
  expect(
    src.includes('submitter_ip'),
    'list endpoint must not select/return submitter_ip'
  ).toBe(false)
  expect(
    src.includes('user_agent'),
    'list endpoint must not select/return user_agent'
  ).toBe(false)
})
