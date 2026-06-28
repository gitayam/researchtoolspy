/**
 * Pure-Node smoke tests for the gated file-upload backend helpers (E-6a).
 *
 * No browser, no HTTP server, no R2. Exercises:
 *  - validateUpload: MIME allowlist + size cap (accepts pdf/png/jpeg under cap,
 *    rejects oversize and disallowed types).
 *  - uploadObjectKey + sanitizeFilename: path-traversal / slash stripping, length
 *    cap, surveyId namespacing.
 *  - verifyTurnstile: success/failure via a mock fetch, and the fail-closed paths
 *    (missing token / missing secret → false with NO fetch call; fetch throws → false).
 */
import { test, expect } from '@playwright/test'
import {
  validateUpload,
  uploadObjectKey,
  sanitizeFilename,
  isAllowedUploadMime,
  shouldExtractPdf,
  truncateText,
  MAX_UPLOAD_BYTES,
  MAX_FILES_PER_SUBMISSION,
  MAX_FILENAME_LENGTH,
  MAX_PDF_EXTRACT_BYTES,
  DEFAULT_EXTRACT_TEXT_MAX,
  ALLOWED_UPLOAD_MIME,
} from '../../../functions/api/surveys/public/[token]/_upload'
import { verifyTurnstile } from '../../../functions/api/_shared/_turnstile'

const MB = 1024 * 1024

// ---- validateUpload ---------------------------------------------------------

test('@smoke validateUpload accepts a 1MB pdf', () => {
  expect(validateUpload({ mime: 'application/pdf', size: 1 * MB }).ok).toBe(true)
})

test('@smoke validateUpload accepts a 1MB png and jpeg', () => {
  expect(validateUpload({ mime: 'image/png', size: 1 * MB }).ok).toBe(true)
  expect(validateUpload({ mime: 'image/jpeg', size: 1 * MB }).ok).toBe(true)
})

test('@smoke validateUpload accepts webp and gif (full allowlist)', () => {
  for (const mime of ALLOWED_UPLOAD_MIME) {
    expect(validateUpload({ mime, size: 1 * MB }).ok, `expected ${mime} accepted`).toBe(true)
  }
})

test('@smoke validateUpload rejects an 11MB file (size cap)', () => {
  const r = validateUpload({ mime: 'application/pdf', size: 11 * MB })
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.error.toLowerCase()).toContain('large')
})

test('@smoke validateUpload boundary: exactly MAX_UPLOAD_BYTES ok, +1 rejected', () => {
  expect(validateUpload({ mime: 'image/png', size: MAX_UPLOAD_BYTES }).ok).toBe(true)
  expect(validateUpload({ mime: 'image/png', size: MAX_UPLOAD_BYTES + 1 }).ok).toBe(false)
})

test('@smoke validateUpload rejects disallowed mime types', () => {
  for (const mime of ['text/html', 'application/zip', 'image/svg+xml', 'application/octet-stream']) {
    const r = validateUpload({ mime, size: 1 * MB })
    expect(r.ok, `expected ${mime} rejected`).toBe(false)
  }
})

test('@smoke validateUpload rejects empty and invalid sizes', () => {
  expect(validateUpload({ mime: 'application/pdf', size: 0 }).ok).toBe(false)
  expect(validateUpload({ mime: 'application/pdf', size: -1 }).ok).toBe(false)
  expect(validateUpload({ mime: 'application/pdf', size: NaN }).ok).toBe(false)
  expect(validateUpload({ mime: 'application/pdf', size: 'big' }).ok).toBe(false)
})

test('@smoke isAllowedUploadMime is case-insensitive and rejects non-strings', () => {
  expect(isAllowedUploadMime('APPLICATION/PDF')).toBe(true)
  expect(isAllowedUploadMime('image/PNG')).toBe(true)
  expect(isAllowedUploadMime('image/svg+xml')).toBe(false)
  expect(isAllowedUploadMime(undefined)).toBe(false)
  expect(isAllowedUploadMime(null)).toBe(false)
  expect(isAllowedUploadMime(123)).toBe(false)
})

// ---- sanitizeFilename -------------------------------------------------------

