/**
 * Submitter PII guard (pure-Node, no browser, no HTTP server).
 *
 * Privacy directive E-1: a normal research-form creator must NEVER be able to
 * capture or see a submitter's raw IP address or user-agent. The public submit
 * handler used to auto-capture `CF-Connecting-IP` / `X-Forwarded-For` and the
 * `User-Agent` header and store them on `form_submissions`, where the creator's
 * reviewer UI could read them back. That capture is now removed (both columns
 * are stored as NULL), and the reviewer list endpoint must not select them.
 *
 * This reads the shipped source files and asserts those guarantees, so a future
 * change can't silently re-introduce submitter-IP/UA capture or exposure.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readSource(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf8')
}

const SUBMIT_HANDLER = 'functions/api/research/submit/[hashId].ts'
const LIST_ENDPOINT = 'functions/api/research/submissions/list.ts'

test('@smoke submit handler does not capture submitter IP', () => {
  const src = readSource(SUBMIT_HANDLER)
  // The submitter's network IP must never be read from request headers.
  expect(
    src.includes('CF-Connecting-IP'),
    'submit handler must not read CF-Connecting-IP (submitter IP capture is banned)'
  ).toBe(false)
  expect(
    src.includes('X-Forwarded-For'),
    'submit handler must not read X-Forwarded-For (submitter IP capture is banned)'
  ).toBe(false)
})

test('@smoke submit handler does not capture submitter user-agent', () => {
  const src = readSource(SUBMIT_HANDLER)
  // The only legitimate User-Agent reference is the outbound metadata-fetch
  // header ('User-Agent': 'ResearchToolsPy/...'). Reading the INBOUND request
  // User-Agent for storage is banned.
  expect(
    /headers\.get\(\s*['"]User-Agent['"]\s*\)/.test(src),
    'submit handler must not read the inbound request User-Agent header (submitter UA capture is banned)'
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
