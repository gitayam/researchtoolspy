/**
 * Enhanced ACH (Analysis of Competing Hypotheses) Scoring System
 * Supports both logarithmic (Fibonacci) and linear scoring scales
 */

export type ScaleType = 'logarithmic' | 'linear'

export interface ScoreOption {
  label: string
  value: number
  color: string
  description: string
}

// Logarithmic scale (Fibonacci sequence) - matches human perception
export const LOGARITHMIC_SCORES: ScoreOption[] = [
  { label: 'Strongly Supports', value: 13, color: 'text-green-800 bg-green-100 dark:text-green-100 dark:bg-green-800', description: 'Evidence strongly confirms hypothesis' },
  { label: 'Moderately Supports', value: 8, color: 'text-green-700 bg-green-50 dark:text-green-200 dark:bg-green-700', description: 'Evidence moderately confirms hypothesis' },
  { label: 'Slightly Supports', value: 5, color: 'text-green-600 bg-green-50 dark:text-green-200 dark:bg-green-600', description: 'Evidence slightly confirms hypothesis' },
  { label: 'Weakly Supports', value: 3, color: 'text-green-500 bg-green-50 dark:text-green-200 dark:bg-green-500', description: 'Evidence weakly confirms hypothesis' },
  { label: 'Very Weakly Supports', value: 1, color: 'text-green-400 bg-green-50 dark:text-green-200 dark:bg-green-400', description: 'Evidence very weakly confirms hypothesis' },
  { label: 'Neutral', value: 0, color: 'text-gray-600 bg-gray-100 dark:text-gray-200 dark:bg-gray-600', description: 'Evidence neither supports nor contradicts' },
  { label: 'Very Weakly Contradicts', value: -1, color: 'text-red-400 bg-red-50 dark:text-red-200 dark:bg-red-400', description: 'Evidence very weakly contradicts hypothesis' },
  { label: 'Weakly Contradicts', value: -3, color: 'text-red-500 bg-red-50 dark:text-red-200 dark:bg-red-500', description: 'Evidence weakly contradicts hypothesis' },
  { label: 'Slightly Contradicts', value: -5, color: 'text-red-600 bg-red-50 dark:text-red-200 dark:bg-red-600', description: 'Evidence slightly contradicts hypothesis' },
  { label: 'Moderately Contradicts', value: -8, color: 'text-red-700 bg-red-50 dark:text-red-200 dark:bg-red-700', description: 'Evidence moderately contradicts hypothesis' },
  { label: 'Strongly Contradicts', value: -13, color: 'text-red-800 bg-red-100 dark:text-red-100 dark:bg-red-800', description: 'Evidence strongly contradicts hypothesis' },
]

// Linear scale - for organizational requirements
export const LINEAR_SCORES: ScoreOption[] = [
  { label: 'Strongly Supports', value: 5, color: 'text-green-800 bg-green-100 dark:text-green-100 dark:bg-green-800', description: 'Evidence strongly confirms hypothesis' },
  { label: 'Moderately Supports', value: 4, color: 'text-green-700 bg-green-50 dark:text-green-200 dark:bg-green-700', description: 'Evidence moderately confirms hypothesis' },
  { label: 'Slightly Supports', value: 3, color: 'text-green-600 bg-green-50 dark:text-green-200 dark:bg-green-600', description: 'Evidence slightly confirms hypothesis' },
  { label: 'Weakly Supports', value: 2, color: 'text-green-500 bg-green-50 dark:text-green-200 dark:bg-green-500', description: 'Evidence weakly confirms hypothesis' },
  { label: 'Very Weakly Supports', value: 1, color: 'text-green-400 bg-green-50 dark:text-green-200 dark:bg-green-400', description: 'Evidence very weakly confirms hypothesis' },
  { label: 'Neutral', value: 0, color: 'text-gray-600 bg-gray-100 dark:text-gray-200 dark:bg-gray-600', description: 'Evidence neither supports nor contradicts' },
  { label: 'Very Weakly Contradicts', value: -1, color: 'text-red-400 bg-red-50 dark:text-red-200 dark:bg-red-400', description: 'Evidence very weakly contradicts hypothesis' },
  { label: 'Weakly Contradicts', value: -2, color: 'text-red-500 bg-red-50 dark:text-red-200 dark:bg-red-500', description: 'Evidence weakly contradicts hypothesis' },
  { label: 'Slightly Contradicts', value: -3, color: 'text-red-600 bg-red-50 dark:text-red-200 dark:bg-red-600', description: 'Evidence slightly contradicts hypothesis' },
  { label: 'Moderately Contradicts', value: -4, color: 'text-red-700 bg-red-50 dark:text-red-200 dark:bg-red-700', description: 'Evidence moderately contradicts hypothesis' },
  { label: 'Strongly Contradicts', value: -5, color: 'text-red-800 bg-red-100 dark:text-red-100 dark:bg-red-800', description: 'Evidence strongly contradicts hypothesis' },
]

