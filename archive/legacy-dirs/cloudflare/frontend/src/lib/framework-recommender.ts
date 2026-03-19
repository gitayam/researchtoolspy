/**
 * Framework Recommendation System
 * Intelligent framework selection based on user input and context
 */

export interface FrameworkRecommendation {
  id: string
  name: string
  description: string
  score: number
  reasons: string[]
  timeToComplete: string
  complexity: 'low' | 'medium' | 'high'
  category: string
}

export interface AnalysisContext {
  topic?: string
  timeframe?: string
  stakeholders?: string[]
  objectives?: string[]
  dataAvailable?: boolean
  urgency?: 'low' | 'medium' | 'high'
  teamSize?: number
}

const FRAMEWORKS = [
  {
    id: 'swot',
    name: 'SWOT Analysis',
    description: 'Analyze strengths, weaknesses, opportunities, and threats',
    category: 'Strategic Planning',
    complexity: 'low' as const,
    timeToComplete: '30-60 minutes',
    keywords: ['strategy', 'planning', 'internal', 'external', 'competitive', 'business'],
    scenarios: ['business planning', 'project assessment', 'competitive analysis']
  },
  {
    id: 'ach',
    name: 'Analysis of Competing Hypotheses',
    description: 'Systematic evaluation of multiple hypotheses against evidence',
    category: 'Intelligence Analysis',
    complexity: 'high' as const,
    timeToComplete: '2-4 hours',
    keywords: ['hypothesis', 'evidence', 'intelligence', 'evaluation', 'competing'],
    scenarios: ['intelligence analysis', 'research validation', 'decision making']
  },
  {
    id: 'cog',
    name: 'Center of Gravity Analysis',
    description: 'Identify critical capabilities and vulnerabilities',
    category: 'Military Analysis',
    complexity: 'medium' as const,
    timeToComplete: '1-2 hours',
    keywords: ['military', 'capabilities', 'vulnerabilities', 'critical', 'strategic'],
    scenarios: ['military planning', 'strategic assessment', 'capability analysis']
  },
  {
    id: 'pmesii-pt',
    name: 'PMESII-PT Analysis',
    description: 'Comprehensive operational environment analysis',
    category: 'Environmental Analysis',
    complexity: 'high' as const,
    timeToComplete: '3-5 hours',
    keywords: ['environment', 'political', 'military', 'economic', 'social', 'information'],
    scenarios: ['operational planning', 'environment assessment', 'comprehensive analysis']
  },
  {
    id: 'dotmlpf',
    name: 'DOTMLPF Analysis',
    description: 'Capability gap analysis across multiple domains',
    category: 'Capability Analysis',
    complexity: 'medium' as const,
    timeToComplete: '1-3 hours',
    keywords: ['doctrine', 'organization', 'training', 'materiel', 'leadership', 'personnel'],
    scenarios: ['capability assessment', 'gap analysis', 'organizational planning']
  },
  {
    id: 'deception-detection',
    name: 'Deception Detection',
    description: 'Identify potential deception in information sources',
    category: 'Information Analysis',
    complexity: 'medium' as const,
    timeToComplete: '1-2 hours',
    keywords: ['deception', 'information', 'credibility', 'verification', 'sources'],
    scenarios: ['information verification', 'source analysis', 'credibility assessment']
  },
  {
    id: 'behavioral-analysis',
    name: 'Behavioral Analysis',
    description: 'Analyze patterns and predict behavior',
    category: 'Behavioral Science',
    complexity: 'medium' as const,
    timeToComplete: '1-2 hours',
    keywords: ['behavior', 'patterns', 'psychology', 'prediction', 'analysis'],
    scenarios: ['behavioral prediction', 'pattern analysis', 'psychological assessment']
  },
  {
    id: 'starbursting',
    name: 'Starbursting',
    description: 'Generate comprehensive questions for exploration',
    category: 'Creative Thinking',
    complexity: 'low' as const,
    timeToComplete: '30-45 minutes',
    keywords: ['questions', 'exploration', 'creative', 'brainstorming', 'investigation'],
    scenarios: ['problem exploration', 'research planning', 'brainstorming sessions']
  },
  {
    id: 'causeway',
    name: 'CauseWay Analysis',
    description: 'Root cause analysis and issue resolution',
    category: 'Problem Solving',
    complexity: 'medium' as const,
    timeToComplete: '1-2 hours',
    keywords: ['cause', 'root', 'problem', 'issue', 'resolution', 'analysis'],
    scenarios: ['problem solving', 'root cause analysis', 'issue investigation']
  },
  {
    id: 'dime',
    name: 'DIME Framework',
    description: 'Diplomatic, Information, Military, Economic analysis',
    category: 'Strategic Analysis',
    complexity: 'medium' as const,
    timeToComplete: '2-3 hours',
    keywords: ['diplomatic', 'information', 'military', 'economic', 'power', 'strategy'],
    scenarios: ['strategic planning', 'power analysis', 'geopolitical assessment']
  }
]

/**
 * Calculate framework relevance score based on context
 */
