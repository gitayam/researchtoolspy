import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * A real production 500, reproduced and pinned.
 *
 * Guest users are auto-provisioned with a UNIQUE username derived from their
 * auth hash. That label used to be a PREFIX of the hash — 8 chars, then widened
 * to 32. A prefix is only as distinctive as its input, and some clients send a
 * JWT as the hash: every HS256 JWT starts with the same 36 characters, being
 * the base64 of `{"alg":"HS256","typ":"JWT"}`. So the first such visitor took
 * `guest_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX`, and every later one collided on the
 * UNIQUE username, failed to INSERT, found nothing when re-selecting by its own
 * hash, and threw — a 500 on every request, permanently, for that visitor.
 */
const HS256_JWT_PREFIX = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'

async function guestLabel(hash: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hash))
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 32)
}

test.describe('guest label derivation @smoke', () => {
  test('two different JWTs do not collide, though their prefixes are identical', async () => {
    const a = `${HS256_JWT_PREFIX}eyJzdWIiOiJhbGljZSJ9.signature-a`
    const b = `${HS256_JWT_PREFIX}eyJzdWIiOiJib2IifQ.signature-b`

    // The shape that caused the outage: the old 32-char prefix is the same.
    expect(a.substring(0, 32)).toBe(b.substring(0, 32))

    // The digest is not, so both can be provisioned.
    expect(await guestLabel(a)).not.toBe(await guestLabel(b))
  })

  test('the label is deterministic, or a lost race would provision twice', async () => {
    const hash = `${HS256_JWT_PREFIX}eyJzdWIiOiJjYXJvbCJ9.sig`
    expect(await guestLabel(hash)).toBe(await guestLabel(hash))
  })

  test('the label is safe in a username and an email local-part', async () => {
    for (const hash of [`${HS256_JWT_PREFIX}x.y`, 'plain-hash', 'guest-session:abc', '../../etc/passwd', 'a b c']) {
      const label = await guestLabel(hash)
      expect(label, hash).toMatch(/^[0-9a-f]{32}$/)
    }
  })

  test('the source derives from the whole hash, never a slice of it', () => {
    const source = readFileSync(resolve(process.cwd(), 'functions/api/_shared/auth-helpers.ts'), 'utf8')
    // The exact regression: a prefix of the hash used as a unique label.
    expect(source).not.toMatch(/const label = hash\.substring/)
    expect(source).toContain('const label = await guestLabel(hash)')
  })

  test('every AuthDbError names where it came from', () => {
    const source = readFileSync(resolve(process.cwd(), 'functions/api/_shared/auth-helpers.ts'), 'utf8')
    // A bare `new AuthDbError()` produced log lines that could not distinguish a
    // permanent collision from a transient D1 outage.
    expect(source).not.toMatch(/new AuthDbError\(\s*\)/)
    for (const site of ['select-retry', 'post-insert-select', 'insert-no-id-or-missing-after-collision']) {
      expect(source, site).toContain(`'${site}'`)
    }
  })
})