test('@smoke sanitizeFilename strips path traversal and separators', () => {
  expect(sanitizeFilename('../../etc/passwd')).not.toContain('..')
  expect(sanitizeFilename('../../etc/passwd')).not.toContain('/')
  expect(sanitizeFilename('../../etc/passwd')).toBe('passwd')
  expect(sanitizeFilename('a/b/c/report.pdf')).toBe('report.pdf')
  expect(sanitizeFilename('C:\\Windows\\evil.png')).toBe('evil.png')
})

test('@smoke sanitizeFilename never yields a separator or dot-dot', () => {
  for (const bad of ['../../x', 'a\\b', 'foo/../bar', '....//....//x']) {
    const out = sanitizeFilename(bad)
    expect(out.includes('/'), bad).toBe(false)
    expect(out.includes('\\'), bad).toBe(false)
    expect(out.includes('..'), bad).toBe(false)
  }
})

test('@smoke sanitizeFilename caps length (preserving short extension)', () => {
  const long = 'a'.repeat(500) + '.pdf'
  const out = sanitizeFilename(long)
  expect(out.length).toBeLessThanOrEqual(MAX_FILENAME_LENGTH)
  expect(out.endsWith('.pdf')).toBe(true)
})

test('@smoke sanitizeFilename falls back to "file" for empty / non-string input', () => {
  expect(sanitizeFilename('')).toBe('file')
  expect(sanitizeFilename('...')).toBe('file')
  expect(sanitizeFilename('///')).toBe('file')
  expect(sanitizeFilename(undefined)).toBe('file')
  expect(sanitizeFilename(null)).toBe('file')
  expect(sanitizeFilename(42)).toBe('file')
})

// ---- uploadObjectKey --------------------------------------------------------

test('@smoke uploadObjectKey is namespaced by surveyId under uploads/', () => {
  const key = uploadObjectKey('tok-abc', 'sub-survey-123', 'photo.png')
  expect(key.startsWith('uploads/sub-survey-123/')).toBe(true)
  expect(key.endsWith('-photo.png')).toBe(true)
})

test('@smoke uploadObjectKey sanitizes a malicious filename into the key', () => {
  const key = uploadObjectKey('tok', 'survey1', '../../etc/passwd')
  expect(key).toBe('uploads/survey1/' + key.split('/').pop())
  expect(key.includes('..')).toBe(false)
  // exactly 3 segments: uploads / survey / <random>-<name>
  expect(key.split('/').length).toBe(3)
  expect(key.endsWith('-passwd')).toBe(true)
})

test('@smoke uploadObjectKey produces unique keys for the same inputs', () => {
  const a = uploadObjectKey('tok', 'survey1', 'doc.pdf')
  const b = uploadObjectKey('tok', 'survey1', 'doc.pdf')
  expect(a).not.toBe(b)
})

test('@smoke MAX_FILES_PER_SUBMISSION is the conservative cap (5)', () => {
  expect(MAX_FILES_PER_SUBMISSION).toBe(5)
})

// ---- shouldExtractPdf (E-6b) -----------------------------------------------

test('@smoke shouldExtractPdf true for a 1MB application/pdf', () => {
  expect(shouldExtractPdf('application/pdf', 1 * MB)).toBe(true)
})

test('@smoke shouldExtractPdf is case-insensitive on mime', () => {
  expect(shouldExtractPdf('APPLICATION/PDF', 1 * MB)).toBe(true)
  expect(shouldExtractPdf('  application/pdf ', 1 * MB)).toBe(true)
})

test('@smoke shouldExtractPdf false for non-pdf types', () => {
  expect(shouldExtractPdf('image/png', 1 * MB)).toBe(false)
  expect(shouldExtractPdf('text/plain', 1 * MB)).toBe(false)
})

test('@smoke shouldExtractPdf false for a pdf over the size guard', () => {
  expect(shouldExtractPdf('application/pdf', MAX_PDF_EXTRACT_BYTES + 1)).toBe(false)
  expect(shouldExtractPdf('application/pdf', 20 * MB)).toBe(false)
  // boundary: exactly at the guard is still allowed
  expect(shouldExtractPdf('application/pdf', MAX_PDF_EXTRACT_BYTES)).toBe(true)
})