export interface EvidenceWeight {
  credibility: number  // 1-5 scale
  relevance: number    // 1-5 scale
}

export interface ACHScore {
  hypothesisId: string
  evidenceId: string
  score: number
  weight: EvidenceWeight
  evidenceCredibility?: number // 1-13 from SATS evaluation
}

export interface HypothesisAnalysis {
  hypothesisId: string
  totalScore: number
  weightedScore: number
  supportingEvidence: number
  contradictingEvidence: number
  neutralEvidence: number
  diagnosticValue: number
  confidenceLevel: 'High' | 'Medium' | 'Low'
  rejectionThreshold: boolean
}

/**
 * Calculate weighted score for a hypothesis with evidence credibility integration
 */
export function calculateWeightedScore(
  scores: ACHScore[],
  scaleType: ScaleType = 'logarithmic'
): number {
  return scores.reduce((total, score) => {
    // Use SATS credibility if available, otherwise fall back to basic weight
    const cred = score.weight?.credibility || 3
    const rel = score.weight?.relevance || 3
    const evidenceQuality = score.evidenceCredibility 
      ? score.evidenceCredibility / 13 // Normalize SATS score (1-13) to 0-1
      : (cred * rel) / 25 // Fallback to basic weight
    
    // Apply diminishing returns for low-quality evidence supporting strong positions
    const qualityAdjustment = score.evidenceCredibility 
      ? calculateQualityAdjustment(score.score, score.evidenceCredibility, scaleType)
      : 1
    
    const adjustedScore = score.score * qualityAdjustment
    return total + (adjustedScore * evidenceQuality)
  }, 0)
}

/**
 * Calculate quality adjustment factor based on evidence credibility
 * High credibility evidence gets full weight, low credibility gets reduced weight
 */
function calculateQualityAdjustment(
  consistencyScore: number, 
  evidenceCredibility: number, 
  scaleType: ScaleType
): number {
  const maxScore = scaleType === 'logarithmic' ? 13 : 5
  const scoreIntensity = Math.abs(consistencyScore) / maxScore // 0-1
  const credibilityRatio = evidenceCredibility / 13 // 0-1
  
  // For strong consistency scores with low credibility, apply penalty
  // For weak consistency scores, credibility matters less
  if (scoreIntensity > 0.6 && credibilityRatio < 0.4) {
    // Strong claim with weak evidence - significant penalty
    return 0.3 + (credibilityRatio * 0.7)
  } else if (scoreIntensity > 0.4 && credibilityRatio < 0.6) {
    // Moderate claim with questionable evidence - moderate penalty
    return 0.5 + (credibilityRatio * 0.5)
  } else {
    // Normal adjustment based on credibility
    return 0.7 + (credibilityRatio * 0.3)
  }
}

/**
 * Calculate diagnostic value - how much this evidence discriminates between hypotheses
 */
export function calculateDiagnosticValue(
  evidenceScores: Map<string, number>
): number {
  const scores = Array.from(evidenceScores.values())
  if (scores.length < 2) return 0
  
  // Calculate variance in scores
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length
  
  // Higher variance = more diagnostic
  return Math.sqrt(variance)
}

/**
 * Determine if hypothesis should be rejected based on score threshold
 */
export function shouldRejectHypothesis(
  weightedScore: number,
  scaleType: ScaleType = 'logarithmic'
): boolean {
  const threshold = scaleType === 'logarithmic' ? -20 : -10
  return weightedScore < threshold
}

/**
 * Calculate confidence level based on evidence quantity and quality with SATS integration
 */
export function calculateConfidenceLevel(
  evidenceCount: number,
  averageWeight: number,
  scores?: ACHScore[]
): 'High' | 'Medium' | 'Low' {
  if (scores && scores.length > 0) {
    // Use SATS credibility scores if available
    const credibilityScores = scores
      .filter(s => s.evidenceCredibility !== undefined)
      .map(s => s.evidenceCredibility!)
    
    if (credibilityScores.length > 0) {
      const avgCredibility = credibilityScores.reduce((a, b) => a + b, 0) / credibilityScores.length
      const qualityScore = evidenceCount * (avgCredibility / 13) * 5 // Normalize to 0-5 scale
      
      // Higher thresholds for SATS-based evaluation
      if (qualityScore > 12 && avgCredibility >= 8) return 'High'
      if (qualityScore > 6 && avgCredibility >= 5) return 'Medium'
      return 'Low'
    }
  }
  
  // Fallback to basic weight calculation
  const qualityScore = evidenceCount * averageWeight
  if (qualityScore > 15) return 'High'
  if (qualityScore > 7) return 'Medium'
  return 'Low'
}

