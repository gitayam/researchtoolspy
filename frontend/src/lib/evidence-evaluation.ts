/**
 * Evidence Evaluation System based on Structured Analytic Techniques Standards (SATS)
 * Implements comprehensive evidence assessment criteria for ACH analysis
 */

export interface EvidenceEvaluationCriteria {
  // Source Credibility Assessment
  sourceType: 'primary' | 'secondary' | 'tertiary' | 'unknown'
  sourceReliability: 1 | 3 | 5 | 8 | 13  // Logarithmic scale
  
  // Content Credibility Assessment
  corroboration: 'multiple_independent' | 'single_confirmed' | 'single_unconfirmed' | 'contradicted'
  accuracy: 'confirmed' | 'probably_true' | 'possibly_true' | 'doubtful' | 'improbable'
  
  // Bias and Motivation Assessment
  sourceBias: 'no_apparent_bias' | 'minimal_bias' | 'moderate_bias' | 'significant_bias' | 'extreme_bias'
  motivationToDeceive: 'none' | 'low' | 'moderate' | 'high' | 'confirmed_deception'
  
  // Technical Assessment
  directness: 'direct_observation' | 'participant_account' | 'second_hand' | 'third_hand_plus'
  timeliness: 'real_time' | 'recent' | 'dated' | 'historical' | 'unknown_timing'
  
  // Contextual Factors
  expertise: 'subject_matter_expert' | 'knowledgeable' | 'general_knowledge' | 'limited_knowledge' | 'no_expertise'
  accessToInformation: 'direct_access' | 'good_access' | 'limited_access' | 'no_direct_access'
}

// Logarithmic confidence scale based on Fibonacci sequence
export const CONFIDENCE_SCALE = {
  VERY_HIGH: 13,   // Extremely confident in evidence
  HIGH: 8,         // High confidence
  MODERATE: 5,     // Moderate confidence
  LOW: 3,          // Low confidence
  VERY_LOW: 1,     // Minimal confidence
} as const

// Evidence evaluation questions based on SATS methodology
export const EVIDENCE_QUESTIONS = [
  {
    id: 'source_type',
    question: 'Is this a primary, secondary, or tertiary source?',
    category: 'Source Classification',
    options: [
      { value: 'primary', label: 'Primary (direct witness/participant)', weight: 13 },
      { value: 'secondary', label: 'Secondary (analyzed primary sources)', weight: 8 },
      { value: 'tertiary', label: 'Tertiary (compiled from secondary)', weight: 3 },
      { value: 'unknown', label: 'Unknown source type', weight: 1 }
    ],
    guidance: 'Primary sources provide firsthand testimony or direct evidence. Secondary sources analyze primary sources. Tertiary sources compile information from secondary sources.'
  },
  {
    id: 'corroboration',
    question: 'Is this information corroborated by other sources?',
    category: 'Verification',
    options: [
      { value: 'multiple_independent', label: 'Multiple independent sources confirm', weight: 13 },
      { value: 'single_confirmed', label: 'At least one other source confirms', weight: 8 },
      { value: 'single_unconfirmed', label: 'Single source, unconfirmed', weight: 3 },
      { value: 'contradicted', label: 'Contradicted by other sources', weight: -5 }
    ],
    guidance: 'Information confirmed by multiple independent sources is more reliable than single-source reporting.'
  },
  {
    id: 'source_bias',
    question: 'Does the source have any apparent bias regarding this issue?',
    category: 'Bias Assessment',
    options: [
      { value: 'no_apparent_bias', label: 'No apparent bias', weight: 13 },
      { value: 'minimal_bias', label: 'Minimal bias possible', weight: 8 },
      { value: 'moderate_bias', label: 'Moderate bias likely', weight: 5 },
      { value: 'significant_bias', label: 'Significant bias evident', weight: 3 },
      { value: 'extreme_bias', label: 'Extreme bias confirmed', weight: 1 }
    ],
    guidance: 'Consider the source\'s position, affiliations, and potential interests in the outcome.'
  },
  {
    id: 'motivation_to_deceive',
    question: 'Does the source have motivation to lie or deceive about this?',
    category: 'Deception Risk',
    options: [
      { value: 'none', label: 'No conceivable motivation', weight: 13 },
      { value: 'low', label: 'Low motivation possible', weight: 8 },
      { value: 'moderate', label: 'Moderate motivation likely', weight: 5 },
      { value: 'high', label: 'High motivation to deceive', weight: 2 },
      { value: 'confirmed_deception', label: 'Confirmed past deception', weight: -3 }
    ],
    guidance: 'Consider what the source might gain or lose from providing false information.'
  },
  {
    id: 'directness',
    question: 'How direct is the source\'s access to the information?',
    category: 'Information Chain',
    options: [
      { value: 'direct_observation', label: 'Direct observation/participation', weight: 13 },
      { value: 'participant_account', label: 'Account from participant', weight: 8 },
      { value: 'second_hand', label: 'Second-hand information', weight: 5 },
      { value: 'third_hand_plus', label: 'Third-hand or more removed', weight: 2 }
    ],
    guidance: 'Information loses accuracy as it passes through more intermediaries.'
  },
  {
    id: 'timeliness',
    question: 'How current is this information?',
    category: 'Temporal Relevance',
    options: [
      { value: 'real_time', label: 'Real-time or very recent', weight: 13 },
      { value: 'recent', label: 'Recent (days/weeks)', weight: 8 },
      { value: 'dated', label: 'Dated (months old)', weight: 5 },
      { value: 'historical', label: 'Historical (years old)', weight: 3 },
      { value: 'unknown_timing', label: 'Unknown timeframe', weight: 1 }
    ],
    guidance: 'More recent information is generally more relevant for current analysis.'
  },
  {
    id: 'expertise',
    question: 'What is the source\'s level of expertise on this subject?',
    category: 'Source Competence',
    options: [
      { value: 'subject_matter_expert', label: 'Recognized subject matter expert', weight: 13 },
      { value: 'knowledgeable', label: 'Knowledgeable in the field', weight: 8 },
      { value: 'general_knowledge', label: 'General knowledge only', weight: 5 },
      { value: 'limited_knowledge', label: 'Limited relevant knowledge', weight: 3 },
      { value: 'no_expertise', label: 'No relevant expertise', weight: 1 }
    ],
    guidance: 'Sources with relevant expertise are more likely to provide accurate technical information.'
  },
  {
    id: 'access_to_information',
    question: 'What level of access does the source have to the information?',
    category: 'Information Access',
    options: [
      { value: 'direct_access', label: 'Direct/privileged access', weight: 13 },
      { value: 'good_access', label: 'Good access through position', weight: 8 },
      { value: 'limited_access', label: 'Limited access', weight: 5 },
      { value: 'no_direct_access', label: 'No direct access', weight: 2 }
    ],
    guidance: 'Sources with better access to information are more likely to have accurate details.'
  }
]

