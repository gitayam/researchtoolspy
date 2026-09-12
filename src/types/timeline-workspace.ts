import type {
  TimelineAnalysisResult,
  TimelineDatePrecision,
  TimelineEvent,
  TimelineEventCategory,
  TimelineEventImportance,
} from './timeline-analysis'

export type TimelineWorkspaceMode = 'basic' | 'robust'
export type TimelineNarrativeRole = 'context' | 'buildup' | 'turning_point' | 'response' | 'consequence' | 'resolution'
export interface TimelineNarrativeChapter {
  id: string
  title: string
  claim: string
}
export interface TimelineNarrative {
  title: string
  framing: string
  question: string
  intendedUse: string
  scope: string
  timezone: string
  dataThrough: string
  chapters: TimelineNarrativeChapter[]
}
export type TimelineEventAssessment = 'unreviewed' | 'corroborated' | 'disputed' | 'hypothesis'
export type TimelineQuestionStatus = 'open' | 'answered'
export type TimelineEventPlacement =
  | { mode: 'absolute' }
  | { mode: 'relative', relation: 'before' | 'after', anchorEventId: string }
  | { mode: 'position', position: number }

export interface TimelineSourceReference {
  id: string
  url: string
  title?: string
}

export interface TimelineWorkspaceEvent {
  id: string
  eventDate?: string
  eventTime?: string
  datePrecision?: TimelineDatePrecision
  title: string
  description: string | null
  category: TimelineEventCategory
  importance: TimelineEventImportance
  origin: 'source' | 'analyst'
  assessment: TimelineEventAssessment
  analystNote: string
  modified: boolean
  sequenceOrder?: number
  placement?: TimelineEventPlacement
  original?: TimelineEvent
  narrativeIncluded?: boolean
  narrativeRole?: TimelineNarrativeRole
  whyItMatters?: string
  transition?: string
  chapterId?: string
  narrativeOrder?: number
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
  analysis?: TimelineJudgments
  evidence?: TimelineEvidence
  mode: TimelineWorkspaceMode
  events: TimelineWorkspaceEvent[]
  questions: TimelineWorkspaceQuestion[]
  hypotheses: TimelineWorkspaceHypothesis[]
  narrative?: TimelineNarrative
  presentation?: 'analyst' | 'narrative'
  sortDirection?: 'oldest' | 'latest'
}

export interface TimelineJudgment {
  id: string
  claim: string
  scope: string
  asOf: string
  reasoning: string
  likelihood: { vocabulary: 'timeline-verbal.v1'; value: 'unassessed' | 'unlikely' | 'roughly_even' | 'likely' }
  analyticConfidence: 'unassessed' | 'low' | 'medium' | 'high'
  confidenceBasis: string
  assumptions: string[]
  alternatives: string[]
  changeIndicators: string[]
  eventRefs: string[]
  evidenceRefs: string[]
  contraryEvidenceRefs: string[]
  status: 'active' | 'withdrawn'
  changeReason: string
  updatedAt: string
  basis: string
}
export interface TimelineJudgmentReview {
  id: string
  judgmentId: string
  reviewerLabel: string
  position: 'agree' | 'challenge' | 'dissent'
  rationale: string
  alternative: string
  createdAt: string
  basis: string
}
export interface TimelineJudgments {
  schemaVersion: 'timeline-judgments.v1'
  judgments: TimelineJudgment[]
  reviews: TimelineJudgmentReview[]
}

export interface TimelineEvidenceSource {
  id: string
  url: string
  title: string
  publisher: string
  publishedAt?: string
  retrievedAt?: string
}
export interface TimelineSourceAssertion {
  id: string
  sourceId: string
  claimText: string
  temporalClaim: string
  passage: { id: string; quote: string; locator: string }
  status: 'active' | 'retracted'
  derivesFrom: string[]
  observedAt?: string
  reportedAt?: string
}
export interface TimelineEvidenceLink {
  id: string
  eventId: string
  assertionId: string
  relation: 'supports' | 'contradicts' | 'context'
}
export interface TimelineEvidenceReview {
  eventId: string
  independence: 'independent' | 'dependent' | 'unresolved'
  compatibility: 'compatible' | 'incompatible' | 'unresolved'
  rationale: string
  reviewedAt: string
  basis: string
}
export interface TimelineEvidence {
  schemaVersion: 'timeline-evidence.v1'
  sources: TimelineEvidenceSource[]
  assertions: TimelineSourceAssertion[]
  links: TimelineEvidenceLink[]
  reviews: TimelineEvidenceReview[]
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
