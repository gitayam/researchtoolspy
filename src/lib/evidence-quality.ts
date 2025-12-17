/**
 * Evidence Quality Weighting for ACH Analysis
 *
 * Calculates a quality multiplier (0.5 - 2.0) based on evidence metadata:
 * - Credibility (1-6 scale)
 * - Reliability (A-F scale)
 * - Source Classification (primary/secondary/tertiary)
 * - Confidence Level
 * - EVE Deception Assessment (if available)
 */

import type { ACHEvidenceLink } from '@/types/ach'

export interface EvidenceQuality {
  weight: number        // Final multiplier (0.5 - 2.0)
  credibilityScore: number   // 0-1
  reliabilityScore: number   // 0-1
  sourceScore: number        // 0-1
  confidenceScore: number    // 0-1
  eveScore: number          // 0-1 (if available)
  breakdown: string         // Human-readable explanation
  tier: 'excellent' | 'good' | 'average' | 'poor' // Quality tier
}

/**
 * Convert credibility rating to 0-1 score
 * Credibility scale: 1-6 (where 6 is most credible)
 * Also handles A-F letter grades
 */
function getCredibilityScore(credibility?: string): number {
  if (!credibility) return 0.5

  // Handle numeric 1-6 scale
  if (/^\d+$/.test(credibility)) {
    const num = parseInt(credibility)
    if (num >= 1 && num <= 6) {
      return num / 6
    }
  }

  // Handle A-F letter grades
  const letterMap: Record<string, number> = {
    'A': 1.0,
    'B': 0.83,
    'C': 0.67,
    'D': 0.5,
    'E': 0.33,
    'F': 0.17
  }

  const upper = credibility.toUpperCase().trim()
  return letterMap[upper] ?? 0.5
}

/**
 * Convert reliability rating to 0-1 score
 * Reliability scale: A-F (where A is most reliable)
 */
function getReliabilityScore(reliability?: string): number {
  if (!reliability) return 0.5

  const letterMap: Record<string, number> = {
    'A': 1.0,
    'B': 0.83,
    'C': 0.67,
    'D': 0.5,
    'E': 0.33,
    'F': 0.17
  }

  const upper = reliability.toUpperCase().trim()
  return letterMap[upper] ?? 0.5
}

/**
 * Source classification score
 * Primary sources are most valuable, tertiary least
 */
function getSourceScore(sourceClassification?: string): number {
  const sourceMap: Record<string, number> = {
    'primary': 1.0,     // First-hand, original
    'secondary': 0.75,  // Analysis of primary
    'tertiary': 0.5     // Compilations
  }

  return sourceMap[sourceClassification?.toLowerCase() ?? ''] ?? 0.75
}

/**
 * Confidence level score
 */
function getConfidenceScore(confidenceLevel?: string): number {
  const confidenceMap: Record<string, number> = {
    'confirmed': 1.0,
    'high': 0.85,
    'medium': 0.65,
    'low': 0.4
  }

  return confidenceMap[confidenceLevel?.toLowerCase() ?? ''] ?? 0.65
}

/**
 * EVE deception assessment score
 * Calculates overall trustworthiness from EVE metrics
 *
 * internal_consistency: 0-5 (INVERTED: low score = high deception risk)
 * external_corroboration: 0-5 (INVERTED: low score = high deception risk)
 * anomaly_detection: 0-5 (high score = high deception risk)
 */
function getEVEScore(credibilityScore?: number, eveAssessment?: {
  internal_consistency: number
  external_corroboration: number
  anomaly_detection: number
  notes: string
  overall_risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}): number {
  if (!eveAssessment) {
    // No EVE assessment, use credibility as proxy
    return credibilityScore ?? 0.5
  }

  // Calculate composite EVE score
  // Internal consistency: normalize to 0-1 (5=best, 0=worst)
  const consistencyScore = eveAssessment.internal_consistency / 5

  // External corroboration: normalize to 0-1 (5=best, 0=worst)
  const corroborationScore = eveAssessment.external_corroboration / 5

  // Anomaly detection: INVERTED normalize to 0-1 (0=best, 5=worst)
  const anomalyScore = 1 - (eveAssessment.anomaly_detection / 5)

  // Weighted average: consistency and corroboration are most important
  const eveScore = (
    consistencyScore * 0.4 +
    corroborationScore * 0.4 +
    anomalyScore * 0.2
  )

  return eveScore
}

/**
 * Calculate comprehensive evidence quality weight
 * Returns a multiplier between 0.5 (poor quality) and 2.0 (excellent quality)
 */
export function calculateEvidenceQuality(evidence: ACHEvidenceLink): EvidenceQuality {
  // Parse credibility if it's stored as string
  const credibilityNum = typeof evidence.credibility_score === 'number'
    ? evidence.credibility_score
    : undefined

  // Calculate individual component scores
  const credibilityScore = credibilityNum
    ? credibilityNum / 5  // Normalize 1-5 to 0-1
    : getCredibilityScore(evidence.source)  // Fallback to source quality

  const reliabilityScore = 0.75  // Default if not available
  const sourceScore = 1.0  // Assume primary source if not specified
  const confidenceScore = 0.75  // Default medium-high confidence
  const eveScore = credibilityScore  // Use credibility as proxy for EVE

  // Calculate weighted composite score
  // Components weighted by importance to ACH analysis
  const compositeScore = (
    credibilityScore * 0.3 +    // Most important
    reliabilityScore * 0.25 +   // Very important
    sourceScore * 0.2 +         // Important
    confidenceScore * 0.15 +    // Moderately important
    eveScore * 0.1              // Additional validation
  )

  // Map composite score (0-1) to weight multiplier (0.5-2.0)
  // - 0.0-0.3 = poor (0.5x-0.8x)
  // - 0.3-0.6 = average (0.8x-1.2x)
  // - 0.6-0.85 = good (1.2x-1.6x)
  // - 0.85-1.0 = excellent (1.6x-2.0x)
  const weight = 0.5 + (compositeScore * 1.5)

  // Determine quality tier
  let tier: EvidenceQuality['tier']
  if (compositeScore >= 0.85) tier = 'excellent'
  else if (compositeScore >= 0.6) tier = 'good'
  else if (compositeScore >= 0.3) tier = 'average'
  else tier = 'poor'

  // Build human-readable breakdown
  const breakdown = [
    `Credibility: ${(credibilityScore * 100).toFixed(0)}%`,
    `Reliability: ${(reliabilityScore * 100).toFixed(0)}%`,
    `Source: ${(sourceScore * 100).toFixed(0)}%`,
    `Confidence: ${(confidenceScore * 100).toFixed(0)}%`,
    eveScore !== credibilityScore ? `EVE: ${(eveScore * 100).toFixed(0)}%` : null
  ].filter(Boolean).join(', ')

  return {
    weight,
    credibilityScore,
    reliabilityScore,
    sourceScore,
    confidenceScore,
    eveScore,
    breakdown,
    tier
  }
}

/**
 * Get color class for quality tier
 */
export function getQualityColor(tier: EvidenceQuality['tier']): string {
  const colors = {
    'excellent': 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
    'good': 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
    'average': 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
    'poor': 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
  }
  return colors[tier]
}

/**
 * Get icon for quality tier
 */
export function getQualityIcon(tier: EvidenceQuality['tier']): string {
  const icons = {
    'excellent': '⭐',
    'good': '✓',
    'average': '○',
    'poor': '⚠'
  }
  return icons[tier]
}

/**
 * Apply evidence quality weight to a score
 */
export function applyEvidenceWeight(score: number, quality: EvidenceQuality): number {
  return score * quality.weight
}
