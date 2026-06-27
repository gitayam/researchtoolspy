/**
 * Transient-fetch-error classifier guard (pure-Node, no browser/server).
 *
 * COP-15: background COP pollers logged `TypeError: Load failed` on every
 * navigation because an aborted/torn-down fetch surfaces as a TypeError (not an
 * AbortError) in WebKit, slipping past the `name !== 'AbortError'` guard. This
 * asserts the classifier swallows transient network/abort drops but still
 * reports genuine application errors.
 */
import { test, expect } from '@playwright/test'
import { isTransientFetchError } from '../../../src/lib/transient-fetch-error'

test('@smoke treats AbortError as transient', () => {
  const e = new DOMException('aborted', 'AbortError')
  expect(isTransientFetchError(e)).toBe(true)
})

test('@smoke treats WebKit "Load failed" / Chrome "Failed to fetch" TypeErrors as transient', () => {
  expect(isTransientFetchError(new TypeError('Load failed'))).toBe(true)
  expect(isTransientFetchError(new TypeError('Failed to fetch'))).toBe(true)
  expect(isTransientFetchError(new TypeError('NetworkError when attempting to fetch resource'))).toBe(true)
})

test('@smoke does NOT swallow genuine application errors', () => {
  expect(isTransientFetchError(new Error('Failed to fetch playbooks'))).toBe(false) // thrown on !res.ok
  expect(isTransientFetchError(new TypeError('x is not a function'))).toBe(false)   // a real bug
  expect(isTransientFetchError(null)).toBe(false)
  expect(isTransientFetchError('Load failed')).toBe(false)                          // a bare string, not an error
})
