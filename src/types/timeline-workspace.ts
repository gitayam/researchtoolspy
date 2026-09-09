import type { TimelineAnalysisResult, TimelineEvent } from './timeline-analysis'

export type TimelineWorkspaceMode = 'basic' | 'robust'
export type TimelineEventAssessment = 'unreviewed' | 'corroborated' | 'disputed' | 'hypothesis'
export type TimelineQuestionStatus = 'open' | 'answered'

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
}

export interface TimelineWorkspaceHypothesis {
  id: string
  afterEventId?: string
  beforeEventId?: string
  hypothesis: string
  rationale: string
  origin: 'ai'
}

export interface TimelineWorkspaceExport {
  schemaVersion: 'timeline-workspace.v1'
  exportedAt: string
  source: TimelineAnalysisResult
  analystWorkspace: {
    mode: TimelineWorkspaceMode
    events: TimelineWorkspaceEvent[]
    questions: TimelineWorkspaceQuestion[]
    hypotheses: TimelineWorkspaceHypothesis[]
  }
}
