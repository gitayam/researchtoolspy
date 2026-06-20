/**
 * COG vulnerability scoring smoke test (pure-Node, no browser, no HTTP server).
 *
 * Regression guards for the crash where a CriticalVulnerability without a
 * `scoring` object (custom-scored vulns, or AI-generated vulns) blew up the
 * whole COG view/matrix/export. Proves:
 *
 *   - calculateVulnerabilityCompositeScore tolerates a missing `scoring`
 *     object (returns 0, never throws).
 *   - calculateVulnerabilityCompositeScore sums a full scoring object correctly.
 *   - aiVulnScoring maps AI feasibility/impact onto the three Eikmeier
 *     dimensions with a neutral follow-up default and clamps to the 1-5 range.
 *   - An aiVulnScoring result feeds the composite calc to a finite number.
 *
 * Imports the pure helpers from src/types/cog-analysis.ts — no `page` fixture,
 * no running server. Mocks are cast with `as unknown as CriticalVulnerability`
 * where the partial vuln does not structurally match the full type.
 */
import { test, expect } from '@playwright/test'
import {
  calculateVulnerabilityCompositeScore,
  aiVulnScoring,
} from '../../../src/types/cog-analysis'
import type { CriticalVulnerability } from '../../../src/types/cog-analysis'

const baseVuln = {
  id: 'v1',
  requirement_id: 'r1',
  vulnerability: 'Single point of failure',
  vulnerability_type: 'logistical',
  description: '',
  composite_score: 0,
  linked_evidence: [],
} as unknown as CriticalVulnerability

test.describe('COG vulnerability scoring guards @smoke', () => {
  test('@smoke composite score returns 0 (does not throw) when scoring is absent', () => {
    const vuln = { ...baseVuln, scoring: undefined } as unknown as CriticalVulnerability
    let result: number | undefined
    expect(() => {
      result = calculateVulnerabilityCompositeScore(vuln)
    }).not.toThrow()
    expect(result).toBe(0)
  })

  test('@smoke composite score sums a full scoring object', () => {
    const vuln = {
      ...baseVuln,
      scoring: { impact_on_cog: 5, attainability: 3, follow_up_potential: 4 },
    } as unknown as CriticalVulnerability
    // calculateCompositeScore = impact + attainability + follow_up = 5 + 3 + 4
    expect(calculateVulnerabilityCompositeScore(vuln)).toBe(12)
  })

  test('@smoke aiVulnScoring maps impact/feasibility and defaults follow-up to 3', () => {
    expect(aiVulnScoring({ impact: 5, feasibility: 2 })).toEqual({
      impact_on_cog: 5,
      attainability: 2,
      follow_up_potential: 3,
    })
  })

  test('@smoke aiVulnScoring clamps out-of-range AI values into 1-5', () => {
    // impact 9 -> clamp to 5; feasibility 0 -> clamp to 1
    expect(aiVulnScoring({ impact: 9, feasibility: 0 })).toEqual({
      impact_on_cog: 5,
      attainability: 1,
      follow_up_potential: 3,
    })
  })

  test('@smoke aiVulnScoring defaults to neutral 3s on empty input and yields a finite composite', () => {
    const scoring = aiVulnScoring({})
    expect(scoring).toEqual({
      impact_on_cog: 3,
      attainability: 3,
      follow_up_potential: 3,
    })
    const composite = calculateVulnerabilityCompositeScore({ scoring } as unknown as CriticalVulnerability)
    expect(Number.isFinite(composite)).toBe(true)
    expect(composite).toBe(9)
  })
})
