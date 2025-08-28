export enum FrameworkType {
  SWOT = "swot",
  COG = "cog", 
  PMESII_PT = "pmesii-pt",
  ACH = "ach",
  DOTMLPF = "dotmlpf",
  DECEPTION = "deception",
  BEHAVIORAL = "behavioral",
  STARBURSTING = "starbursting",
  CAUSEWAY = "causeway",
  DIME = "dime"
}

export enum FrameworkStatus {
  DRAFT = "draft",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  ARCHIVED = "archived"
}

export enum ExportFormat {
  PDF = "pdf",
  DOCX = "docx", 
  JSON = "json",
  PPTX = "pptx",
  GRAPHML = "graphml"
}

export interface FrameworkSession {
  id: number
  title: string
  description?: string
  framework_type: FrameworkType
  status: FrameworkStatus
  data: Record<string, any>
  version: number
  user_id: number
  created_at: string
  updated_at: string
}

export interface FrameworkTemplate {
  id: number
  name: string
  description: string
  framework_type: FrameworkType
  template_data: Record<string, any>
  is_public: boolean
  created_by: number
}

export interface AIAnalysisRequest {
  prompt: string
  context?: string
  max_tokens?: number
  temperature?: number
  framework_type?: string
  system_prompt?: string
}

export interface AIAnalysisResponse {
  suggestions: string[]
  analysis: string
  confidence: number
  model_used: string
  token_usage: number
}

export interface ExportRequest {
  session_id: number
  format: ExportFormat
  include_ai_analysis?: boolean
  custom_template?: string
}

export interface ExportResponse {
  session_id: number
  format: ExportFormat
  download_url: string
  expires_at: string
  file_size?: number
}

// SWOT Analysis specific types
export interface SWOTAnalysis {
  session_id: number
  title: string
  objective: string
  context?: string
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
  ai_suggestions?: AIAnalysisResponse
  status: FrameworkStatus
  version: number
}

export interface SWOTCreateRequest {
  title: string
  objective: string
  context?: string
  template_id?: number
}

export interface SWOTUpdateRequest {
  title?: string
  objective?: string
  context?: string
  strengths?: string[]
  weaknesses?: string[]
  opportunities?: string[]
  threats?: string[]
}

// COG Analysis specific types
export interface COGEntity {
  id: string
  name: string
  type: "physical" | "moral" | "mental"
  criticality: number
  description?: string
  position?: { x: number; y: number }
}

export interface COGConnection {
  id: string
  source: string
  target: string
  relationship: string
  strength: number
}

export interface COGAnalysis {
  session_id: number
  title: string
  objective: string
  entities: COGEntity[]
  connections: COGConnection[]
  critical_vulnerabilities: string[]
  ai_normalization?: AIAnalysisResponse
  status: FrameworkStatus
  version: number
}

// PMESII-PT specific types
export interface PMESIIPTComponent {
  political: string[]
  military: string[]
  economic: string[]
  social: string[]
  information: string[]
  infrastructure: string[]
  physical_environment: string[]
  time: string[]
}

export interface PMESIIPTAnalysis {
  session_id: number
  title: string
  objective: string
  components: PMESIIPTComponent
  interconnections: Record<string, string[]>
  ai_analysis?: AIAnalysisResponse
  status: FrameworkStatus
  version: number
}

// ACH Analysis specific types
export interface ACHHypothesis {
  id: string
  title: string
  description: string
  probability: number
}

export interface ACHEvidence {
  id: string
  description: string
  source: string
  reliability: number
  hypothesis_scores: Record<string, number> // hypothesis_id -> score
}

export interface ACHAnalysis {
  session_id: number
  title: string
  objective: string
  hypotheses: ACHHypothesis[]
  evidence: ACHEvidence[]
  matrix: number[][]
  most_likely_hypothesis?: string
  status: FrameworkStatus
  version: number
}