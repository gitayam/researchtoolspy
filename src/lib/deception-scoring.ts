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
  }
  breakdown: {
    category: string
    score: number
    weight: number
    contribution: number
    description: string
  }[]
}

// Scoring criteria definitions
export const SCORING_CRITERIA = {
  motive: {
    label: 'Motive to Deceive',
    description: 'Does the adversary have strong reasons to deceive?',
    levels: [
      { value: 0, label: 'None', description: 'No apparent motive' },
      { value: 1, label: 'Weak', description: 'Minor benefits from deception' },
      { value: 2, label: 'Moderate', description: 'Some strategic advantage' },
      { value: 3, label: 'Strong', description: 'Significant political/military gain' },
      { value: 4, label: 'Very Strong', description: 'Critical to regime survival/objectives' },
      { value: 5, label: 'Critical', description: 'Existential threat if truth known' }
    ]
  },
  opportunity: {
    label: 'Opportunity to Deceive',
    description: 'Can they manipulate information channels?',
    levels: [
      { value: 0, label: 'None', description: 'No access to our information sources' },
      { value: 1, label: 'Minimal', description: 'Limited ability to influence' },
      { value: 2, label: 'Moderate', description: 'Some control over information flow' },
      { value: 3, label: 'Strong', description: 'Controls key information channels' },
      { value: 4, label: 'Extensive', description: 'Broad control with few checks' },
      { value: 5, label: 'Total', description: 'Complete information monopoly' }
    ]
  },
  means: {
    label: 'Means to Deceive',
    description: 'Do they have deception capabilities?',
    levels: [
      { value: 0, label: 'None', description: 'No demonstrated capability' },
      { value: 1, label: 'Basic', description: 'Simple denial/misrepresentation' },
      { value: 2, label: 'Moderate', description: 'Coordinated messaging capability' },
      { value: 3, label: 'Advanced', description: 'Sophisticated propaganda apparatus' },
      { value: 4, label: 'Highly Developed', description: 'State-level deception infrastructure' },
      { value: 5, label: 'Elite', description: 'World-class maskirovka/denial-deception' }
    ]
  },
  historicalPattern: {
    label: 'Historical Deception Pattern',
    description: 'How often has this actor deceived before?',
    levels: [
      { value: 0, label: 'Never', description: 'No history of deception' },
      { value: 1, label: 'Rarely', description: '1-2 incidents over many years' },
      { value: 2, label: 'Occasionally', description: 'Several documented cases' },
      { value: 3, label: 'Frequently', description: 'Regular pattern established' },
      { value: 4, label: 'Routinely', description: 'Standard operating procedure' },
      { value: 5, label: 'Systematically', description: 'Core doctrine/strategy' }
    ]
  },
  sophisticationLevel: {
    label: 'Deception Sophistication',
    description: 'How complex were past deceptions?',
    levels: [
      { value: 0, label: 'N/A', description: 'No past deceptions' },
      { value: 1, label: 'Crude', description: 'Simple lies, easily detected' },
      { value: 2, label: 'Basic', description: 'Some planning, moderate success' },
      { value: 3, label: 'Skillful', description: 'Well-planned, multi-layered' },
      { value: 4, label: 'Advanced', description: 'Highly sophisticated operations' },
      { value: 5, label: 'Masterful', description: 'State-of-the-art tradecraft' }
    ]
  },
  successRate: {
    label: 'Past Deception Success',
    description: 'How often did past deceptions succeed?',
    levels: [
      { value: 0, label: 'N/A', description: 'No past attempts' },
      { value: 1, label: 'Rarely Successful', description: '<20% success rate' },
      { value: 2, label: 'Sometimes Successful', description: '20-40% success' },
      { value: 3, label: 'Often Successful', description: '40-60% success' },
      { value: 4, label: 'Usually Successful', description: '60-80% success' },
      { value: 5, label: 'Consistently Successful', description: '>80% success' }
    ]
  },
  sourceVulnerability: {
    label: 'Source Vulnerability',
    description: 'How vulnerable are our sources to manipulation?',
    levels: [
      { value: 0, label: 'None', description: 'Completely independent sources' },
      { value: 1, label: 'Low', description: 'Multiple independent channels' },
      { value: 2, label: 'Moderate', description: 'Some shared dependencies' },
      { value: 3, label: 'Significant', description: 'Limited independent validation' },
      { value: 4, label: 'High', description: 'Heavy reliance on few sources' },
      { value: 5, label: 'Extreme', description: 'Single source or controlled channels' }
    ]
  },
  manipulationEvidence: {
    label: 'Manipulation Evidence',
    description: 'Are there signs of source manipulation?',
    levels: [
      { value: 0, label: 'None', description: 'No indicators of manipulation' },
      { value: 1, label: 'Minimal', description: 'Very weak indicators' },
      { value: 2, label: 'Some', description: 'Suspicious but inconclusive' },
      { value: 3, label: 'Moderate', description: 'Multiple suspicious indicators' },
      { value: 4, label: 'Strong', description: 'Clear signs of manipulation' },
      { value: 5, label: 'Definitive', description: 'Proven source compromise' }
    ]
  },
  internalConsistency: {
    label: 'Internal Consistency',
    description: 'Is the evidence self-consistent?',
    levels: [
      { value: 5, label: 'Highly Consistent', description: 'All elements align perfectly' },
      { value: 4, label: 'Mostly Consistent', description: 'Minor discrepancies only' },
      { value: 3, label: 'Moderately Consistent', description: 'Some contradictions present' },
      { value: 2, label: 'Largely Inconsistent', description: 'Major contradictions' },
      { value: 1, label: 'Highly Inconsistent', description: 'Severe contradictions' },
      { value: 0, label: 'Contradictory', description: 'Evidence contradicts itself' }
    ]
  },
  externalCorroboration: {
    label: 'External Corroboration',
    description: 'Do independent sources confirm?',
    levels: [
      { value: 5, label: 'Fully Corroborated', description: 'Multiple independent sources agree' },
      { value: 4, label: 'Largely Corroborated', description: 'Most key points confirmed' },
      { value: 3, label: 'Partially Corroborated', description: 'Some confirmation exists' },
      { value: 2, label: 'Minimally Corroborated', description: 'Little independent confirmation' },
      { value: 1, label: 'Uncorroborated', description: 'No independent sources' },
      { value: 0, label: 'Contradicted', description: 'Independent sources disagree' }
    ]
  },
  anomalyDetection: {
    label: 'Anomaly Detection',
    description: 'Are there unusual patterns or red flags?',
    levels: [
      { value: 0, label: 'None', description: 'No anomalies detected' },
      { value: 1, label: 'Minor', description: 'Slight irregularities' },
      { value: 2, label: 'Moderate', description: 'Notable inconsistencies' },
      { value: 3, label: 'Significant', description: 'Multiple red flags' },
      { value: 4, label: 'Major', description: 'Serious anomalies present' },
      { value: 5, label: 'Critical', description: 'Glaring impossibilities/contradictions' }
    ]
  }
}

