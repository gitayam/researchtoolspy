/**
 * ACH disconfirmation-ranking smoke test (pure-Node, no browser, no HTTP server).
 *
 * Pins Heuer's ACH canon: the most likely hypothesis is ranked by DISCONFIRMATION
 * (least inconsistent / contradicting evidence), NOT by net support. Supporting
 * evidence must not boost the rank — only inconsistent evidence discriminates.
 *
 * The scenario below is deliberately constructed so net-sum ranking and
 * disconfirmation ranking DISAGREE on the winner:
 *
 *   H_A: strongly supported but contradicted   → scores +13, +13, -8
 *        net = +18 (would "win" under the OLD buggy net-sum ranking)
 *        inconsistency = -8
 *   H_B: weakly supported, NO contradictions    → scores +1, 0, 0
 *        net = +1, inconsistency = 0 (least disconfirmed → Heuer winner)
 *   H_C: more contradicted than H_A             → scores +5, -2, -10
 *        net = -7, inconsistency = -12 (most disconfirmed → ranks last)
 *
 * Heuer canon ⇒ H_B ranks #1 (inconsistency 0), then H_A (-8), then H_C (-12).
 *
 * Imports the lib directly and mocks the minimal ACH shapes — no `page` fixture,
 * no running server. Minimal mocks are cast with `as unknown as` / `as any` so
 * `npm run type-check` passes despite not structurally matching the full types.
 */
import { test, expect } from '@playwright/test'
import { calculateHypothesisLikelihoods } from '../../../src/lib/ach-diagnosticity'
import type { ACHScore, ACHHypothesis, ACHEvidenceLink } from '../../../src/types/ach'

/** Build a minimal ACHHypothesis. */
function hyp(id: string, text: string): ACHHypothesis {
  return { id, text, ach_analysis_id: 'a1', order_num: 0, created_at: '' } as unknown as ACHHypothesis
}

/** Build a minimal ACHScore (only hypothesis_id, evidence_id, score matter here). */
function scr(hypothesisId: string, evidenceId: string, score: number): ACHScore {
  return {
    hypothesis_id: hypothesisId,
    evidence_id: evidenceId,
    score,
  } as unknown as ACHScore
}

/** Build a minimal ACHEvidenceLink. */
function ev(evidenceId: string): ACHEvidenceLink {
  return { evidence_id: evidenceId, evidence_title: evidenceId } as unknown as ACHEvidenceLink
}

test.describe('ACH disconfirmation ranking (Heuer canon) @smoke', () => {
  test('@smoke least-disconfirmed hypothesis ranks #1 even when net support disagrees', () => {
    const hypotheses = [hyp('H_A', 'Strongly supported but contradicted'), hyp('H_B', 'Weakly supported, no contradictions')]
    const evidence = [ev('E1'), ev('E2'), ev('E3')]

    const scores: ACHScore[] = [
      // H_A: net +18, inconsistency -8
      scr('H_A', 'E1', 13),
      scr('H_A', 'E2', 13),
      scr('H_A', 'E3', -8),
      // H_B: net +1, inconsistency 0
      scr('H_B', 'E1', 1),
      scr('H_B', 'E2', 0),
      scr('H_B', 'E3', 0),
    ]

    const result = calculateHypothesisLikelihoods(hypotheses, scores, evidence)

    // Sanity: the metrics are computed as expected.
    const a = result.find(r => r.hypothesisId === 'H_A')!
    const b = result.find(r => r.hypothesisId === 'H_B')!
    expect(a.rawScore).toBe(18) // net support, secondary
    expect(a.inconsistencyScore).toBe(-8)
    expect(b.rawScore).toBe(1)
    expect(b.inconsistencyScore).toBe(0)

    // OLD buggy net-sum ranking would put H_A first (net +18 > +1).
    // Heuer ranking → H_B first (inconsistency 0 > -8).
    expect(result[0].hypothesisId).toBe('H_B')
    expect(result[0].rank).toBe(1)
    expect(b.isLeastContradicted).toBe(true)
    expect(a.isLeastContradicted).toBe(false)

    // H_A must rank strictly below H_B.
    expect(b.rank).toBeLessThan(a.rank)
  })

  test('@smoke a more-contradicted hypothesis ranks below a less-contradicted one', () => {
    const hypotheses = [
      hyp('H_A', 'Strongly supported but contradicted'),
      hyp('H_B', 'Weakly supported, no contradictions'),
      hyp('H_C', 'Heavily contradicted'),
    ]
    const evidence = [ev('E1'), ev('E2'), ev('E3')]

    const scores: ACHScore[] = [
      // H_A: inconsistency -8
      scr('H_A', 'E1', 13),
      scr('H_A', 'E2', 13),
      scr('H_A', 'E3', -8),
      // H_B: inconsistency 0
      scr('H_B', 'E1', 1),
      scr('H_B', 'E2', 0),
      scr('H_B', 'E3', 0),
      // H_C: inconsistency -12 (most disconfirmed)
      scr('H_C', 'E1', 5),
      scr('H_C', 'E2', -2),
      scr('H_C', 'E3', -10),
    ]

    const result = calculateHypothesisLikelihoods(hypotheses, scores, evidence)

    // Full order must be by inconsistency descending: H_B (0) > H_A (-8) > H_C (-12).
    expect(result.map(r => r.hypothesisId)).toEqual(['H_B', 'H_A', 'H_C'])

    const a = result.find(r => r.hypothesisId === 'H_A')!
    const c = result.find(r => r.hypothesisId === 'H_C')!
    expect(c.inconsistencyScore).toBe(-12)
    // More negative inconsistency ⇒ worse rank.
    expect(c.inconsistencyScore).toBeLessThan(a.inconsistencyScore)
    expect(c.rank).toBeGreaterThan(a.rank)

    // Likelihood must track the disconfirmation ordering, not net support.
    // H_C has the highest net? No — but it must have the lowest likelihood (most disconfirmed).
    expect(result[0].likelihood).toBeGreaterThan(result[result.length - 1].likelihood)
    expect(result[result.length - 1].hypothesisId).toBe('H_C')
  })
})
