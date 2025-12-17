/**
 * ACH (Analysis of Competing Hypotheses) Types
 */

export type ScaleType = 'logarithmic' | 'linear'
export type AnalysisStatus = 'draft' | 'in_progress' | 'completed'

export type ACHDomain = 'intelligence' | 'security' | 'business' | 'research' | 'medical' | 'legal' | 'other'

export interface ACHAnalysis {
  id: string
  user_id: string
  title: string
  description?: string
  question: string
  analyst?: string
  organization?: string
  scale_type: ScaleType
  status: AnalysisStatus
  created_at: string
  updated_at: string
  hypotheses?: ACHHypothesis[]
  evidence?: ACHEvidenceLink[]
  scores?: ACHScore[]

  // Public sharing fields
  is_public?: boolean
  share_token?: string
  view_count?: number
  clone_count?: number
  domain?: ACHDomain
  tags?: string[]
  shared_publicly_at?: string
}

export interface ACHHypothesis {
  id: string
  ach_analysis_id: string
  text: string
  order_num: number
  rationale?: string
  source?: string
  created_at: string
}

export interface ACHEvidenceLink {
  link_id: string
  evidence_id: string
  evidence_title: string
  evidence_content?: string
  source?: string
  date?: string
  credibility_score?: number
}

export interface ACHScore {
  id: string
  ach_analysis_id: string
  hypothesis_id: string
  evidence_id: string
  score: number
  credibility?: number  // 1-5
  relevance?: number    // 1-5
  notes?: string
  scored_by?: string
  scored_at: string
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
