/**
 * ACH Diagnosticity Analysis
 *
 * Diagnosticity measures how well evidence differentiates between hypotheses.
 * High diagnosticity = evidence strongly supports one hypothesis while contradicting others
 * Low diagnosticity = evidence doesn't strongly favor any particular hypothesis
 */

import type { ACHScore, ACHHypothesis, ACHEvidenceLink } from '@/types/ach'

export interface DiagnosticityScore {
  evidenceId: string
  evidenceTitle: string
  score: number // 0-100
  reasoning: string
  range: number // Score range (max - min)
  topHypothesis: {
    id: string
    text: string
    score: number
  }
  otherHypotheses: Array<{
    id: string
    text: string
    score: number
  }>
  isDiagnostic: boolean // True if score > 50
}

export interface HypothesisLikelihood {
  hypothesisId: string
  hypothesis: string
  rawScore: number // secondary: net sum of all scores (support + contradiction)
  weightedScore: number // secondary: net sum (no quality weights in this module)
  inconsistencyScore: number // PRIMARY ranking metric: sum of negative (contradicting) scores only; <= 0
  rank: number
  isLeastContradicted: boolean
  supportingEvidence: number
  contradictingEvidence: number
  neutralEvidence: number
  likelihood: number // 0-100 normalized over inconsistency (least disconfirmed = highest)
}

/**
 * Calculate diagnosticity for a single piece of evidence
 * High diagnosticity means the evidence clearly differentiates between hypotheses
 */
export function calculateDiagnosticity(
  evidenceId: string,
  evidenceTitle: string,
  allScores: ACHScore[],
  hypotheses: ACHHypothesis[]
): DiagnosticityScore {
  // Get all scores for this evidence
  const evidenceScores = allScores.filter(s => s.evidence_id === evidenceId)

  if (evidenceScores.length === 0) {
    return {
      evidenceId,
      evidenceTitle,
      score: 0,
      reasoning: 'No scores entered for this evidence',
      range: 0,
      topHypothesis: { id: '', text: '', score: 0 },
      otherHypotheses: [],
      isDiagnostic: false
    }
  }

  // Find max and min scores
  const scores = evidenceScores.map(s => s.score)
  const maxScore = Math.max(...scores)
  const minScore = Math.min(...scores)
  const range = maxScore - minScore

  // Calculate diagnosticity (0-100 scale)
  // Range of 0-3 (linear scale) or 0-10 (log scale) maps to 0-100
  // Assuming logarithmic scale (-5 to +5), max range is 10
  const maxPossibleRange = 10
  const diagnosticity = Math.min(100, (range / maxPossibleRange) * 100)

  // Find top hypothesis and others
  const topScore = evidenceScores.find(s => s.score === maxScore)
  const topHyp = hypotheses.find(h => h.id === topScore?.hypothesis_id)

  const otherScores = evidenceScores
    .filter(s => s.hypothesis_id !== topScore?.hypothesis_id)
    .map(s => {
      const hyp = hypotheses.find(h => h.id === s.hypothesis_id)
      return {
        id: s.hypothesis_id,
        text: hyp?.text || 'Unknown',
        score: s.score
      }
    })
    .sort((a, b) => b.score - a.score)

  // Generate reasoning
  let reasoning: string
  if (diagnosticity >= 80) {
    reasoning = `Highly diagnostic (range: ${range.toFixed(1)}). This evidence strongly differentiates between hypotheses, making it very valuable for analysis.`
  } else if (diagnosticity >= 50) {
    reasoning = `Moderately diagnostic (range: ${range.toFixed(1)}). This evidence provides some differentiation between hypotheses.`
  } else if (diagnosticity >= 25) {
    reasoning = `Low diagnosticity (range: ${range.toFixed(1)}). This evidence doesn't strongly favor any particular hypothesis.`
  } else {
    reasoning = `Very low diagnosticity (range: ${range.toFixed(1)}). This evidence is nearly neutral across all hypotheses.`
  }

  return {
    evidenceId,
    evidenceTitle,
    score: diagnosticity,
    reasoning,
    range,
    topHypothesis: {
      id: topScore?.hypothesis_id || '',
      text: topHyp?.text || 'Unknown',
      score: maxScore
    },
    otherHypotheses: otherScores,
    isDiagnostic: diagnosticity > 50
  }
}

/**
 * Calculate diagnosticity for all evidence
 */
export function calculateAllDiagnosticity(
  evidence: ACHEvidenceLink[],
  allScores: ACHScore[],
  hypotheses: ACHHypothesis[]
): DiagnosticityScore[] {
  return evidence
    .map(ev => calculateDiagnosticity(ev.evidence_id, ev.evidence_title, allScores, hypotheses))
    .sort((a, b) => b.score - a.score) // Sort by diagnosticity descending
}