function calculateRelevanceScore(framework: typeof FRAMEWORKS[0], context: AnalysisContext): number {
  let score = 0
  const reasons: string[] = []

  // Topic matching
  if (context.topic) {
    const topicLower = context.topic.toLowerCase()
    const keywordMatches = framework.keywords.filter(keyword => 
      topicLower.includes(keyword)
    ).length
    
    if (keywordMatches > 0) {
      score += keywordMatches * 20
      reasons.push(`Matches ${keywordMatches} relevant keyword(s)`)
    }

    // Scenario matching
    const scenarioMatches = framework.scenarios.filter(scenario =>
      topicLower.includes(scenario.split(' ')[0]) || 
      scenario.split(' ').some(word => topicLower.includes(word))
    ).length
    
    if (scenarioMatches > 0) {
      score += scenarioMatches * 15
      reasons.push(`Suitable for ${scenarioMatches} matching scenario(s)`)
    }
  }

  // Urgency matching
  if (context.urgency) {
    if (context.urgency === 'high' && framework.complexity === 'low') {
      score += 25
      reasons.push('Quick to complete for urgent needs')
    } else if (context.urgency === 'low' && framework.complexity === 'high') {
      score += 15
      reasons.push('Comprehensive analysis suitable for non-urgent work')
    }
  }

  // Team size considerations
  if (context.teamSize) {
    if (context.teamSize === 1 && framework.complexity === 'low') {
      score += 10
      reasons.push('Suitable for individual work')
    } else if (context.teamSize > 3 && framework.complexity === 'high') {
      score += 15
      reasons.push('Complex framework benefits from team collaboration')
    }
  }

  // Data availability
  if (context.dataAvailable !== undefined) {
    if (context.dataAvailable && ['ach', 'behavioral-analysis', 'deception-detection'].includes(framework.id)) {
      score += 20
      reasons.push('Works well with available data')
    } else if (!context.dataAvailable && ['starbursting', 'swot'].includes(framework.id)) {
      score += 15
      reasons.push('Can work with limited initial data')
    }
  }

  // Base relevance for popular frameworks
  if (['swot', 'ach'].includes(framework.id)) {
    score += 10
    reasons.push('Widely applicable framework')
  }

  return Math.min(score, 100) // Cap at 100
}

/**
 * Get framework recommendations based on analysis context
 */
export function getFrameworkRecommendations(
  context: AnalysisContext,
  limit: number = 5
): FrameworkRecommendation[] {
  const recommendations = FRAMEWORKS.map(framework => {
    const score = calculateRelevanceScore(framework, context)
    const reasons: string[] = []
    
    // Add reasons based on score calculation
    if (score > 0) {
      calculateRelevanceScore(framework, context) // This populates reasons
    }

    return {
      id: framework.id,
      name: framework.name,
      description: framework.description,
      score,
      reasons: getReasons(framework, context),
      timeToComplete: framework.timeToComplete,
      complexity: framework.complexity,
      category: framework.category
    }
  })

  // Sort by score and return top recommendations
  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .filter(rec => rec.score > 0)
}

/**
 * Get specific reasons why a framework is recommended
 */
function getReasons(framework: typeof FRAMEWORKS[0], context: AnalysisContext): string[] {
  const reasons: string[] = []

  if (context.topic) {
    const topicLower = context.topic.toLowerCase()
    
    // Specific framework recommendations based on topic
    if (framework.id === 'swot' && topicLower.includes('strategy')) {
      reasons.push('Perfect for strategic planning and competitive analysis')
    }
    if (framework.id === 'ach' && topicLower.includes('evidence')) {
      reasons.push('Excellent for hypothesis testing with evidence')
    }
    if (framework.id === 'cog' && topicLower.includes('military')) {
      reasons.push('Designed for military and security analysis')
    }
  }

  if (context.urgency === 'high' && framework.complexity === 'low') {
    reasons.push('Quick to execute for urgent decisions')
  }

  if (context.teamSize && context.teamSize > 1 && framework.complexity === 'high') {
    reasons.push('Benefits from collaborative team input')
  }

  if (reasons.length === 0) {
    reasons.push(`Good fit for ${framework.category.toLowerCase()}`)
  }

  return reasons
}

/**
 * Get a quick recommendation based on a simple query
 */
export function getQuickRecommendation(query: string): FrameworkRecommendation | null {
  const recommendations = getFrameworkRecommendations({ topic: query }, 1)
  return recommendations.length > 0 ? recommendations[0] : null
}

/**
 * Get frameworks by category
 */
export function getFrameworksByCategory(): Record<string, FrameworkRecommendation[]> {
  const categories: Record<string, FrameworkRecommendation[]> = {}
  
  FRAMEWORKS.forEach(framework => {
    if (!categories[framework.category]) {
      categories[framework.category] = []
    }
    
    categories[framework.category].push({
      id: framework.id,
      name: framework.name,
      description: framework.description,
      score: 0,
      reasons: [],
      timeToComplete: framework.timeToComplete,
      complexity: framework.complexity,
      category: framework.category
    })
  })
  
  return categories
}

/**
 * Check if recommendation service is available
 */
export function checkRecommendationServiceAvailability(): Promise<boolean> {
  // Simple check - always return true for now
  return Promise.resolve(true)
}

/**
 * Generate framework recommendations using AI/ML service
 */
export function generateFrameworkRecommendations(
  context: AnalysisContext
): Promise<FrameworkRecommendation[]> {
  // For now, just return the regular recommendations
  return Promise.resolve(getFrameworkRecommendations(context))
}