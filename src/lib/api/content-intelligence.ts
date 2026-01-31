// src/lib/api/content-intelligence.ts
import { createLogger } from '@/lib/logger'
import type { ContentAnalysis, SavedLink } from '@/types/content-intelligence'

const logger = createLogger('ContentIntelligenceAPI')

// ============================================
// Error Types
// ============================================

export class ContentIntelligenceAPIError extends Error {
  statusCode: number
  errorCode?: string

  constructor(
    message: string,
    statusCode: number,
    errorCode?: string
  ) {
    super(message)
    this.name = 'ContentIntelligenceAPIError'
    this.statusCode = statusCode
    this.errorCode = errorCode
  }
}

// ============================================
// API Response Types
// ============================================

export interface AnalyzeUrlResponse {
  analysis: ContentAnalysis
  bypass_urls?: Record<string, string>
}

export interface DIMEAnalysisResponse {
  dime_analysis: {
    diplomatic: { relevance: string; impact: string; considerations: string[] }
    informational: { relevance: string; impact: string; considerations: string[] }
    military: { relevance: string; impact: string; considerations: string[] }
    economic: { relevance: string; impact: string; considerations: string[] }
    overall_assessment: string
    key_implications: string[]
  }
}

export interface ClaimsAnalysisResponse {
  claim_analysis: {
    claims: Array<{
      claim: string
      category: string
      source?: string
      deception_analysis: {
        overall_risk: 'low' | 'medium' | 'high'
        risk_score: number
        methods: Record<string, { score: number; reasoning: string }>
        red_flags: string[]
        confidence_assessment: string
      }
    }>
    summary: {
      total_claims: number
      high_risk_claims: number
      medium_risk_claims: number
      low_risk_claims: number
      most_concerning_claim?: string
      overall_content_credibility: number
    }
  }
}

export interface CountryLookupResponse {
  country: string
  country_code: string
  registrar?: string
  organization?: string
  ip_address?: string
  asn?: string
}

export interface VirusTotalResponse {
  url: string
  scan_date: string
  positives: number
  total: number
  scans: Record<string, { detected: boolean; result: string }>
  permalink: string
}

export interface AskQuestionResponse {
  answer: string
  sources?: string[]
  confidence?: number
}

export interface SocialMediaExtractResponse {
  platform: string
  author?: {
    name: string
    username: string
    avatar_url?: string
    verified?: boolean
    followers?: number
  }
  content?: {
    text: string
    media?: Array<{ type: string; url: string }>
    links?: string[]
  }
  engagement?: {
    likes: number
    shares: number
    comments: number
  }
  timestamp?: string
}

export interface GitRepositoryExtractResponse {
  platform: 'github' | 'gitlab' | 'bitbucket'
  owner: string
  repo: string
  description?: string
  stars?: number
  forks?: number
  watchers?: number
  language?: string
  topics?: string[]
  license?: string
  readme?: string
  created_at?: string
  updated_at?: string
}

export interface StarburstingResponse {
  session_id: string
  central_topic: string
  sources_count: number
  framework_data: {
    data: {
      who?: Array<{ id: string; question: string; answer?: string; entities?: string[] }>
      what?: Array<{ id: string; question: string; answer?: string; entities?: string[] }>
      when?: Array<{ id: string; question: string; answer?: string; entities?: string[] }>
      where?: Array<{ id: string; question: string; answer?: string; entities?: string[] }>
      why?: Array<{ id: string; question: string; answer?: string; entities?: string[] }>
      how?: Array<{ id: string; question: string; answer?: string; entities?: string[] }>
    }
  }
  status: 'processing' | 'complete' | 'error'
}

export interface StarburstingStatusResponse {
  session_id: string
  status: 'processing' | 'complete' | 'error'
  progress?: number
  framework_data?: StarburstingResponse['framework_data']
  error?: string
}

export interface EntitySummaryResponse {
  summary: string
  entity: string
  entity_type: string
}

export interface ShareAnalysisResponse {
  share_url: string
  expires_at?: string
}