/**
 * Calculate overall evidence confidence using logarithmic weighting
 */
export function calculateEvidenceConfidence(responses: Record<string, number>): {
  confidence: number
  level: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'VERY_LOW'
  percentage: number
} {
  const weights = Object.values(responses).filter(w => w !== undefined)
  
  if (weights.length === 0) {
    return { confidence: 1, level: 'VERY_LOW', percentage: 0 }
  }
  
  // Calculate weighted average with emphasis on lowest scores (weakest link principle)
  const sortedWeights = weights.sort((a, b) => a - b)
  const weightFactors = sortedWeights.map((_, index) => Math.pow(0.7, index)) // Exponential decay
  
  const weightedSum = sortedWeights.reduce((sum, weight, index) => 
    sum + weight * weightFactors[index], 0
  )
  const factorSum = weightFactors.reduce((sum, factor) => sum + factor, 0)
  
  const confidence = Math.round(weightedSum / factorSum)
  
  // Determine confidence level
  let level: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'VERY_LOW'
  if (confidence >= 11) level = 'VERY_HIGH'
  else if (confidence >= 7) level = 'HIGH'
  else if (confidence >= 4) level = 'MODERATE'
  else if (confidence >= 2) level = 'LOW'
  else level = 'VERY_LOW'
  
  // Calculate percentage (13 is max on logarithmic scale)
  const percentage = Math.round((confidence / 13) * 100)
  
  return { confidence, level, percentage }
}

/**
 * Get credibility rating based on standard intelligence community ratings
 */
export function getCredibilityRating(confidence: number): {
  letter: string
  description: string
  color: string
} {
  // Standard A-F credibility ratings used in intelligence analysis
  if (confidence >= 11) {
    return { letter: 'A', description: 'Completely reliable', color: 'text-green-700' }
  } else if (confidence >= 8) {
    return { letter: 'B', description: 'Usually reliable', color: 'text-green-600' }
  } else if (confidence >= 5) {
    return { letter: 'C', description: 'Fairly reliable', color: 'text-yellow-600' }
  } else if (confidence >= 3) {
    return { letter: 'D', description: 'Not usually reliable', color: 'text-orange-600' }
  } else if (confidence >= 1) {
    return { letter: 'E', description: 'Unreliable', color: 'text-red-600' }
  } else {
    return { letter: 'F', description: 'Cannot be judged', color: 'text-gray-600' }
  }
}

/**
 * Analyze evidence quality patterns
 */
export function analyzeEvidencePatterns(
  evidenceEvaluations: Array<Record<string, number>>
): {
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
} {
  const strengths: string[] = []
  const weaknesses: string[] = []
  const recommendations: string[] = []
  
  // Analyze patterns across all evidence
  const avgScores: Record<string, number> = {}
  
  EVIDENCE_QUESTIONS.forEach(question => {
    const scores = evidenceEvaluations
      .map(evaluation => evaluation[question.id])
      .filter(score => score !== undefined)
    
    if (scores.length > 0) {
      avgScores[question.id] = scores.reduce((a, b) => a + b, 0) / scores.length
    }
  })
  
  // Identify strengths and weaknesses
  Object.entries(avgScores).forEach(([questionId, avgScore]) => {
    const question = EVIDENCE_QUESTIONS.find(q => q.id === questionId)
    if (!question) return
    
    if (avgScore >= 8) {
      strengths.push(`Strong ${question.category.toLowerCase()}`)
    } else if (avgScore <= 3) {
      weaknesses.push(`Weak ${question.category.toLowerCase()}`)
    }
  })
  
  // Generate recommendations
  if (avgScores.source_type <= 5) {
    recommendations.push('Seek primary sources to strengthen analysis')
  }
  if (avgScores.corroboration <= 5) {
    recommendations.push('Find additional sources to corroborate key evidence')
  }
  if (avgScores.source_bias <= 3) {
    recommendations.push('Account for source bias in analysis conclusions')
  }
  if (avgScores.motivation_to_deceive <= 3) {
    recommendations.push('Consider deception scenarios in hypothesis evaluation')
  }
  if (avgScores.timeliness <= 5) {
    recommendations.push('Seek more current information if available')
  }
  
  return { strengths, weaknesses, recommendations }
}