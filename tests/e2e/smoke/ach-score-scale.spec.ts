/**
 * ACH scoring scale smoke test (pure-Node, no browser, no HTTP server).
 *
 * Guards that the dead-code cleanup of `src/lib/ach-scoring.ts` kept the
 * still-used scale constants intact. The dead net-sum scoring engine that
 * once lived in that file was removed (its ranking lived in
 * `ach-diagnosticity.ts`); these constants are the only surviving exports
 * besides `ScoreOption` and are imported by `components/ach/ACHMatrix.tsx`.
 *
 * No `page` fixture, no running server — this just imports the typed exports
 * and asserts their shape and endpoints.
 */
import { test, expect } from '@playwright/test'
import { LOGARITHMIC_SCORES, LINEAR_SCORES } from '../../../src/lib/ach-scoring'

test.describe('ACH scoring scale constants @smoke', () => {
  test('@smoke LOGARITHMIC_SCORES spans +13..-13 through neutral', () => {
    expect(LOGARITHMIC_SCORES).toHaveLength(11)
    expect(LOGARITHMIC_SCORES.some((o) => o.value === 13)).toBe(true)
    expect(LOGARITHMIC_SCORES.some((o) => o.value === -13)).toBe(true)
    expect(LOGARITHMIC_SCORES.some((o) => o.value === 0)).toBe(true)
  })

  test('@smoke LINEAR_SCORES spans +5..-5 through neutral', () => {
    expect(LINEAR_SCORES).toHaveLength(11)
    expect(LINEAR_SCORES.some((o) => o.value === 5)).toBe(true)
    expect(LINEAR_SCORES.some((o) => o.value === -5)).toBe(true)
    expect(LINEAR_SCORES.some((o) => o.value === 0)).toBe(true)
  })

  test('@smoke every score option has the expected shape', () => {
    for (const option of [...LOGARITHMIC_SCORES, ...LINEAR_SCORES]) {
      expect(typeof option.label).toBe('string')
      expect(typeof option.value).toBe('number')
      expect(typeof option.color).toBe('string')
      expect(typeof option.description).toBe('string')
    }
  })
})
