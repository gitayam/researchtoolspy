import type { TimelineAnalysisResult } from './timeline-analysis'
import type { TimelineEventAssessment, TimelineWorkspaceEvent } from './timeline-workspace'

export type TimelineAssistAction = 'identify_gaps' | 'suggest_questions' | 'generate_hypotheses'
export type TimelineAssistSuggestionKind = 'question' | 'hypothesis'

export interface TimelineAssistInput {
  action: TimelineAssistAction
  article: TimelineAnalysisResult['article']
  events: TimelineWorkspaceEvent[]
  focus?: {
    afterEventId?: string
    beforeEventId?: string
    question?: string
  }
}

export interface TimelineAssistSuggestion {
  id: string
  kind: TimelineAssistSuggestionKind
  content: string
  rationale: string
  afterEventId?: string
  beforeEventId?: string
}

export interface TimelineAssistResult {
  schemaVersion: 'timeline-assist.v1'
  requestId: string
  action: TimelineAssistAction
  outcome: 'suggestions' | 'no_suggestions' | 'declined'
  suggestions: TimelineAssistSuggestion[]
  model: {
    name: string
    status: 'ok' | 'no_suggestions' | 'declined'
    rejectedSuggestionCount: number
  }
}

export interface TimelineAssistRequestEvent {
  id: string
  eventDate?: string
  eventTime?: string
  positionLabel: string
  title: string
  description?: string | null
  origin: TimelineWorkspaceEvent['origin']
  assessment: TimelineEventAssessment
  analystNote?: string
}
