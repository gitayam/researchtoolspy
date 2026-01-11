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
  rageLoadedLanguage: number   // Emotional/inflammatory words
  rageAbsolutist: number       // Certainty/black-and-white language
  rageThreatPanic: number      // Fear-mongering framing
  rageUsVsThem: number         // Divisive in-group/out-group language
  rageEngagementBait: number   // Clickbait/viral patterns
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
  },
  rageLoadedLanguage: {
    label: 'Loaded Language',
    description: 'Emotional, inflammatory words designed to provoke reaction',
    levels: [
      { value: 0, label: 'None', description: 'Neutral, objective language' },
      { value: 1, label: 'Low', description: 'Occasional mild emotional words' },
      { value: 2, label: 'Moderate', description: 'Noticeable emotional framing' },
      { value: 3, label: 'High', description: 'Frequent inflammatory language' },
      { value: 4, label: 'Intense', description: 'Pervasive emotional manipulation' },
      { value: 5, label: 'Extreme', description: 'Pure vitriol/outrage bait' }
    ]
  },
  rageAbsolutist: {
    label: 'Absolutist Language',
    description: 'Certainty/black-and-white language',
    levels: [
      { value: 0, label: 'None', description: 'Nuanced, qualified statements' },
      { value: 1, label: 'Low', description: 'Rare generalizations' },
      { value: 2, label: 'Moderate', description: 'Some black-and-white framing' },
      { value: 3, label: 'High', description: 'Frequent absolutist claims' },
      { value: 4, label: 'Intense', description: 'Consistent lack of nuance' },
      { value: 5, label: 'Extreme', description: 'Totalitarian certainty' }
    ]
  },
  rageThreatPanic: {
    label: 'Threat & Panic',
    description: 'Fear-mongering and urgency',
    levels: [
      { value: 0, label: 'None', description: 'Calm, factual tone' },
      { value: 1, label: 'Low', description: 'Mild concern expressed' },
      { value: 2, label: 'Moderate', description: 'Noticeable urgency/threat' },
      { value: 3, label: 'High', description: 'Clear fear-mongering' },
      { value: 4, label: 'Intense', description: 'Severe panic induction' },
      { value: 5, label: 'Extreme', description: 'Existential threat framing' }
    ]
  },
  rageUsVsThem: {
    label: 'Us vs Them',
    description: 'Divisive in-group/out-group framing',
    levels: [
      { value: 0, label: 'None', description: 'Inclusive/neutral framing' },
      { value: 1, label: 'Low', description: 'Mild group distinction' },
      { value: 2, label: 'Moderate', description: 'Noticeable tribalism' },
      { value: 3, label: 'High', description: 'Clear in-group/out-group bias' },
      { value: 4, label: 'Intense', description: 'Strong demonization of "other"' },
      { value: 5, label: 'Extreme', description: 'Dehumanization of opponents' }
    ]
  },
  rageEngagementBait: {
    label: 'Engagement Bait',
    description: 'Clickbait and viral patterns',
    levels: [
      { value: 0, label: 'None', description: 'Straightforward presentation' },
      { value: 1, label: 'Low', description: 'Slightly catchy hooks' },
      { value: 2, label: 'Moderate', description: 'Standard clickbait tactics' },
      { value: 3, label: 'High', description: 'Aggressive engagement hooks' },
      { value: 4, label: 'Intense', description: 'Viral engineering priority' },
      { value: 5, label: 'Extreme', description: 'Pure engagement farming' }
    ]
  }
}

// Category weights for overall likelihood calculation
const CATEGORY_WEIGHTS = {
  mom: 0.30,      // 30% - Capability
  pop: 0.20,      // 20% - History (Reduced from 25%)
  moses: 0.20,    // 20% - Vulnerability (Reduced from 25%)
  eve: 0.20,      // 20% - Evidence
  rage: 0.10      // 10% - Manipulative Framing (New)
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
    anomalyDetection: scores.anomalyDetection ?? 0,
    // RageCheck scores
    rageLoadedLanguage: scores.rageLoadedLanguage ?? 0,
    rageAbsolutist: scores.rageAbsolutist ?? 0,
    rageThreatPanic: scores.rageThreatPanic ?? 0,
    rageUsVsThem: scores.rageUsVsThem ?? 0,
    rageEngagementBait: scores.rageEngagementBait ?? 0
  }

  // Calculate category averages
  const momScore = (fullScores.motive + fullScores.opportunity + fullScores.means) / 3
  const popScore = (fullScores.historicalPattern + fullScores.sophisticationLevel + fullScores.successRate) / 3
  const mosesScore = (fullScores.sourceVulnerability + fullScores.manipulationEvidence) / 2
  // RageCheck average
  const rageScore = (fullScores.rageLoadedLanguage + fullScores.rageAbsolutist + fullScores.rageThreatPanic + fullScores.rageUsVsThem + fullScores.rageEngagementBait) / 5

  // EVE scores are inverted (low consistency = high deception risk)
  const eveScore = ((5 - fullScores.internalConsistency) + (5 - fullScores.externalCorroboration) + fullScores.anomalyDetection) / 3

  const categoryScores = {
    mom: momScore,
    pop: popScore,
    moses: mosesScore,
    eve: eveScore,
    rage: rageScore
  }

  // Calculate weighted overall likelihood (0-100%)
  const weightedSum =
    (momScore * CATEGORY_WEIGHTS.mom) +
    (popScore * CATEGORY_WEIGHTS.pop) +
    (mosesScore * CATEGORY_WEIGHTS.moses) +
    (eveScore * CATEGORY_WEIGHTS.eve) +
    (rageScore * CATEGORY_WEIGHTS.rage)

  const overallLikelihood = Math.round((weightedSum / 5) * 100)

  // Determine confidence level based on data completeness
  const totalScoresProvided = Object.values(fullScores).filter(s => s > 0).length
  const confidenceLevel =
    totalScoresProvided >= 14 ? 'VERY_HIGH' :
    totalScoresProvided >= 10 ? 'HIGH' :
    totalScoresProvided >= 7 ? 'MODERATE' :
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
    },
    {
      category: 'RageCheck (Manipulative Framing)',
      score: rageScore,
      weight: CATEGORY_WEIGHTS.rage,
      contribution: rageScore * CATEGORY_WEIGHTS.rage,
      description: getRageDescription(rageScore)
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

function getRageDescription(score: number): string {
  if (score >= 4) return 'Content uses extreme manipulative framing'
  if (score >= 3) return 'Significant use of outrage bait/manipulation'
  if (score >= 2) return 'Some manipulative framing present'
  if (score >= 1) return 'Minor emotional loading detected'
  return 'Content appears neutrally framed'
}