export interface SaveAnalysisResponse {
  success: boolean
  saved_link_id: number
}

export interface AutoExtractEntitiesResponse {
  entities: Record<string, { id: string; name: string }>
}

// ============================================
// Helpers
// ============================================

function getAuthHeaders(): Record<string, string> {
  const userHash = localStorage.getItem('omnicore_user_hash')
  return userHash ? { Authorization: `Bearer ${userHash}` } : {}
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new ContentIntelligenceAPIError(
      errorData.error || errorData.details || `Request failed with status ${response.status}`,
      response.status,
      errorData.code
    )
  }
  return response.json()
}

// ============================================
// API Client
// ============================================

export const contentIntelligenceAPI = {
  /**
   * Analyze a URL and extract content intelligence
   */
  async analyzeUrl(
    url: string,
    mode: 'quick' | 'normal' | 'full'
  ): Promise<AnalyzeUrlResponse> {
    logger.debug('Analyzing URL:', { url, mode })
    const response = await fetch('/api/content-intelligence/analyze-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ url, mode }),
    })
    return handleResponse(response)
  },

  /**
   * Run DIME framework analysis on content
   */
  async runDIMEAnalysis(
    analysisId: string | number,
    content: string
  ): Promise<DIMEAnalysisResponse> {
    logger.debug('Running DIME analysis:', { analysisId })
    const response = await fetch('/api/content-intelligence/dime-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ analysis_id: analysisId, content }),
    })
    return handleResponse(response)
  },

  /**
   * Run claims extraction and deception analysis
   */
  async runClaimsAnalysis(
    analysisId: string | number
  ): Promise<ClaimsAnalysisResponse> {
    logger.debug('Running claims analysis:', { analysisId })
    const response = await fetch(`/api/claims/analyze/${analysisId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    })
    return handleResponse(response)
  },

  /**
   * Get saved links for the current user
   */
  async getSavedLinks(limit?: number): Promise<SavedLink[]> {
    logger.debug('Fetching saved links', { limit })
    const params = limit ? `?limit=${limit}` : ''
    const response = await fetch(`/api/content-intelligence/saved-links${params}`, {
      headers: getAuthHeaders(),
    })
    return handleResponse(response)
  },

  /**
   * Save an analysis to the user's library
   */
  async saveAnalysis(data: {
    url: string
    analysis_id: string | number
    note?: string
    tags?: string[]
  }): Promise<SaveAnalysisResponse> {
    logger.debug('Saving analysis:', { analysisId: data.analysis_id })
    const response = await fetch('/api/content-intelligence/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    })
    return handleResponse(response)
  },

  /**
   * Look up country/origin information for a domain
   */
  async lookupCountry(url: string): Promise<CountryLookupResponse> {
    logger.debug('Looking up country for URL:', { url })
    const response = await fetch('/api/content-intelligence/domain-country', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ url }),
    })
    return handleResponse(response)
  },

  /**
   * Ask a question about the analyzed content
   */
  async askQuestion(
    analysisId: string | number,
    question: string,
    context: string
  ): Promise<AskQuestionResponse> {
    logger.debug('Asking question:', { analysisId, question })
    const response = await fetch('/api/content-intelligence/answer-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ analysis_id: analysisId, question, context }),
    })
    return handleResponse(response)
  },

  /**
   * Run VirusTotal security scan on a URL
   */
  async virusTotalLookup(url: string): Promise<VirusTotalResponse> {
    logger.debug('VirusTotal lookup:', { url })
    const response = await fetch('/api/content-intelligence/virustotal-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ url }),
    })
    return handleResponse(response)
  },

  /**
   * Extract social media post data
   */
  async extractSocialMedia(url: string): Promise<SocialMediaExtractResponse> {
    logger.debug('Extracting social media:', { url })
    const response = await fetch('/api/content-intelligence/social-media-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ url }),
    })
    return handleResponse(response)
  },

  /**
   * Extract git repository information
   */
  async extractGitRepository(url: string): Promise<GitRepositoryExtractResponse> {
    logger.debug('Extracting git repository:', { url })
    const response = await fetch('/api/content-intelligence/git-repository-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ url }),
    })
    return handleResponse(response)
  },

  /**
   * Start a starbursting analysis session
   */
  async startStarbursting(
    analysisId: string | number,
    title?: string
  ): Promise<StarburstingResponse> {
    logger.debug('Starting starbursting:', { analysisId })
    const response = await fetch('/api/content-intelligence/starbursting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ analysis_id: analysisId, title }),
    })
    return handleResponse(response)
  },

  /**
   * Start starbursting with multiple analysis IDs
   */
  async startStarburstingMultiple(
    analysisIds: (string | number)[],
    title?: string
  ): Promise<StarburstingResponse> {
    logger.debug('Starting starbursting with multiple sources:', { analysisIds })
    const response = await fetch('/api/content-intelligence/starbursting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ analysis_ids: analysisIds, title }),
    })
    return handleResponse(response)
  },

  /**
   * Get starbursting session status
   */
  async getStarburstingStatus(sessionId: string): Promise<StarburstingStatusResponse> {
    logger.debug('Getting starbursting status:', { sessionId })
    const response = await fetch(
      `/api/content-intelligence/starbursting/${sessionId}/status`,
      {
        headers: getAuthHeaders(),
      }
    )
    return handleResponse(response)
  },

  /**
   * Generate more questions for a starbursting session
   */
  async generateMoreQuestions(
    sessionId: string,
    existingQuestions?: Record<string, unknown>
  ): Promise<StarburstingResponse> {
    logger.debug('Generating more questions:', { sessionId })
    const response = await fetch(
      `/api/content-intelligence/starbursting/${sessionId}/generate-questions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ existing_questions: existingQuestions }),
      }
    )
    return handleResponse(response)
  },

  /**
   * Link an entity to an actor in the starbursting session
   */
  async linkStarburstingEntity(
    sessionId: string,
    questionId: string,
    entity: string,
    actorId: string
  ): Promise<{ success: boolean }> {
    logger.debug('Linking starbursting entity:', { sessionId, questionId, entity, actorId })
    const response = await fetch(
      `/api/content-intelligence/starbursting/${sessionId}/link-entity`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ question_id: questionId, entity, actor_id: actorId }),
      }
    )
    return handleResponse(response)
  },

  /**
   * Summarize an entity within the content context
   */
  async summarizeEntity(
    content: string,
    entityName: string,
    entityType: string,
    contentTitle?: string
  ): Promise<EntitySummaryResponse> {
    logger.debug('Summarizing entity:', { entityName, entityType })
    const response = await fetch('/api/content-intelligence/summarize-entity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        content,
        entity_name: entityName,
        entity_type: entityType,
        content_title: contentTitle,
      }),
    })
    return handleResponse(response)
  },

  /**
   * Create a shareable link for an analysis
   */
  async shareAnalysis(analysisId: string | number): Promise<ShareAnalysisResponse> {
    logger.debug('Sharing analysis:', { analysisId })
    const response = await fetch('/api/content-intelligence/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ analysis_id: analysisId }),
    })
    return handleResponse(response)
  },

  /**
   * Auto-extract entities and match to existing actors
   */
  async autoExtractEntities(
    analysisId: string | number
  ): Promise<AutoExtractEntitiesResponse> {
    logger.debug('Auto-extracting entities:', { analysisId })
    const response = await fetch('/api/content-intelligence/auto-extract-entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ analysis_id: analysisId }),
    })
    return handleResponse(response)
  },

  /**
   * Match entities to existing actors in the database
   */
  async matchEntitiesToActors(
    entities: Array<{ name: string; type: string }>
  ): Promise<Record<string, { id: string; name: string }>> {
    logger.debug('Matching entities to actors:', { count: entities.length })
    const response = await fetch('/api/content-intelligence/match-entities-to-actors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ entities }),
    })
    return handleResponse(response)
  },
}