/**
 * Calculate hypothesis likelihood rankings.
 *
 * Heuer's ACH canon: a hypothesis is ranked by DISCONFIRMATION, not confirmation.
 * The most likely hypothesis is the one with the LEAST inconsistent (contradicting)
 * evidence — NOT the one with the most support. Supporting evidence does not
 * discriminate between hypotheses (many hypotheses can be consistent with the same
 * supporting evidence); only inconsistent evidence eliminates hypotheses.
 *
 * Primary ranking metric: `inconsistencyScore` = sum of negative (contradicting)
 * scores only (<= 0). Ranked DESCENDING so the value closest to zero (least
 * disconfirmed) ranks #1. Tie-broken by net `weightedScore` descending.
 * `rawScore`/`weightedScore` (net sums) are retained for SECONDARY display only.
 */
export function calculateHypothesisLikelihoods(
  hypotheses: ACHHypothesis[],
  allScores: ACHScore[],
  evidence: ACHEvidenceLink[]
): HypothesisLikelihood[] {
  const likelihoods: HypothesisLikelihood[] = hypotheses.map(hyp => {
    // Get all scores for this hypothesis
    const hypScores = allScores.filter(s => s.hypothesis_id === hyp.id)

    // Net raw score (sum of all scores) — secondary display only
    const rawScore = hypScores.reduce((sum, s) => sum + s.score, 0)

    // This module has no evidence-quality weights; weighted == raw here.
    // Kept as a separate field so consumers/exports remain stable.
    const weightedScore = rawScore

    // PRIMARY metric: weighted inconsistency = sum of negative (contradicting)
    // scores only. <= 0. Supporting/positive scores are EXCLUDED — they do not
    // discriminate between hypotheses in Heuer's method.
    const inconsistencyScore = hypScores
      .filter(s => s.score < 0)
      .reduce((sum, s) => sum + s.score, 0)

    // Count supporting, contradicting, neutral
    const supportingEvidence = hypScores.filter(s => s.score > 0).length
    const contradictingEvidence = hypScores.filter(s => s.score < 0).length
    const neutralEvidence = hypScores.filter(s => s.score === 0).length

    return {
      hypothesisId: hyp.id,
      hypothesis: hyp.text,
      rawScore,
      weightedScore,
      inconsistencyScore,
      rank: 0, // Set below
      isLeastContradicted: false, // Set below
      supportingEvidence,
      contradictingEvidence,
      neutralEvidence,
      likelihood: 0 // Set below
    }
  })

  // Sort by inconsistency DESCENDING (least-negative = least disconfirmed = most
  // likely). Tie-break by net weightedScore descending (secondary signal only).
  likelihoods.sort((a, b) => {
    if (b.inconsistencyScore !== a.inconsistencyScore) {
      return b.inconsistencyScore - a.inconsistencyScore
    }
    return b.weightedScore - a.weightedScore
  })

  // Assign ranks. rank 0 (index 0) is genuinely the least-contradicted hypothesis.
  likelihoods.forEach((l, index) => {
    l.rank = index + 1
    l.isLeastContradicted = index === 0
  })

  // Normalize likelihood to 0-100 over the INCONSISTENCY ordering (least disconfirmed
  // = highest), so the displayed bar reflects the disconfirmation ranking, not net support.
  const maxInconsistency = Math.max(...likelihoods.map(l => l.inconsistencyScore))
  const minInconsistency = Math.min(...likelihoods.map(l => l.inconsistencyScore))
  const inconsistencyRange = maxInconsistency - minInconsistency

  likelihoods.forEach(l => {
    if (inconsistencyRange === 0) {
      l.likelihood = 50 // All equally (dis)confirmed
    } else {
      // Least-negative (closest to maxInconsistency) → 100; most-negative → 0
      l.likelihood = ((l.inconsistencyScore - minInconsistency) / inconsistencyRange) * 100
    }
  })

  return likelihoods
}

/**
 * Get color for score (for heatmap)
 */
export function getScoreColor(score: number): string {
  if (score >= 3) return 'bg-green-500 text-white'      // Strong support
  if (score > 0) return 'bg-green-200 text-green-900'   // Weak support
  if (score === 0) return 'bg-gray-200 text-gray-700'   // Neutral
  if (score > -3) return 'bg-red-200 text-red-900'      // Weak contradiction
  return 'bg-red-500 text-white'                        // Strong contradiction
}

/**
 * Get diagnosticity badge color
 */
export function getDiagnosticityColor(score: number): string {
  if (score >= 80) return 'bg-green-500 text-white'
  if (score >= 50) return 'bg-blue-500 text-white'
  if (score >= 25) return 'bg-yellow-500 text-white'
  return 'bg-gray-500 text-white'
}

/**
 * Format score for display
 */
export function formatScore(score: number): string {
  if (score > 0) return `+${score.toFixed(1)}`
  return score.toFixed(1)
}
