/**
 * Deception confidence-coverage smoke test (pure-Node, no browser, no HTTP server).
 *
 * Regression guard for the bug where confidence counted score *magnitude*
 * (criteria scored above zero) instead of *coverage* (criteria actually
 * assessed). Under the old logic a thorough, all-zero low-risk assessment
 * reported VERY_LOW confidence — exactly backwards. Confidence must reflect how
 * many criteria were provided, with a genuine 0 counting as assessed.
 *
 * Imports calculateDeceptionLikelihood + DECEPTION_CRITERIA_KEYS directly — no
 * `page` fixture, no running server.
 */
import { test, expect } from '@playwright/test'
import {
  calculateDeceptionLikelihood,
  DECEPTION_CRITERIA_KEYS,
  type DeceptionScores,
} from '../../../src/lib/deception-scoring'

const CORE_KEYS: (keyof DeceptionScores)[] = [
  'motive',
  'opportunity',
  'means',
  'historicalPattern',
  'sophisticationLevel',
  'successRate',
  'sourceVulnerability',
  'manipulationEvidence',
  'internalConsistency',
  'externalCorroboration',
  'anomalyDetection',
]

test.describe('Deception confidence is coverage-based, not magnitude-based @smoke', () => {
  test('@smoke all 11 core criteria assessed as 0 is HIGH, never VERY_LOW', async () => {
    // A thorough low-risk assessment: every core criterion deliberately scored 0.
    const scores: Partial<DeceptionScores> = {}
    for (const k of CORE_KEYS) scores[k] = 0

    const { confidenceLevel } = calculateDeceptionLikelihood(scores)
    // 11 assessed -> >= 10 -> HIGH. Under the old magnitude logic this was VERY_LOW.
    expect(confidenceLevel).toBe('HIGH')
    expect(confidenceLevel).not.toBe('VERY_LOW')
  })

  test('@smoke sparse assessment (2 criteria) is VERY_LOW', async () => {
    const scores: Partial<DeceptionScores> = { motive: 4, opportunity: 3 }
    expect(calculateDeceptionLikelihood(scores).confidenceLevel).toBe('VERY_LOW')
  })

  test('@smoke a provided 0 counts as assessed (4 zeros -> LOW)', async () => {
    const scores: Partial<DeceptionScores> = {
      motive: 0,
      opportunity: 0,
      means: 0,
      historicalPattern: 0,
    }
    // 4 assessed -> >= 4 -> LOW, proving a 0 value still counts as coverage.
    expect(calculateDeceptionLikelihood(scores).confidenceLevel).toBe('LOW')
  })

  test('@smoke all 16 criteria provided (mixed values incl. 0) is VERY_HIGH', async () => {
    const scores: Partial<DeceptionScores> = {}
    DECEPTION_CRITERIA_KEYS.forEach((k, i) => {
      scores[k] = i % 3 === 0 ? 0 : (i % 5) // mix of values, several zeros
    })
    expect(calculateDeceptionLikelihood(scores).confidenceLevel).toBe('VERY_HIGH')
  })

  test('@smoke DECEPTION_CRITERIA_KEYS covers all 16 criteria', async () => {
    expect(DECEPTION_CRITERIA_KEYS.length).toBe(16)
  })
})
