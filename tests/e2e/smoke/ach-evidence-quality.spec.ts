/**
 * ACH evidence-quality scoring smoke test (pure-Node, no browser, no HTTP server).
 *
 * Proves calculateEvidenceQuality() weights evidence by its REAL reliability /
 * confidence_level / credibility values (the migration-002 columns), not by the
 * hardcoded constants and the wrong field (source-name parse) it used before.
 *
 * Like auth-resilience.spec.ts this imports the module directly and runs without
 * a `page` fixture or a running server.
 *
 * Exact per-component scores come straight from the getters:
 *   - getReliabilityScore: A->1.0, F->0.17, default 0.5
 *   - getConfidenceScore:  high->0.85, low->0.4, default 0.65
 *   - getCredibilityScore: numeric "1".."6" -> num/6, default 0.5
 *
 * Note on `weight`: the composite formula pins sourceScore at a neutral 1.0
 * (weight 0.2) because no source-classification column exists yet, so the weight
 * floor is ~1.05 for realistic low-quality evidence — a strict `< 1.0` is not
 * reachable. We therefore assert the high band (> 1.5) exactly, and assert that
 * low-quality weight is strictly below high-quality weight (quality now moves the
 * weight, which the old hardcoded scorer could not do).
 */
import { test, expect } from '@playwright/test'
import {
  calculateEvidenceQuality,
  getReliabilityScore,
  getConfidenceScore,
  getCredibilityScore,
} from '../../../src/lib/evidence-quality'
import type { ACHEvidenceLink } from '../../../src/types/ach'

test.describe('ACH evidence-quality real-inputs wiring @smoke', () => {
  test('@smoke high-quality evidence (A / high / 6) scores at the top of every band', () => {
    const q = calculateEvidenceQuality({
      reliability: 'A',
      confidence_level: 'high',
      credibility_score: '6',
      source: 'http://x',
    } as unknown as ACHEvidenceLink)

    expect(q.reliabilityScore).toBe(1.0)
    expect(q.confidenceScore).toBe(0.85)
    expect(q.credibilityScore).toBe(1.0) // 6/6
    expect(q.weight).toBeGreaterThan(1.5) // excellent band
  })

  test('@smoke low-quality evidence (F / low / 1) scores at the bottom of every band', () => {
    const q = calculateEvidenceQuality({
      reliability: 'F',
      confidence_level: 'low',
      credibility_score: '1',
    } as unknown as ACHEvidenceLink)

    expect(q.reliabilityScore).toBe(0.17)
    expect(q.confidenceScore).toBe(0.4)
    expect(q.credibilityScore).toBeCloseTo(1 / 6, 5) // ~0.167

    // Strictly below the high-quality weight: quality now moves the weight.
    const high = calculateEvidenceQuality({
      reliability: 'A',
      confidence_level: 'high',
      credibility_score: '6',
    } as unknown as ACHEvidenceLink)
    expect(q.weight).toBeLessThan(high.weight)
  })

  test('@smoke regression guard: credibility reads the credibility value, NOT the source string', () => {
    const q = calculateEvidenceQuality({
      credibility_score: '6',
      source: 'somesourcename', // a non-grade string the old code mis-parsed
    } as unknown as ACHEvidenceLink)

    // Old bug fell back to getCredibilityScore(evidence.source) and returned 0.5.
    // Fixed: credibility comes from the credibility value -> 6/6 = 1.0.
    expect(q.credibilityScore).toBe(1.0)
  })

  test('@smoke missing reliability/confidence fall back to getter defaults without throwing', () => {
    const q = calculateEvidenceQuality({
      credibility_score: '3',
    } as unknown as ACHEvidenceLink)

    expect(q.reliabilityScore).toBe(0.5) // default
    expect(q.confidenceScore).toBe(0.65) // default
    expect(q.credibilityScore).toBe(0.5) // 3/6
  })

  test('@smoke getters return the documented exact values', () => {
    expect(getReliabilityScore('A')).toBe(1.0)
    expect(getReliabilityScore('F')).toBe(0.17)
    expect(getReliabilityScore(undefined)).toBe(0.5)

    expect(getConfidenceScore('high')).toBe(0.85)
    expect(getConfidenceScore('low')).toBe(0.4)
    expect(getConfidenceScore(undefined)).toBe(0.65)

    expect(getCredibilityScore('6')).toBe(1.0)
    expect(getCredibilityScore('1')).toBeCloseTo(1 / 6, 5)
    expect(getCredibilityScore(undefined)).toBe(0.5)
  })
})