/**
 * Analyze all hypotheses and rank them
 */
export function analyzeHypotheses(
  hypotheses: Array<{ id: string; text: string }>,
  evidenceScores: Map<string, Map<string, ACHScore>>,
  scaleType: ScaleType = 'logarithmic'
): HypothesisAnalysis[] {
  return hypotheses.map(hypothesis => {
    const scores = Array.from(evidenceScores.values())
      .map(evidenceMap => evidenceMap.get(hypothesis.id))
      .filter((score): score is ACHScore => score !== undefined)
    
    const weightedScore = calculateWeightedScore(scores, scaleType)
    const totalScore = scores.reduce((sum, s) => sum + s.score, 0)
    
    const supportingEvidence = scores.filter(s => s.score > 0).length
    const contradictingEvidence = scores.filter(s => s.score < 0).length
    const neutralEvidence = scores.filter(s => s.score === 0).length
    
    const averageWeight = scores.length > 0
      ? scores.reduce((sum, s) => {
          const cred = s.weight?.credibility || 3
          const rel = s.weight?.relevance || 3
          return sum + (cred + rel) / 2
        }, 0) / scores.length
      : 0
    
    const diagnosticScores = new Map<string, number>()
    hypotheses.forEach(h => {
      const hScores = Array.from(evidenceScores.values())
        .map(em => em.get(h.id)?.score || 0)
      diagnosticScores.set(h.id, hScores.reduce((a, b) => a + b, 0))
    })
    
    return {
      hypothesisId: hypothesis.id,
      totalScore,
      weightedScore,
      supportingEvidence,
      contradictingEvidence,
      neutralEvidence,
      diagnosticValue: calculateDiagnosticValue(diagnosticScores),
      confidenceLevel: calculateConfidenceLevel(scores.length, averageWeight, scores),
      rejectionThreshold: shouldRejectHypothesis(weightedScore, scaleType)
    }
  }).sort((a, b) => b.weightedScore - a.weightedScore)
}

/**
 * Get score option by value
 */
export function getScoreOption(value: number, scaleType: ScaleType = 'logarithmic'): ScoreOption | undefined {
  const scores = scaleType === 'logarithmic' ? LOGARITHMIC_SCORES : LINEAR_SCORES
  return scores.find(s => s.value === value)
}

/**
 * Convert legacy score to new system
 */
export function convertLegacyScore(
  legacyScore: 'supports' | 'contradicts' | 'neutral' | 'not_applicable',
  scaleType: ScaleType = 'logarithmic'
): number {
  const mapping = {
    'supports': scaleType === 'logarithmic' ? 5 : 3,
    'contradicts': scaleType === 'logarithmic' ? -5 : -3,
    'neutral': 0,
    'not_applicable': 0
  }
  return mapping[legacyScore]
}

/**
 * Update ACH score with evidence credibility from SATS evaluation
 */
export function updateScoreWithCredibility(
  score: ACHScore,
  evidenceCredibility: number
): ACHScore {
  return {
    ...score,
    evidenceCredibility
  }
}

/**
 * Calculate effective evidence strength considering both consistency and credibility
 */
export function calculateEffectiveStrength(
  consistencyScore: number,
  evidenceCredibility: number,
  scaleType: ScaleType = 'logarithmic'
): {
  effectiveScore: number
  strengthDescription: string
  confidenceAdjustment: number
} {
  const maxScore = scaleType === 'logarithmic' ? 13 : 5
  const qualityAdjustment = calculateQualityAdjustment(consistencyScore, evidenceCredibility, scaleType)
  const effectiveScore = consistencyScore * qualityAdjustment
  
  let strengthDescription: string
  if (Math.abs(effectiveScore) > maxScore * 0.8) {
    strengthDescription = evidenceCredibility >= 8 ? 'Very Strong' : 'Claimed Strong (Low Credibility)'
  } else if (Math.abs(effectiveScore) > maxScore * 0.6) {
    strengthDescription = evidenceCredibility >= 6 ? 'Strong' : 'Claimed Strong (Moderate Credibility)'
  } else if (Math.abs(effectiveScore) > maxScore * 0.4) {
    strengthDescription = evidenceCredibility >= 4 ? 'Moderate' : 'Weak (Low Credibility)'
  } else {
    strengthDescription = 'Weak'
  }
  
  return {
    effectiveScore,
    strengthDescription,
    confidenceAdjustment: qualityAdjustment
  }
}