/**
 * Deception Detection Scoring Engine
 * Based on CIA SATS Methodology (Richards J. Heuer Jr.)
 * Calculates deception likelihood using MOM-POP-MOSES-EVE framework
 */

export interface DeceptionScores {
  // MOM (Motive, Opportunity, Means) - 0-5 each
  motive: number          // Does adversary benefit from deceiving?
  opportunity: number     // Can they access/manipulate our sources?
  means: number          // Do they have deception capabilities?

  // POP (Patterns of Practice) - 0-5 each
  historicalPattern: number    // Past deception frequency
  sophisticationLevel: number  // Complexity of past deceptions
  successRate: number         // How often succeeded before?

  // MOSES (My Own Sources) - 0-5 each
  sourceVulnerability: number  // How vulnerable are our sources?
  manipulationEvidence: number // Signs of manipulation?

  // EVE (Evaluation of Evidence) - 0-5 each
  internalConsistency: number  // Evidence consistent with itself?
  externalCorroboration: number // Other sources confirm?
  anomalyDetection: number     // Unusual patterns/red flags?

  // RageCheck Integration
  rageLoadedLanguage?: number   // Emotional/inflammatory words
  rageAbsolutist?: number       // Certainty/black-and-white language
  rageThreatPanic?: number      // Fear-mongering framing
  rageUsVsThem?: number         // Divisive in-group/out-group language
  rageEngagementBait?: number   // Clickbait/viral patterns
}

export interface DeceptionAssessment {
  scores: DeceptionScores
  overallLikelihood: number    // 0-100% deception probability
  confidenceLevel: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'VERY_LOW'
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL'
  categoryScores: {
    mom: number       // MOM average (0-5)
    pop: number       // POP average (0-5)
    moses: number     // MOSES average (0-5)
    eve: number       // EVE average (0-5)
    rage: number      // RageCheck average (0-5)
  }
  breakdown: {
    category: string
    score: number
    weight: number
    contribution: number
    description: string
  }[]
}

// ... existing SCORING_CRITERIA ...

export function calculateDeceptionLikelihood(scores: Partial<DeceptionScores>): DeceptionAssessment {
  // ... existing implementation ...
}

export function getMOMDescription(score: number): string {
  if (score >= 4) return 'Adversary has strong capability and incentive to deceive'
  if (score >= 3) return 'Adversary has moderate deception capability'
  if (score >= 2) return 'Some deception capability exists'
  if (score >= 1) return 'Limited deception capability'
  return 'Minimal or no deception capability'
}

export function getPOPDescription(score: number): string {
  if (score >= 4) return 'Strong historical pattern of sophisticated deception'
  if (score >= 3) return 'Established pattern of successful deception'
  if (score >= 2) return 'Some history of deception attempts'
  if (score >= 1) return 'Limited deception history'
  return 'No significant deception history'
}

export function getMOSESDescription(score: number): string {
  if (score >= 4) return 'Sources highly vulnerable to manipulation'
  if (score >= 3) return 'Significant source vulnerability exists'
  if (score >= 2) return 'Moderate source vulnerability'
  if (score >= 1) return 'Some source vulnerability'
  return 'Sources appear secure'
}

export function getEVEDescription(score: number): string {
  if (score >= 4) return 'Evidence shows major inconsistencies and anomalies'
  if (score >= 3) return 'Evidence has significant quality issues'
  if (score >= 2) return 'Some evidence quality concerns'
  if (score >= 1) return 'Minor evidence issues'
  return 'Evidence appears sound and well-corroborated'
}

export function getRageDescription(score: number): string {
  if (score >= 4) return 'Content uses extreme manipulative framing'
  if (score >= 3) return 'Significant use of outrage bait/manipulation'
  if (score >= 2) return 'Some manipulative framing present'
  if (score >= 1) return 'Minor emotional loading detected'
  return 'Content appears neutrally framed'
}

/**
 * Get color for risk level
 */
export function getRiskColor(riskLevel: DeceptionAssessment['riskLevel']): string {
  switch (riskLevel) {
    case 'CRITICAL': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
    case 'HIGH': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
    case 'MEDIUM': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
    case 'LOW': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
    case 'MINIMAL': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
  }
}

