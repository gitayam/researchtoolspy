// OSINT Collection Types

// ========================================
// Collection Job
// ========================================

export type CollectionStatus = 'pending' | 'running' | 'complete' | 'error'
export type CollectionCategory = 'news' | 'academic' | 'government' | 'social' | 'technical' | 'archives'
export type TimeRange = 'day' | 'week' | 'month' | 'year' | 'all'
export type ApprovalStatus = -1 | 0 | 1 // rejected, pending, approved

export interface CollectionJob {
  id: string
  workspace_id: string
  query: string
  categories: CollectionCategory[]
  time_range: TimeRange
  max_results: number
  status: CollectionStatus
  results_count: number
  batch_job_id?: string
  error_message?: string
  llm_used?: 'openai' | 'local'
  created_at: string
  completed_at?: string
}

export interface CollectionJobRequest {
  query: string
  categories?: CollectionCategory[]
  timeRange?: TimeRange
  maxResults?: number
  useLocalLLM?: boolean
}

export interface CollectionJobResponse {
  jobId: string
  status: 'started'
  message: string
}

// ========================================
// Collection Results (Triage)
// ========================================

export interface CollectionResult {
  id: string
  job_id: string
  url: string
  title?: string
  snippet?: string
  category: CollectionCategory
  source_domain?: string
  relevance_score: number
  published_date?: string
  engine?: string
  approved: ApprovalStatus
  approved_at?: string
  analysis_id?: string
  created_at: string
}

export interface CollectionResultsResponse {
  results: CollectionResult[]
  pagination: {
    limit: number
    offset: number
    hasMore: boolean
  }
}

export interface CollectionResultsSummary {
  category: CollectionCategory
  count: number
  avg_relevance: number
}

// ========================================
// Collection Queries (Agent-generated)
// ========================================

export interface CollectionQuery {
  id: string
  job_id: string
  category: CollectionCategory
  query: string
  rationale?: string
  results_count: number
  created_at: string
}

// ========================================
// Triage Actions
// ========================================

export interface ApproveResultsRequest {
  selectedIds: string[]
  analyzeNow?: boolean
}

export interface ApproveResultsResponse {
  approved: number
  batchJobId?: string
  status: 'analysis_started' | 'saved'
}

// ========================================
// Agent Communication
// ========================================

export interface AgentCollectionRequest {
  jobId: string
  query: string
  categories: CollectionCategory[]
  maxResults: number
  timeRange: TimeRange
  searxngEndpoint: string
  callbackUrl: string
  useLocalLLM: boolean
}

export interface AgentCollectionCallback {
  jobId: string
  status: 'complete' | 'error'
  results?: Array<{
    url: string
    title: string
    snippet: string
    category: string
    source_domain: string
    relevance_score: number
    published_date?: string
    engine: string
  }>
  queries?: Array<{
    category: string
    query: string
    rationale: string
    results_count: number
  }>
  error?: string
  llm_used: 'openai' | 'local'
}
