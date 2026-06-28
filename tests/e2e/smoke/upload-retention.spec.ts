/**
 * Pure-Node smoke tests for the 90-day upload-retention predicate (E-6d).
 *
 * No browser, no HTTP server, no R2. Exercises isExpiredUpload directly:
 *  - a date older than the window (100 days) -> true
 *  - a recent date (10 days) -> false
 *  - the exact-90-day boundary -> false (we use strict `>`: an object exactly
 *    at the window is NOT yet expired)
 *  - invalid / empty / non-date input -> false (never delete what we can't date)
 *  - accepts Date, ISO string, and epoch-number forms equivalently
 */
import { test, expect } from '@playwright/test'
import { isExpiredUpload } from '../../../functions/api/cron/cleanup-uploads'

const MS_PER_DAY = 24 * 60 * 60 * 1000
// Fixed "now" so the tests are deterministic regardless of wall-clock.
const NOW = Date.UTC(2026, 5, 28, 12, 0, 0) // 2026-06-28T12:00:00Z

function daysAgo(days: number): number {
  return NOW - days * MS_PER_DAY
}

// ---- expired / not-expired core behavior -----------------------------------

test('@smoke isExpiredUpload true for a date 100 days old (past the 90d window)', () => {
  expect(isExpiredUpload(new Date(daysAgo(100)), NOW)).toBe(true)
})

test('@smoke isExpiredUpload false for a recent date (10 days old)', () => {
  expect(isExpiredUpload(new Date(daysAgo(10)), NOW)).toBe(false)
})

test('@smoke isExpiredUpload false for a date 89 days old (inside the window)', () => {
  expect(isExpiredUpload(new Date(daysAgo(89)), NOW)).toBe(false)
})

test('@smoke isExpiredUpload true for a date 91 days old (just past the window)', () => {
  expect(isExpiredUpload(new Date(daysAgo(91)), NOW)).toBe(true)
})

// ---- boundary: exactly 90 days (strict `>`) --------------------------------

test('@smoke isExpiredUpload boundary: exactly 90 days is NOT expired (strict >)', () => {
  // age === maxAgeDays exactly -> false; one ms older -> true
  expect(isExpiredUpload(new Date(daysAgo(90)), NOW)).toBe(false)
  expect(isExpiredUpload(new Date(daysAgo(90) - 1), NOW)).toBe(true)
})

// ---- defensive: invalid / empty input never deletes ------------------------

test('@smoke isExpiredUpload false for invalid / empty / null date', () => {
  expect(isExpiredUpload(new Date('not-a-date'), NOW)).toBe(false)
  expect(isExpiredUpload('', NOW)).toBe(false)
  expect(isExpiredUpload('   ', NOW)).toBe(false)
  expect(isExpiredUpload('garbage', NOW)).toBe(false)
  expect(isExpiredUpload(NaN, NOW)).toBe(false)
  // @ts-expect-error exercising null at runtime
  expect(isExpiredUpload(null, NOW)).toBe(false)
  // @ts-expect-error exercising undefined at runtime
  expect(isExpiredUpload(undefined, NOW)).toBe(false)
})

test('@smoke isExpiredUpload false when now itself is not finite', () => {
  expect(isExpiredUpload(new Date(daysAgo(100)), NaN)).toBe(false)
})

// ---- accepts Date, ISO string, and epoch number equivalently ----------------

test('@smoke isExpiredUpload accepts a Date, ISO string, and epoch number alike', () => {
  const oldMs = daysAgo(100)
  const recentMs = daysAgo(10)

  // Date form
  expect(isExpiredUpload(new Date(oldMs), NOW)).toBe(true)
  expect(isExpiredUpload(new Date(recentMs), NOW)).toBe(false)

  // ISO-string form
  expect(isExpiredUpload(new Date(oldMs).toISOString(), NOW)).toBe(true)
  expect(isExpiredUpload(new Date(recentMs).toISOString(), NOW)).toBe(false)

  // epoch-number form
  expect(isExpiredUpload(oldMs, NOW)).toBe(true)
  expect(isExpiredUpload(recentMs, NOW)).toBe(false)
})

// ---- custom maxAgeDays argument --------------------------------------------

test('@smoke isExpiredUpload honors a custom maxAgeDays', () => {
  const d = new Date(daysAgo(40))
  expect(isExpiredUpload(d, NOW, 30)).toBe(true)   // 40 > 30
  expect(isExpiredUpload(d, NOW, 90)).toBe(false)  // 40 < 90
})
