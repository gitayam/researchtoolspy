/**
 * Deception PDF bar-scale invariant (pure-Node, no browser, no HTTP server).
 *
 * The Deception/SATS PDF export draws each category bar as
 *   fillWidth = (categoryScore / max) * barWidth
 * and labels it `${categoryScore} / ${max}`. The category scores
 * (mom/pop/moses/eve) are 0–5 averages of their 0–5 criteria, so the bar's
 * `max` MUST be 5. A bug had `max` set to 15 (MOSES 10), drawing every bar at
 * ~1/3 (MOSES ~1/2) of its true value.
 *
 * The PDF component imports jsPDF and isn't unit-testable in pure Node, so we
 * test the scale invariant the fix depends on, via the pure scoring lib:
 * every categoryScore stays within [0, DECEPTION_CATEGORY_MAX]. This proves
 * max=5 is the correct denominator and max=15/10 would under-fill the bars.
 *
 * No `page` fixture, no running server — mirrors auth-resilience.spec.ts.
 */
import { test, expect } from '@playwright/test'
import {
  calculateDeceptionLikelihood,
  DECEPTION_CATEGORY_MAX,
  type DeceptionScores,
} from '../../../src/lib/deception-scoring'

const CATEGORY_KEYS = ['mom', 'pop', 'moses', 'eve'] as const

test.describe('Deception PDF bar scale: category scores fit a 0–5 bar @smoke', () => {
  test('@smoke DECEPTION_CATEGORY_MAX is 5', () => {
    expect(DECEPTION_CATEGORY_MAX).toBe(5)
  })

  test('@smoke all-max (5) criteria keep every category score within [0, MAX]', () => {
    const maxed: DeceptionScores = {
      motive: 5,
      opportunity: 5,
      means: 5,
      historicalPattern: 5,
      sophisticationLevel: 5,
      successRate: 5,
      sourceVulnerability: 5,
      manipulationEvidence: 5,
      internalConsistency: 5,
      externalCorroboration: 5,
      anomalyDetection: 5,
      rageLoadedLanguage: 5,
      rageAbsolutist: 5,
      rageThreatPanic: 5,
      rageUsVsThem: 5,
      rageEngagementBait: 5,
    }
    const { categoryScores } = calculateDeceptionLikelihood(maxed)
    for (const key of CATEGORY_KEYS) {
      expect(categoryScores[key]).toBeGreaterThanOrEqual(0)
      expect(categoryScores[key]).toBeLessThanOrEqual(DECEPTION_CATEGORY_MAX)
    }
  })

  test('@smoke all-zero criteria keep every category score within [0, MAX] (EVE inverts)', () => {
    // All inputs 0 → EVE = ((5-0)+(5-0)+0)/3 ≈ 3.33, still ≤ 5.
    const { categoryScores } = calculateDeceptionLikelihood({})
    for (const key of CATEGORY_KEYS) {
      expect(categoryScores[key]).toBeGreaterThanOrEqual(0)
      expect(categoryScores[key]).toBeLessThanOrEqual(DECEPTION_CATEGORY_MAX)
    }
  })

  test('@smoke a mixed realistic assessment keeps every category score within [0, MAX]', () => {
    const mixed: Partial<DeceptionScores> = {
      motive: 4,
      opportunity: 3,
      means: 2,
      historicalPattern: 3,
      sophisticationLevel: 4,
      successRate: 2,
      sourceVulnerability: 5,
      manipulationEvidence: 1,
      internalConsistency: 2,
      externalCorroboration: 3,
      anomalyDetection: 4,
      rageLoadedLanguage: 1,
      rageAbsolutist: 0,
      rageThreatPanic: 2,
    }
    const { categoryScores } = calculateDeceptionLikelihood(mixed)
    for (const key of CATEGORY_KEYS) {
      expect(categoryScores[key]).toBeGreaterThanOrEqual(0)
      expect(categoryScores[key]).toBeLessThanOrEqual(DECEPTION_CATEGORY_MAX)
    }
  })
})