/**
 * Get confidence color
 */
export function getConfidenceColor(level: DeceptionAssessment['confidenceLevel']): string {
  switch (level) {
    case 'VERY_HIGH': return 'text-green-600 dark:text-green-400'
    case 'HIGH': return 'text-blue-600 dark:text-blue-400'
    case 'MODERATE': return 'text-yellow-600 dark:text-yellow-400'
    case 'LOW': return 'text-orange-600 dark:text-orange-400'
    case 'VERY_LOW': return 'text-red-600 dark:text-red-400'
  }
}

/**
 * Generate key indicators from scores
 */
export function generateKeyIndicators(assessment: DeceptionAssessment): {
  deceptionIndicators: string[]
  counterIndicators: string[]
} {
  const deceptionIndicators: string[] = []
  const counterIndicators: string[] = []
  const { scores } = assessment

  // Check MOM scores
  if (scores.motive >= 4) deceptionIndicators.push(`Strong motive: ${SCORING_CRITERIA.motive.levels[scores.motive].description}`)
  if (scores.opportunity >= 4) deceptionIndicators.push(`High opportunity: ${SCORING_CRITERIA.opportunity.levels[scores.opportunity].description}`)
  if (scores.means >= 4) deceptionIndicators.push(`Advanced capabilities: ${SCORING_CRITERIA.means.levels[scores.means].description}`)

  // Check POP scores
  if (scores.historicalPattern >= 4) deceptionIndicators.push(`Routine deception pattern: ${SCORING_CRITERIA.historicalPattern.levels[scores.historicalPattern].description}`)
  if (scores.sophisticationLevel >= 4) deceptionIndicators.push(`Highly sophisticated operations: ${SCORING_CRITERIA.sophisticationLevel.levels[scores.sophisticationLevel].description}`)
  if (scores.successRate >= 4) deceptionIndicators.push(`High success rate: ${SCORING_CRITERIA.successRate.levels[scores.successRate].description}`)

  // Check MOSES scores
  if (scores.sourceVulnerability >= 4) deceptionIndicators.push(`Sources highly vulnerable: ${SCORING_CRITERIA.sourceVulnerability.levels[scores.sourceVulnerability].description}`)
  if (scores.manipulationEvidence >= 3) deceptionIndicators.push(`Manipulation signs: ${SCORING_CRITERIA.manipulationEvidence.levels[scores.manipulationEvidence].description}`)

  // Check EVE scores (inverted logic)
  if (scores.internalConsistency <= 1) deceptionIndicators.push(`Evidence highly inconsistent: ${SCORING_CRITERIA.internalConsistency.levels[scores.internalConsistency].description}`)
  if (scores.externalCorroboration <= 1) deceptionIndicators.push(`No corroboration: ${SCORING_CRITERIA.externalCorroboration.levels[scores.externalCorroboration].description}`)
  if (scores.anomalyDetection >= 4) deceptionIndicators.push(`Major anomalies: ${SCORING_CRITERIA.anomalyDetection.levels[scores.anomalyDetection].description}`)

  // RageCheck indicators
  if ((scores.rageLoadedLanguage || 0) >= 4) deceptionIndicators.push('Intense use of loaded language')
  if ((scores.rageThreatPanic || 0) >= 4) deceptionIndicators.push('Extreme fear-mongering framing')
  if ((scores.rageUsVsThem || 0) >= 4) deceptionIndicators.push('Strong divisive/tribal framing')

  // Counter-indicators (evidence against deception)
  if (scores.motive <= 1) counterIndicators.push('Weak or no motive to deceive')
  if (scores.historicalPattern <= 1) counterIndicators.push('No significant deception history')
  if (scores.sourceVulnerability <= 1) counterIndicators.push('Independent, secure sources')
  if (scores.internalConsistency >= 4) counterIndicators.push('Evidence highly consistent')
  if (scores.externalCorroboration >= 4) counterIndicators.push('Strong independent corroboration')
  if (scores.anomalyDetection <= 1) counterIndicators.push('No significant anomalies detected')

  return { deceptionIndicators, counterIndicators }
}