// Category weights for overall likelihood calculation
const CATEGORY_WEIGHTS = {
  mom: 0.30,      // 30% - Capability to deceive is critical
  pop: 0.25,      // 25% - Historical patterns are strong indicators
  moses: 0.25,    // 25% - Source vulnerability is key
  eve: 0.20       // 20% - Evidence quality matters but can be misleading
}

/**
 * Calculate overall deception likelihood from component scores
 */
export function calculateDeceptionLikelihood(scores: Partial<DeceptionScores>): DeceptionAssessment {
  // Ensure all scores are present (default to 0)
  const fullScores: DeceptionScores = {
    motive: scores.motive ?? 0,
    opportunity: scores.opportunity ?? 0,
    means: scores.means ?? 0,
    historicalPattern: scores.historicalPattern ?? 0,
    sophisticationLevel: scores.sophisticationLevel ?? 0,
    successRate: scores.successRate ?? 0,
    sourceVulnerability: scores.sourceVulnerability ?? 0,
    manipulationEvidence: scores.manipulationEvidence ?? 0,
    internalConsistency: scores.internalConsistency ?? 0,
    externalCorroboration: scores.externalCorroboration ?? 0,
    anomalyDetection: scores.anomalyDetection ?? 0
  }

  // Calculate category averages
  const momScore = (fullScores.motive + fullScores.opportunity + fullScores.means) / 3
  const popScore = (fullScores.historicalPattern + fullScores.sophisticationLevel + fullScores.successRate) / 3
  const mosesScore = (fullScores.sourceVulnerability + fullScores.manipulationEvidence) / 2

  // EVE scores are inverted (low consistency = high deception risk)
  const eveScore = ((5 - fullScores.internalConsistency) + (5 - fullScores.externalCorroboration) + fullScores.anomalyDetection) / 3

  const categoryScores = {
    mom: momScore,
    pop: popScore,
    moses: mosesScore,
    eve: eveScore
  }

  // Calculate weighted overall likelihood (0-100%)
  const weightedSum =
    (momScore * CATEGORY_WEIGHTS.mom) +
    (popScore * CATEGORY_WEIGHTS.pop) +
    (mosesScore * CATEGORY_WEIGHTS.moses) +
    (eveScore * CATEGORY_WEIGHTS.eve)

  const overallLikelihood = Math.round((weightedSum / 5) * 100)

  // Determine confidence level based on data completeness
  const totalScoresProvided = Object.values(fullScores).filter(s => s > 0).length
  const confidenceLevel =
    totalScoresProvided >= 10 ? 'VERY_HIGH' :
    totalScoresProvided >= 8 ? 'HIGH' :
    totalScoresProvided >= 6 ? 'MODERATE' :
    totalScoresProvided >= 4 ? 'LOW' : 'VERY_LOW'

  // Determine risk level
  const riskLevel =
    overallLikelihood >= 80 ? 'CRITICAL' :
    overallLikelihood >= 60 ? 'HIGH' :
    overallLikelihood >= 40 ? 'MEDIUM' :
    overallLikelihood >= 20 ? 'LOW' : 'MINIMAL'

  // Build breakdown
  const breakdown = [
    {
      category: 'MOM (Motive, Opportunity, Means)',
      score: momScore,
      weight: CATEGORY_WEIGHTS.mom,
      contribution: momScore * CATEGORY_WEIGHTS.mom,
      description: getMOMDescription(momScore)
    },
    {
      category: 'POP (Patterns of Practice)',
      score: popScore,
      weight: CATEGORY_WEIGHTS.pop,
      contribution: popScore * CATEGORY_WEIGHTS.pop,
      description: getPOPDescription(popScore)
    },
    {
      category: 'MOSES (My Own Sources)',
      score: mosesScore,
      weight: CATEGORY_WEIGHTS.moses,
      contribution: mosesScore * CATEGORY_WEIGHTS.moses,
      description: getMOSESDescription(mosesScore)
    },
    {
      category: 'EVE (Evaluation of Evidence)',
      score: eveScore,
      weight: CATEGORY_WEIGHTS.eve,
      contribution: eveScore * CATEGORY_WEIGHTS.eve,
      description: getEVEDescription(eveScore)
    }
  ]

  return {
    scores: fullScores,
    overallLikelihood,
    confidenceLevel,
    riskLevel,
    categoryScores,
    breakdown
  }
}

