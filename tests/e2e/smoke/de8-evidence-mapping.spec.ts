/**
 * D-E8-1 evidence-mapping smoke test (pure-Node, no browser, no HTTP server).
 *
 * Proves the credibility-score -> Admiralty 1-6 conversion used when the ACH
 * content-intelligence writer repoints from the empty `evidence` table to the
 * canonical `evidence_items` table.
 *
 * Mapping (1 = most credible, 6 = least credible):
 *   round(6 - score*5), clamped to 1..6.
 *     1.0 -> '1'  (most credible)
 *     0.0 -> '6'  (least credible)
 *     0.5 -> '4'
 *   Out-of-range numbers clamp; non-number / non-finite -> undefined (omit/fallback).
 *
 * Imports the helper directly from the Pages Function — no `page` fixture,
 * no running server (mirrors ach-evidence-quality.spec.ts).
 */
import { test, expect } from '@playwright/test'
import { credibilityScoreToAdmiralty } from '../../../functions/api/ach/from-content-intelligence'

test.describe('D-E8-1 credibility-score -> Admiralty mapping @smoke', () => {
  test('@smoke 1.0 maps to the most-credible end (1)', () => {
    expect(credibilityScoreToAdmiralty(1.0)).toBe('1')
  })

  test('@smoke 0.0 maps to the least-credible end (6)', () => {
    expect(credibilityScoreToAdmiralty(0.0)).toBe('6')
  })

  test('@smoke mid-range values map sanely', () => {
    // round(6 - 0.5*5) = round(3.5) = 4
    expect(credibilityScoreToAdmiralty(0.5)).toBe('4')
    // round(6 - 0.8*5) = round(2) = 2
    expect(credibilityScoreToAdmiralty(0.8)).toBe('2')
    // round(6 - 0.2*5) = round(5) = 5
    expect(credibilityScoreToAdmiralty(0.2)).toBe('5')
  })

  test('@smoke the full mapping is monotonic and bounded to 1..6', () => {
    const samples = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1.0]
    const out = samples.map((s) => Number(credibilityScoreToAdmiralty(s)))
    // every value is a valid Admiralty band
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
    }
    // non-increasing as the score rises (higher score => more credible => lower number)
    for (let i = 1; i < out.length; i++) {
      expect(out[i]).toBeLessThanOrEqual(out[i - 1])
    }
  })

  test('@smoke out-of-range numbers clamp to the 1..6 bounds', () => {
    expect(credibilityScoreToAdmiralty(5)).toBe('1') // > 1 clamps to most credible
    expect(credibilityScoreToAdmiralty(-3)).toBe('6') // < 0 clamps to least credible
  })

  test('@smoke non-number / non-finite input returns undefined (omit/fallback)', () => {
    expect(credibilityScoreToAdmiralty(undefined)).toBeUndefined()
    expect(credibilityScoreToAdmiralty(null)).toBeUndefined()
    expect(credibilityScoreToAdmiralty('0.8')).toBeUndefined()
    expect(credibilityScoreToAdmiralty(NaN)).toBeUndefined()
    expect(credibilityScoreToAdmiralty(Infinity)).toBeUndefined()
    expect(credibilityScoreToAdmiralty(-Infinity)).toBeUndefined()
    expect(credibilityScoreToAdmiralty({})).toBeUndefined()
  })
})
