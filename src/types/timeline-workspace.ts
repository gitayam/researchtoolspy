import type { TimelineAnalysisResult, TimelineEvent } from './timeline-analysis'

export type TimelineWorkspaceMode = 'basic' | 'robust'
export type TimelineEventAssessment = 'unreviewed' | 'corroborated' | 'disputed' | 'hypothesis'
export type TimelineQuestionStatus = 'open' | 'answered'

export interface TimelineSourceReference {
  id: string
  url: string
  title?: string
}

export interface TimelineWorkspaceEvent extends TimelineEvent {
  id: string
  origin: 'source' | 'analyst'
  assessment: TimelineEventAssessment
  analystNote: string
  modified: boolean
  original?: TimelineEvent
}

export interface TimelineWorkspaceQuestion {
  id: string
  afterEventId?: string
  beforeEventId?: string
  question: string
  status: TimelineQuestionStatus
  answer: string
  sources?: TimelineSourceReference[]
}

export interface TimelineWorkspaceHypothesis {
  id: string
  afterEventId?: string
  beforeEventId?: string
  hypothesis: string
  rationale: string
  origin: 'ai'
}

export interface TimelineWorkspaceState {
  mode: TimelineWorkspaceMode
  events: TimelineWorkspaceEvent[]
  questions: TimelineWorkspaceQuestion[]
  hypotheses: TimelineWorkspaceHypothesis[]
}

export interface TimelineManualSource {
  schemaVersion: 'timeline-manual.v1'
  title: string
}

export interface TimelineWorkspaceExport {
  schemaVersion: 'timeline-workspace.v1'
  exportedAt: string
  source: TimelineAnalysisResult | TimelineManualSource
  analystWorkspace: TimelineWorkspaceState
}