function getMOMDescription(score: number): string {
  if (score >= 4) return 'Adversary has strong capability and incentive to deceive'
  if (score >= 3) return 'Adversary has moderate deception capability'
  if (score >= 2) return 'Some deception capability exists'
  if (score >= 1) return 'Limited deception capability'
  return 'Minimal or no deception capability'
}

function getPOPDescription(score: number): string {
  if (score >= 4) return 'Strong historical pattern of sophisticated deception'
  if (score >= 3) return 'Established pattern of successful deception'
  if (score >= 2) return 'Some history of deception attempts'
  if (score >= 1) return 'Limited deception history'
  return 'No significant deception history'
}

function getMOSESDescription(score: number): string {
  if (score >= 4) return 'Sources highly vulnerable to manipulation'
  if (score >= 3) return 'Significant source vulnerability exists'
  if (score >= 2) return 'Moderate source vulnerability'
  if (score >= 1) return 'Some source vulnerability'
  return 'Sources appear secure'
}

function getEVEDescription(score: number): string {
  if (score >= 4) return 'Evidence shows major inconsistencies and anomalies'
  if (score >= 3) return 'Evidence has significant quality issues'
  if (score >= 2) return 'Some evidence quality concerns'
  if (score >= 1) return 'Minor evidence issues'
  return 'Evidence appears sound and well-corroborated'
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

  // Counter-indicators (evidence against deception)
  if (scores.motive <= 1) counterIndicators.push('Weak or no motive to deceive')
  if (scores.historicalPattern <= 1) counterIndicators.push('No significant deception history')
  if (scores.sourceVulnerability <= 1) counterIndicators.push('Independent, secure sources')
  if (scores.internalConsistency >= 4) counterIndicators.push('Evidence highly consistent')
  if (scores.externalCorroboration >= 4) counterIndicators.push('Strong independent corroboration')
  if (scores.anomalyDetection <= 1) counterIndicators.push('No significant anomalies detected')

  return { deceptionIndicators, counterIndicators }
}