test('@smoke shouldExtractPdf false for empty / invalid size or mime', () => {
  expect(shouldExtractPdf('application/pdf', 0)).toBe(false)
  expect(shouldExtractPdf('application/pdf', -1)).toBe(false)
  expect(shouldExtractPdf('application/pdf', NaN)).toBe(false)
  // @ts-expect-error exercising a non-string mime at runtime
  expect(shouldExtractPdf(undefined, 1 * MB)).toBe(false)
  // @ts-expect-error exercising a non-string mime at runtime
  expect(shouldExtractPdf(null, 1 * MB)).toBe(false)
})

// ---- truncateText (E-6b) ----------------------------------------------------

test('@smoke truncateText returns "" for falsy / non-string input', () => {
  expect(truncateText('')).toBe('')
  // @ts-expect-error exercising undefined at runtime
  expect(truncateText(undefined)).toBe('')
  // @ts-expect-error exercising null at runtime
  expect(truncateText(null)).toBe('')
})

test('@smoke truncateText leaves a short string unchanged', () => {
  expect(truncateText('hello world')).toBe('hello world')
  const exact = 'a'.repeat(DEFAULT_EXTRACT_TEXT_MAX)
  expect(truncateText(exact)).toBe(exact)
})

test('@smoke truncateText truncates a long string to <= max', () => {
  const long = 'word '.repeat(5000) // ~25k chars
  const out = truncateText(long, 100)
  expect(out.length).toBeLessThanOrEqual(100)
  expect(out.length).toBeGreaterThan(0)
})

test('@smoke truncateText cuts on a word boundary when close to the cap', () => {
  const text = 'aaaa bbbb cccc dddd eeee ffff'
  const out = truncateText(text, 22) // boundary near the cap
  expect(out.length).toBeLessThanOrEqual(22)
  expect(out.endsWith(' ')).toBe(false)
  // should not chop mid-word: the result is a prefix ending at a full word
  expect(text.startsWith(out)).toBe(true)
})

// ---- verifyTurnstile --------------------------------------------------------

function mockFetch(success: boolean): typeof fetch {
  return (async () => ({
    ok: true,
    json: async () => ({ success }),
  })) as unknown as typeof fetch
}

test('@smoke verifyTurnstile returns true when siteverify says success', async () => {
  const ok = await verifyTurnstile('a-token', 'a-secret', mockFetch(true))
  expect(ok).toBe(true)
})

test('@smoke verifyTurnstile returns false when siteverify says failure', async () => {
  const ok = await verifyTurnstile('a-token', 'a-secret', mockFetch(false))
  expect(ok).toBe(false)
})

test('@smoke verifyTurnstile fails closed on missing token (no fetch call)', async () => {
  let called = false
  const spy = (async () => { called = true; return { ok: true, json: async () => ({ success: true }) } }) as unknown as typeof fetch
  expect(await verifyTurnstile('', 'a-secret', spy)).toBe(false)
  expect(await verifyTurnstile(undefined, 'a-secret', spy)).toBe(false)
  expect(await verifyTurnstile(null, 'a-secret', spy)).toBe(false)
  expect(called).toBe(false)
})

test('@smoke verifyTurnstile fails closed on missing secret (no fetch call)', async () => {
  let called = false
  const spy = (async () => { called = true; return { ok: true, json: async () => ({ success: true }) } }) as unknown as typeof fetch
  expect(await verifyTurnstile('a-token', '', spy)).toBe(false)
  expect(await verifyTurnstile('a-token', undefined, spy)).toBe(false)
  expect(called).toBe(false)
})

test('@smoke verifyTurnstile fails closed when fetch throws', async () => {
  const throwing = (async () => { throw new Error('network down') }) as unknown as typeof fetch
  expect(await verifyTurnstile('a-token', 'a-secret', throwing)).toBe(false)
})

test('@smoke verifyTurnstile fails closed on a non-ok HTTP response', async () => {
  const non200 = (async () => ({ ok: false, json: async () => ({ success: true }) })) as unknown as typeof fetch
  expect(await verifyTurnstile('a-token', 'a-secret', non200)).toBe(false)
})
