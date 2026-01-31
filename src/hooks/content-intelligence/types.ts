// src/hooks/content-intelligence/types.ts
import type { ContentAnalysis, ProcessingStatus } from '@/types/content-intelligence'

export interface AnalysisUIState {
  activeTab: AnalysisTab
  textView: 'summary' | 'fulltext'
  wordCloudView: 'words' | 'phrases' | 'entities'
  linkFilter: 'all' | 'external' | 'internal'
  linkSort: 'references' | 'chronological'
  highlightedEntity: string | null
}

export interface AnalysisProcessingState {
  processing: boolean
  status: ProcessingStatus
  progress: number
  currentStep: string
}

export interface AnalysisDataState {
  url: string
  mode: 'quick' | 'normal' | 'full'
  analysis: ContentAnalysis | null
  bypassUrls: Record<string, string>
}

export type AnalysisTab =
  | 'overview'
  | 'entities'
  | 'sentiment'
  | 'links'
  | 'word-analysis'
  | 'claims'
  | 'dime'
  | 'starbursting'
  | 'qa'
