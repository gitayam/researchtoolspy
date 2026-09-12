import { timelineSourceEvaluationNeedsReview } from '@/lib/timeline-source-evaluation'
import './timeline-workspace.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  Brain,
  Calendar,
  Check,
  CircleHelp,
  Clock3,
  Copy,
  ExternalLink,
  FileSearch,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TimelineEvidence } from './TimelineEvidence'
import { timelineAssessmentLabel, timelineCorroboration, validateTimelineEvidence } from '@/lib/timeline-evidence'
import { TimelineJudgments } from './TimelineJudgments'
import { timelineJudgmentNeedsReview, timelineJudgmentReviewBasis, validateTimelineJudgments } from '@/lib/timeline-judgments'
import { TimelineNarrative } from './TimelineNarrative'
import { TIMELINE_IMPORT_MAX_BYTES } from '@/lib/timeline-workspace-codec'
import { inferTimelineDatePrecision } from '@/lib/timeline-analysis'
import { assistTimeline, TimelineAssistError } from '@/lib/timeline-assist'
import {
  normalizeTimelineEventOrder,
  orderTimelineEvents,
  placeTimelineEvent,
  removeTimelineEvent,
  timelineEventTemporalLabel,
  timelineEventAnchor,
  withTimelineNarrativeDefaults,
} from '@/lib/timeline-workspace'
import type {
  TimelineAnalysisResult,
  TimelineEventCategory,
  TimelineEventImportance,
} from '@/types/timeline-analysis'
import type { TimelineAssistAction, TimelineAssistInput, TimelineAssistSuggestion } from '@/types/timeline-assist'
import type {
  TimelineEvidence as Evidence,
  TimelineJudgments as Analysis,
  TimelineEventAssessment,
  TimelineEventPlacement,
  TimelineWorkspaceEvent,
  TimelineWorkspaceExport,
  TimelineWorkspaceHypothesis,
  TimelineWorkspaceMode,
  TimelineWorkspaceQuestion,
  TimelineWorkspaceState,
  TimelineSourceReference,
  TimelineQuestionStatus,
} from '@/types/timeline-workspace'

interface TimelineResultsProps {
  result: TimelineAnalysisResult
  onRegenerate?: () => void
  regenerating?: boolean
  workspaceOrigin?: 'extracted' | 'manual'
  initialWorkspace?: TimelineWorkspaceState
  onWorkspaceChange?: (workspace: TimelineWorkspaceState) => void
  sourceImportWorkspaceId?: string
}

interface EventEditorState {
  eventId?: string
  eventDate: string
  eventTime: string
  placementMode: TimelineEventPlacement['mode']
  relativeRelation: 'before' | 'after'
  anchorEventId: string
  positionChoice: 'first' | 'second' | 'third' | 'second_to_last' | 'last' | 'custom'
  positionNumber: string
  title: string
  description: string
  category: TimelineEventCategory
  importance: TimelineEventImportance
  assessment: TimelineEventAssessment
  analystNote: string
}

interface QuestionEditorState {
  questionId?: string
  afterEventId?: string
  beforeEventId?: string
  question: string
  status: TimelineQuestionStatus
  answer: string
  sources: TimelineSourceReference[]
  newSourceUrl: string
  newSourceTitle: string
}

type TimelineSortDirection = 'oldest' | 'latest'

type TimelineSequenceItem =
  | { kind: 'event', event: TimelineWorkspaceEvent, sequenceIndex: number }
  | { kind: 'gap', previous?: TimelineWorkspaceEvent, next?: TimelineWorkspaceEvent }

const importanceClasses: Record<TimelineEventImportance, string> = {
  low: 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300',
  normal: 'border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300',
  high: 'border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-300',
  critical: 'border-red-400 text-red-700 dark:border-red-800 dark:text-red-300',
}

const assessmentClasses: Record<TimelineEventAssessment, string> = {
  unreviewed: 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300',
  corroborated: 'border-emerald-400 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300',
  disputed: 'border-red-400 text-red-700 dark:border-red-800 dark:text-red-300',
  hypothesis: 'border-purple-400 text-purple-700 dark:border-purple-700 dark:text-purple-300',
}

const categories: TimelineEventCategory[] = [
  'event',
  'meeting',
  'communication',
  'financial',
  'legal',
  'travel',
  'publication',
  'military',
  'political',
]

const importanceLevels: TimelineEventImportance[] = ['low', 'normal', 'high', 'critical']
const assessmentLevels: TimelineEventAssessment[] = ['unreviewed', 'corroborated', 'disputed', 'hypothesis']

function createId(prefix: string): string {
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${randomId}`
}

function workspaceEvents(result: TimelineAnalysisResult): TimelineWorkspaceEvent[] {
  return result.events.map((event, index) => ({
    ...event,
    id: `source-${result.requestId}-${index}`,
    origin: 'source',
    assessment: 'unreviewed',
    analystNote: '',
    modified: false,
    sequenceOrder: index,
    placement: { mode: 'absolute' },
  }))
}

function timelineMarkdown(
  result: TimelineAnalysisResult,
  events: TimelineWorkspaceEvent[],
  questions: TimelineWorkspaceQuestion[],
  hypotheses: TimelineWorkspaceHypothesis[],
  workspaceOrigin: 'extracted' | 'manual',
  evidence?: Evidence,
  analysis?: Analysis,
  allEvents: TimelineWorkspaceEvent[] = events,
): string {
  const lines = [
    `# ${result.article.title}`,
    '',
    workspaceOrigin === 'manual' ? 'Origin: Analyst-created timeline' : `Source: ${result.article.url}`,
    '',
  ]
  for (const event of events) {
    const provenance = event.origin === 'source'
      ? event.modified ? 'source extraction, analyst edited' : 'source extraction'
      : 'analyst added'
    lines.push(`- **${timelineEventTemporalLabel(event)}** — ${event.title} _[${provenance}; ${timelineAssessmentLabel(evidence, event)}]_`)
    if (event.description) lines.push(`  ${event.description}`)
    if (event.analystNote) lines.push(`  Analyst note: ${event.analystNote}`)
    for (const link of evidence?.links.filter(item => item.eventId === event.id) ?? []) {
      const assertion = evidence!.assertions.find(item => item.id === link.assertionId)!
      const source = evidence!.sources.find(item => item.id === assertion.sourceId)!
      lines.push(`  Evidence (${link.relation}; ${assertion.status}; analyst recorded): ${assertion.claimText}`, `  Source: ${source.title} — ${source.url}`, `  Quote: ${assertion.passage.quote}`, `  Locator: ${assertion.passage.locator}`, `  Type (analyst classified): ${assertion.epistemicType?.replace('_', ' ') || 'Unclassified'}`, `  Temporal claim: ${assertion.temporalClaim}`, `  Derives from: ${assertion.derivesFrom.join(', ') || 'None recorded; independence not implied'}`)
      if (assertion.evaluation) {
        lines.push(`Source evaluation (analyst-entered): ${timelineSourceEvaluationNeedsReview(evidence!, assertion.id) ? 'needs review; inputs changed' : 'matches recorded inputs'}; recorded ${assertion.evaluation.reviewedAt}`)
        for (const factor of ['access', 'reliability', 'credibility', 'currency', 'completeness', 'bias', 'deception'] as const) lines.push(`  ${factor}: ${assertion.evaluation[factor].value} — ${assertion.evaluation[factor].rationale || 'No rationale recorded'}`)
      }
    }
  }
  if (events.length === 0) lines.push('No timeline events are currently included.')
  if (questions.length > 0) {
    lines.push('', '## Analyst questions', '')
    for (const question of questions) {
      lines.push(`- [${question.status === 'answered' ? 'x' : ' '}] ${question.question}`)
      if (question.answer) lines.push(`  Answer: ${question.answer}`)
      for (const source of question.sources || []) {
        lines.push(`  Source: ${source.title ? `${source.title} — ` : ''}${source.url}`)
      }
    }
  }
  if (hypotheses.length > 0) {
    lines.push('', '## Working hypotheses', '')
    for (const hypothesis of hypotheses) {
      lines.push(`- ${hypothesis.hypothesis} _[AI suggested; analyst retained as hypothesis]_`)
      if (hypothesis.rationale) lines.push(`  Test: ${hypothesis.rationale}`)
    }
  }
  if (analysis?.judgments.length) {
    lines.push('', '## Analytic judgments and retained dissent', '', 'Likelihood uses a local verbal vocabulary. Analytical confidence is separate; reviewer labels are self-attributed, not verified identities.')
    for (const judgment of analysis.judgments) {
      lines.push('', `### ${judgment.claim}`, `Status: ${judgment.status}; as of ${judgment.asOf}; updated ${judgment.updatedAt}`, `Scope: ${judgment.scope}`, `Reasoning: ${judgment.reasoning}`, `Likelihood: ${judgment.likelihood.value} (${judgment.likelihood.vocabulary})`, `Analytical confidence: ${judgment.analyticConfidence}`, `Confidence basis: ${judgment.confidenceBasis}`, `Assumptions: ${judgment.assumptions.join('; ')}`, `Alternatives: ${judgment.alternatives.join('; ')}`, `Change indicators: ${judgment.changeIndicators.join('; ')}`, `Change reason: ${judgment.changeReason}`, `Event references: ${judgment.eventRefs.join(', ')}`, `Cited assertions: ${judgment.evidenceRefs.join(', ')}`, `Contrary assertions: ${judgment.contraryEvidenceRefs.join(', ')}`)
      if (timelineJudgmentNeedsReview(judgment, allEvents, evidence)) lines.push('Judgment inputs changed; review needed.')
      for (const assertion of evidence?.assertions.filter(item => judgment.evidenceRefs.includes(item.id) || judgment.contraryEvidenceRefs.includes(item.id)) ?? []) {
        const source = evidence!.sources.find(item => item.id === assertion.sourceId)!
        lines.push(`Source wording (${judgment.contraryEvidenceRefs.includes(assertion.id) ? 'contrary' : 'cited'}; ${assertion.status}): ${assertion.claimText}`, `Source: ${source.title} — ${source.url}`, `Quote: ${assertion.passage.quote}`, `Locator: ${assertion.passage.locator}`, `Type (analyst classified): ${assertion.epistemicType?.replace('_', ' ') || 'Unclassified'}`)
        if (assertion.evaluation) {
          lines.push(`Source evaluation (analyst-entered): ${timelineSourceEvaluationNeedsReview(evidence!, assertion.id) ? 'needs review; inputs changed' : 'matches recorded inputs'}; recorded ${assertion.evaluation.reviewedAt}`)
          for (const factor of ['access', 'reliability', 'credibility', 'currency', 'completeness', 'bias', 'deception'] as const) lines.push(`  ${factor}: ${assertion.evaluation[factor].value} — ${assertion.evaluation[factor].rationale || 'No rationale recorded'}`)
        }
      }
      for (const review of analysis.reviews.filter(item => item.judgmentId === judgment.id)) {
        lines.push(`Review: ${review.position} by ${review.reviewerLabel} (self-attributed), ${review.createdAt}`, review.rationale, `Alternative: ${review.alternative}`)
        if (review.basis !== timelineJudgmentReviewBasis(judgment)) lines.push('Review concerns an earlier judgment version.')
        lines.push(`Reviewed judgment snapshot: ${review.basis}`)
      }
    }
  }
  return lines.join('\n')
}

function selectClasses(): string {
  return 'flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950'
}

function gapLabel(previous?: TimelineWorkspaceEvent, next?: TimelineWorkspaceEvent): string {
  if (!previous && next) return `before ${timelineEventTemporalLabel(next)}`
  if (previous && !next) return `after ${timelineEventTemporalLabel(previous)}`
  if (previous && next) return `between ${timelineEventTemporalLabel(previous)} and ${timelineEventTemporalLabel(next)}`
  return 'in this timeline'
}

function positionChoiceFor(position: number, eventCount: number): EventEditorState['positionChoice'] {
  if (position === 1) return 'first'
  if (position === 2) return 'second'
  if (position === 3) return 'third'
  if (position === eventCount) return 'last'
  if (position === Math.max(1, eventCount - 1)) return 'second_to_last'
  return 'custom'
}

function resolvePosition(editor: EventEditorState, availableEventCount: number): number | null {
  const maximum = availableEventCount + 1
  if (editor.positionChoice === 'first') return 1
  if (editor.positionChoice === 'second') return Math.min(2, maximum)
  if (editor.positionChoice === 'third') return Math.min(3, maximum)
  if (editor.positionChoice === 'second_to_last') return Math.max(1, maximum - 1)
  if (editor.positionChoice === 'last') return maximum
  const position = Number(editor.positionNumber)
  return Number.isInteger(position) && position >= 1 && position <= maximum ? position : null
}

export function TimelineResults(props: TimelineResultsProps) {
  return <TimelineWorkspace key={props.result.requestId} {...props} />
}

function TimelineWorkspace({
  result,
  onRegenerate,
  regenerating = false,
  workspaceOrigin = 'extracted',
  initialWorkspace,
  onWorkspaceChange,
  sourceImportWorkspaceId,
}: TimelineResultsProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [mode, setMode] = useState<TimelineWorkspaceMode>(() => initialWorkspace?.mode || (workspaceOrigin === 'manual' ? 'robust' : 'basic'))
  const [initialState] = useState(() => withTimelineNarrativeDefaults(initialWorkspace ?? {
    mode: workspaceOrigin === 'manual' ? 'robust' : 'basic', events: workspaceEvents(result), questions: [], hypotheses: [],
  }, result.article.title))
  const [narrative, writeNarrative] = useState(initialState.narrative!)
  const [presentation, setPresentation] = useState(initialState.presentation!)
  const [events, writeEvents] = useState<TimelineWorkspaceEvent[]>(() => (
    initialWorkspace ? initialState.events : normalizeTimelineEventOrder(initialState.events)
  ))
  const [questions, writeQuestions] = useState<TimelineWorkspaceQuestion[]>(() => initialWorkspace?.questions || [])
  const [hypotheses, writeHypotheses] = useState<TimelineWorkspaceHypothesis[]>(() => initialWorkspace?.hypotheses || [])
  const [analysis, writeAnalysis] = useState<Analysis | undefined>(initialState.analysis)
  const [evidence, writeEvidence] = useState<Evidence | undefined>(initialState.evidence)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  const [eventEditor, setEventEditor] = useState<EventEditorState | null>(null)
  const [questionEditor, setQuestionEditor] = useState<QuestionEditorState | null>(null)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [assistAction, setAssistAction] = useState<TimelineAssistAction>('identify_gaps')
  const [assistSuggestions, setAssistSuggestions] = useState<TimelineAssistSuggestion[]>([])
  const [assistLoading, setAssistLoading] = useState(false)
  const [assistError, setAssistError] = useState<string | null>(null)
  const [eventQuery, setEventQuery] = useState('')
  const [sortDirection, setSortDirection] = useState<TimelineSortDirection>(initialState.sortDirection!)
  function boundedSetter<T>(key: string, current: T, write: Dispatch<SetStateAction<T>>): Dispatch<SetStateAction<T>> {
    return update => {
      const next = typeof update === 'function' ? (update as (value: T) => T)(current) : update
      const payload = {
        schemaVersion: 'timeline-workspace.v1', exportedAt: new Date().toISOString(),
        source: workspaceOrigin === 'manual' ? { schemaVersion: 'timeline-manual.v1', title: result.article.title } : result,
        analystWorkspace: { mode, events, questions, hypotheses, narrative, presentation, sortDirection, ...(evidence ? { evidence } : {}), ...(analysis ? { analysis } : {}), [key]: next },
      }
      if (new TextEncoder().encode(JSON.stringify(payload, null, 2)).byteLength > TIMELINE_IMPORT_MAX_BYTES) {
        setWorkspaceError('This change exceeds the 4 MiB local timeline limit and was not saved. Shorten the content or remove an item before retrying.')
        return
      }
      setWorkspaceError(null)
      write(next)
    }
  }
  function saveEvidence(next: Evidence): boolean {
    try { validateTimelineEvidence(next, events.map(event => event.id)) } catch { return false }
    const payload = { schemaVersion: 'timeline-workspace.v1', exportedAt: new Date().toISOString(), source: workspaceOrigin === 'manual' ? { schemaVersion: 'timeline-manual.v1', title: result.article.title } : result, analystWorkspace: { mode, events, questions, hypotheses, narrative, presentation, sortDirection, evidence: next, ...(analysis ? { analysis } : {}) } }
    if (new TextEncoder().encode(JSON.stringify(payload, null, 2)).byteLength > TIMELINE_IMPORT_MAX_BYTES) {
      setWorkspaceError('This evidence exceeds the 4 MiB local timeline limit and was not saved.'); return false
    }
    setWorkspaceError(null); writeEvidence(next); return true
  }
  function saveAnalysis(next: Analysis): boolean {
    try { validateTimelineJudgments(next, events, evidence) } catch { return false }
    const payload = { schemaVersion: 'timeline-workspace.v1', exportedAt: new Date().toISOString(), source: workspaceOrigin === 'manual' ? { schemaVersion: 'timeline-manual.v1', title: result.article.title } : result, analystWorkspace: { mode, events, questions, hypotheses, narrative, presentation, sortDirection, ...(evidence ? { evidence } : {}), analysis: next } }
    if (new TextEncoder().encode(JSON.stringify(payload, null, 2)).byteLength > TIMELINE_IMPORT_MAX_BYTES) { setWorkspaceError('This judgment change exceeds the 4 MiB local timeline limit and was not saved.'); return false }
    setWorkspaceError(null); writeAnalysis(next); return true
  }
  const setEvents: Dispatch<SetStateAction<TimelineWorkspaceEvent[]>> = update => {
    const next = typeof update === 'function' ? update(events) : update
    const ids = new Set(next.map(event => event.id))
    if (analysis?.judgments.some(judgment => judgment.eventRefs.some(id => !ids.has(id)))) { setWorkspaceError('An analytic judgment cites this event. Edit its references before removing the event, including references in withdrawn judgments.'); return }
    const nextEvidence = evidence ? { ...evidence, links: evidence.links.filter(link => ids.has(link.eventId)), reviews: evidence.reviews.filter(review => ids.has(review.eventId)) } : undefined
    const payload = { schemaVersion: 'timeline-workspace.v1', exportedAt: new Date().toISOString(), source: workspaceOrigin === 'manual' ? { schemaVersion: 'timeline-manual.v1', title: result.article.title } : result, analystWorkspace: { mode, events: next, questions, hypotheses, narrative, presentation, sortDirection, ...(nextEvidence ? { evidence: nextEvidence } : {}), ...(analysis ? { analysis } : {}) } }
    if (new TextEncoder().encode(JSON.stringify(payload, null, 2)).byteLength > TIMELINE_IMPORT_MAX_BYTES) { setWorkspaceError('This change exceeds the 4 MiB local timeline limit and was not saved.'); return }
    setWorkspaceError(null); writeEvents(next); writeEvidence(nextEvidence)
  }
  const setQuestions = boundedSetter('questions', questions, writeQuestions)
  const setHypotheses = boundedSetter('hypotheses', hypotheses, writeHypotheses)
  const setNarrative = boundedSetter('narrative', narrative, writeNarrative)
  const copyResetRef = useRef<number | null>(null)
  const assistRequestRef = useRef<AbortController | null>(null)
  const sortedEvents = useMemo(() => orderTimelineEvents(events), [events])
  const displayedEvents = useMemo(
    () => sortDirection === 'latest' ? [...sortedEvents].reverse() : sortedEvents,
    [sortDirection, sortedEvents],
  )
  const eventAnchorIds = useMemo(
    () => new Map(sortedEvents.map(event => [event.id, timelineEventAnchor(event.id)])),
    [sortedEvents],
  )
  const displayedSequence = useMemo(() => {
    const sequence: TimelineSequenceItem[] = [{ kind: 'gap', next: sortedEvents[0] }]
    sortedEvents.forEach((event, sequenceIndex) => {
      sequence.push({ kind: 'event', event, sequenceIndex })
      sequence.push({ kind: 'gap', previous: event, next: sortedEvents[sequenceIndex + 1] })
    })
    return sortDirection === 'latest' ? sequence.reverse() : sequence
  }, [sortDirection, sortedEvents])
  const firstOpenQuestion = questions.find(question => question.status === 'open')

  useEffect(() => () => {
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current)
    assistRequestRef.current?.abort()
  }, [])

  useEffect(() => {
    onWorkspaceChange?.({ mode, events, questions, hypotheses, narrative, presentation, sortDirection, ...(evidence ? { evidence } : {}), ...(analysis ? { analysis } : {}) })
  }, [events, hypotheses, mode, onWorkspaceChange, questions, narrative, presentation, sortDirection, evidence, analysis])

  const copyTimeline = async () => {
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(timelineMarkdown(result, displayedEvents, questions, hypotheses, workspaceOrigin, evidence, analysis, events))
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
    copyResetRef.current = window.setTimeout(() => setCopyStatus('idle'), 1600)
  }

  const exportWorkspace = () => {
    const payload: TimelineWorkspaceExport = {
      schemaVersion: 'timeline-workspace.v1',
      exportedAt: new Date().toISOString(),
      source: workspaceOrigin === 'manual'
        ? { schemaVersion: 'timeline-manual.v1', title: result.article.title }
        : result,
      analystWorkspace: { mode, events: sortedEvents, questions, hypotheses, narrative, presentation, sortDirection, ...(evidence ? { evidence } : {}), ...(analysis ? { analysis } : {}) },
    }
    const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    const safeDomain = (result.article.domain || 'analyst-workspace').replace(/[^a-z0-9.-]+/gi, '-')
    const safeRequestId = result.requestId.replace(/[^a-z0-9_-]+/gi, '-')
    anchor.download = `timeline-${safeDomain}-${safeRequestId}.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0)
  }

  const openAddEvent = (placement?: { anchorEventId: string, relation: 'before' | 'after' }) => {
    setEditorError(null)
    setEventEditor({
      eventDate: '',
      eventTime: '',
      placementMode: placement ? 'relative' : 'absolute',
      relativeRelation: placement?.relation || 'after',
      anchorEventId: placement?.anchorEventId || sortedEvents[0]?.id || '',
      positionChoice: sortedEvents.length === 0 ? 'first' : 'last',
      positionNumber: String(sortedEvents.length + 1),
      title: '',
      description: '',
      category: 'event',
      importance: 'normal',
      assessment: 'unreviewed',
      analystNote: '',
    })
  }

  const openEditEvent = (event: TimelineWorkspaceEvent) => {
    const placement = event.placement || { mode: 'absolute' as const }
    const currentPosition = sortedEvents.findIndex(candidate => candidate.id === event.id) + 1
    setEditorError(null)
    setEventEditor({
      eventId: event.id,
      eventDate: event.eventDate || '',
      eventTime: event.eventTime || '',
      placementMode: placement.mode,
      relativeRelation: placement.mode === 'relative' ? placement.relation : 'after',
      anchorEventId: placement.mode === 'relative'
        ? placement.anchorEventId
        : sortedEvents.find(candidate => candidate.id !== event.id)?.id || '',
      positionChoice: positionChoiceFor(
        placement.mode === 'position' ? placement.position : currentPosition,
        sortedEvents.length,
      ),
      positionNumber: String(placement.mode === 'position' ? placement.position : currentPosition),
      title: event.title,
      description: event.description || '',
      category: event.category,
      importance: event.importance,
      assessment: event.assessment,
      analystNote: event.analystNote,
    })
  }

  const saveEvent = () => {
    if (!eventEditor) return
    if (!eventEditor.eventId && events.length >= 1000) {
      setEditorError('This local timeline supports up to 1,000 events. Export or remove an event before adding another.')
      return
    }
    const eventDate = eventEditor.eventDate.trim()
    const eventTime = eventEditor.eventTime.trim()
    const title = eventEditor.title.trim()
    const description = eventEditor.description.trim()
    const analystNote = eventEditor.analystNote.trim()
    const datePrecision = eventDate ? inferTimelineDatePrecision(eventDate) : undefined
    if (eventDate && !datePrecision) {
      setEditorError('Use a real date in YYYY, YYYY-MM, or YYYY-MM-DD format.')
      return
    }
    if (eventTime && !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(eventTime)) {
      setEditorError('Use a real time in 24-hour HH:MM or HH:MM:SS format.')
      return
    }
    if (eventEditor.placementMode === 'absolute' && !eventDate && !eventTime) {
      setEditorError('Add a date or time, or choose a relative or sequence placement.')
      return
    }
    if (!title) {
      setEditorError('Give the event a title.')
      return
    }
    if (title.length > 200 || description.length > 500 || analystNote.length > 2000) {
      setEditorError('Keep the title under 200 characters, description under 500, and analyst note under 2,000.')
      return
    }

    const availableEvents = sortedEvents.filter(event => event.id !== eventEditor.eventId)
    let placement: TimelineEventPlacement
    if (eventEditor.placementMode === 'relative') {
      if (!eventEditor.anchorEventId || !availableEvents.some(event => event.id === eventEditor.anchorEventId)) {
        setEditorError('Choose an existing event to place this event before or after.')
        return
      }
      placement = {
        mode: 'relative',
        relation: eventEditor.relativeRelation,
        anchorEventId: eventEditor.anchorEventId,
      }
    } else if (eventEditor.placementMode === 'position') {
      const position = resolvePosition(eventEditor, availableEvents.length)
      if (!position) {
        setEditorError(`Use a sequence position from 1 to ${availableEvents.length + 1}.`)
        return
      }
      placement = { mode: 'position', position }
    } else {
      placement = { mode: 'absolute' }
    }

    const prior = events.find(event => event.id === eventEditor.eventId)
    const preserveAbsentPlacement = !!prior && prior.placement === undefined && placement.mode === 'absolute'
    if (eventEditor.assessment === 'corroborated') {
      const candidate = prior ? { ...prior, title, description: description || null, eventDate: eventDate || undefined, eventTime: eventTime || undefined, datePrecision, placement: preserveAbsentPlacement ? undefined : placement } : undefined
      if (!candidate || !timelineCorroboration(evidence, candidate).eligible) {
        setEditorError('Corroboration needs a current independence and compatibility review of this event and its supporting assertions.'); return
      }
    }

    if (eventEditor.eventId) {
      setEvents(current => {
        const event = current.find(candidate => candidate.id === eventEditor.eventId)
        if (!event) return current
        const contentChanged = (event.eventDate || '') !== eventDate
          || (event.eventTime || '') !== eventTime
          || event.title !== title
          || (event.description || '') !== description
          || event.category !== eventEditor.category
          || event.importance !== eventEditor.importance
        const placementChanged = JSON.stringify(event.placement || { mode: 'absolute' }) !== JSON.stringify(placement)
        const nextEvent: TimelineWorkspaceEvent = {
          ...event,
          eventDate: eventDate || undefined,
          eventTime: eventTime || undefined,
          datePrecision,
          title,
          description: description || null,
          category: eventEditor.category,
          importance: eventEditor.importance,
          assessment: eventEditor.assessment,
          analystNote,
          modified: event.modified || contentChanged || placementChanged,
          original: event.original || (event.origin === 'source' && contentChanged && event.eventDate && event.datePrecision
              ? {
                  eventDate: event.eventDate,
                  datePrecision: event.datePrecision,
                  title: event.title,
                  description: event.description,
                  category: event.category,
                  importance: event.importance,
                }
            : undefined),
        }
        const placed = placeTimelineEvent(current, nextEvent, placement)
        // Legacy absolute placement can be implicit. Preserve its wire shape so
        // an assessment-only edit does not invalidate the recorded review basis.
        return preserveAbsentPlacement ? placed.map(item => {
          if (item.id !== nextEvent.id) return item
          const { placement: _placement, ...rest } = item
          return rest
        }) : placed
      })
    } else {
      setEvents(current => placeTimelineEvent(current, {
        id: createId('analyst'),
        narrativeIncluded: current.filter(event => event.narrativeIncluded).length < 20,
        narrativeOrder: Math.max(-1, ...current.map(event => event.narrativeOrder ?? 0)) + 1,
        whyItMatters: '',
        transition: '',
        origin: 'analyst',
        assessment: eventEditor.assessment,
        analystNote,
        modified: false,
        eventDate: eventDate || undefined,
        eventTime: eventTime || undefined,
        datePrecision,
        title,
        description: description || null,
        category: eventEditor.category,
        importance: eventEditor.importance,
      }, placement))
    }
    setEventEditor(null)
    setEditorError(null)
  }

  const removeEvent = (eventId: string) => {
    if (analysis?.judgments.some(judgment => judgment.eventRefs.includes(eventId))) { setWorkspaceError('An analytic judgment cites this event. Edit its references before removing the event, including references in withdrawn judgments.'); return }
    const index = sortedEvents.findIndex(event => event.id === eventId)
    const previousId = index > 0 ? sortedEvents[index - 1].id : undefined
    const nextId = index >= 0 && index < sortedEvents.length - 1 ? sortedEvents[index + 1].id : undefined
    setEvents(current => removeTimelineEvent(current, eventId))
    setQuestions(current => current.map(question => ({
      ...question,
      afterEventId: question.afterEventId === eventId ? previousId : question.afterEventId,
      beforeEventId: question.beforeEventId === eventId ? nextId : question.beforeEventId,
    })))
    setHypotheses(current => current.map(hypothesis => ({
      ...hypothesis,
      afterEventId: hypothesis.afterEventId === eventId ? previousId : hypothesis.afterEventId,
      beforeEventId: hypothesis.beforeEventId === eventId ? nextId : hypothesis.beforeEventId,
    })))
  }

  const runAiAssist = async (focus?: TimelineAssistInput['focus']) => {
    if (sortedEvents.length === 0) {
      setAssistError('Add at least one event before using AI assistance.')
      return
    }
    assistRequestRef.current?.abort()
    const controller = new AbortController()
    assistRequestRef.current = controller
    setAssistLoading(true)
    setAssistError(null)
    setAssistSuggestions([])
    try {
      const response = await assistTimeline({
        action: assistAction,
        article: result.article,
        events: sortedEvents.map(event => event.assessment === 'corroborated' && !timelineCorroboration(evidence, event).eligible ? { ...event, assessment: 'unreviewed' as const } : event),
        ...(focus ? { focus } : {}),
      }, { signal: controller.signal })
      if (controller.signal.aborted) return
      if (response.outcome === 'declined') {
        setAssistError('The model declined this timeline review. Try another task or revise the working timeline.')
      } else if (response.outcome === 'no_suggestions') {
        setAssistError('The AI review did not identify a useful suggestion for this timeline.')
      } else {
        setAssistSuggestions(response.suggestions)
      }
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof TimelineAssistError && error.status === 429) {
        setAssistError('The AI review limit was reached. Try again shortly.')
      } else {
        setAssistError(error instanceof Error ? error.message : 'Timeline AI assistance failed.')
      }
    } finally {
      if (assistRequestRef.current === controller) {
        assistRequestRef.current = null
        setAssistLoading(false)
      }
    }
  }

  const keepSuggestion = (suggestion: TimelineAssistSuggestion) => {
    if ((suggestion.kind === 'question' && questions.length >= 1000)
      || (suggestion.kind === 'hypothesis' && hypotheses.length >= 1000)) {
      setAssistError('This local timeline supports up to 1,000 questions and 1,000 hypotheses. Remove an item before keeping another suggestion.')
      return
    }
    const currentEventIds = new Set(events.map(event => event.id))
    const afterEventId = suggestion.afterEventId && currentEventIds.has(suggestion.afterEventId)
      ? suggestion.afterEventId
      : undefined
    const beforeEventId = suggestion.beforeEventId && currentEventIds.has(suggestion.beforeEventId)
      ? suggestion.beforeEventId
      : undefined
    if (suggestion.kind === 'question') {
      setQuestions(current => current.some(item => item.question.toLocaleLowerCase('en-US') === suggestion.content.toLocaleLowerCase('en-US'))
        ? current
        : [...current, {
            id: createId('question'),
            afterEventId,
            beforeEventId,
            question: suggestion.content,
            status: 'open',
            answer: '',
          }])
    } else {
      setHypotheses(current => current.some(item => item.hypothesis.toLocaleLowerCase('en-US') === suggestion.content.toLocaleLowerCase('en-US'))
        ? current
        : [...current, {
            id: createId('hypothesis'),
            afterEventId,
            beforeEventId,
            hypothesis: suggestion.content,
            rationale: suggestion.rationale,
            origin: 'ai',
          }])
    }
    setAssistSuggestions(current => current.filter(item => item.id !== suggestion.id))
  }

  const openAddQuestion = (afterEventId?: string, beforeEventId?: string) => {
    const previous = sortedEvents.find(event => event.id === afterEventId)
    const next = sortedEvents.find(event => event.id === beforeEventId)
    setEditorError(null)
    setQuestionEditor({
      afterEventId,
      beforeEventId,
      question: `What happened ${gapLabel(previous, next)}?`,
      status: 'open',
      answer: '',
      sources: [],
      newSourceUrl: '',
      newSourceTitle: '',
    })
  }

  const openEditQuestion = (question: TimelineWorkspaceQuestion) => {
    setEditorError(null)
    setQuestionEditor({
      ...question,
      questionId: question.id,
      sources: question.sources || [],
      newSourceUrl: '',
      newSourceTitle: '',
    })
  }

  const saveQuestion = () => {
    if (!questionEditor) return
    if (!questionEditor.questionId && questions.length >= 1000) {
      setEditorError('This local timeline supports up to 1,000 questions. Remove a question before adding another.')
      return
    }
    const question = questionEditor.question.trim()
    const answer = questionEditor.answer.trim()
    const pendingSourceUrl = questionEditor.newSourceUrl.trim()
    const pendingSourceTitle = questionEditor.newSourceTitle.trim()
    if (!question) {
      setEditorError('Enter a research question.')
      return
    }
    if (question.length > 300 || answer.length > 2000 || pendingSourceUrl.length > 2048 || pendingSourceTitle.length > 300) {
      setEditorError('Keep the question under 300 characters, answer under 2,000, source URL under 2,048, and source title under 300.')
      return
    }
    let sources = questionEditor.sources
    if (pendingSourceUrl) {
      try {
        const parsedSource = new URL(pendingSourceUrl)
        if ((parsedSource.protocol !== 'http:' && parsedSource.protocol !== 'https:') || parsedSource.username || parsedSource.password) throw new Error('unsupported URL')
      } catch {
        setEditorError('Use a complete http:// or https:// URL without a username or password for the answer source.')
        return
      }
      if (!sources.some(source => source.url === pendingSourceUrl)) {
        if (sources.length >= 100) {
          setEditorError('A question supports up to 100 source references. Remove a reference before adding another.')
          return
        }
        sources = [...sources, {
          id: createId('source'),
          url: pendingSourceUrl,
          ...(pendingSourceTitle ? { title: pendingSourceTitle } : {}),
        }]
      }
    }
    const nextQuestion: TimelineWorkspaceQuestion = {
      id: questionEditor.questionId || createId('question'),
      afterEventId: questionEditor.afterEventId,
      beforeEventId: questionEditor.beforeEventId,
      question,
      answer,
      status: answer ? 'answered' : 'open',
      ...(sources.length > 0 ? { sources } : {}),
    }
    setQuestions(current => questionEditor.questionId
      ? current.map(item => item.id === questionEditor.questionId ? nextQuestion : item)
      : [...current, nextQuestion])
    setQuestionEditor(null)
    setEditorError(null)
  }

  const renderQuestion = (question: TimelineWorkspaceQuestion) => (
    <div key={question.id} className="timeline-question rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CircleHelp className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            <Badge variant="outline" className="border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-200">
              {question.status === 'answered' ? 'Answered' : 'Information gap'}
            </Badge>
          </div>
          <p className="mt-2 text-sm font-medium">{question.question}</p>
          {question.answer && <p className="mt-2 text-sm text-muted-foreground">{question.answer}</p>}
          {(question.sources || []).length > 0 && (
            <div className="mt-2 space-y-1">
              {(question.sources || []).map(source => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex max-w-full items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{source.title || source.url}</span>
                </a>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href={`/dashboard/tools/collection?query=${encodeURIComponent(question.question)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Search className="mr-1 h-3.5 w-3.5" />Research this question
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => openEditQuestion(question)} aria-label="Edit question">
              <Pencil className="mr-1 h-3.5 w-3.5" />{question.answer ? 'Update finding' : 'Record finding'}
            </Button>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => void runAiAssist({
              afterEventId: question.afterEventId,
              beforeEventId: question.beforeEventId,
              question: question.question,
            })}
            disabled={assistLoading}
            aria-label="AI review question"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-600"
            onClick={() => setQuestions(current => current.filter(item => item.id !== question.id))}
            aria-label="Remove question"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )

  const renderHypothesis = (hypothesis: TimelineWorkspaceHypothesis) => (
    <div key={hypothesis.id} className="rounded-lg border border-dashed border-amber-300 bg-amber-50/70 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300">AI working hypothesis</Badge>
          </div>
          <p className="mt-2 text-sm font-medium">{hypothesis.hypothesis}</p>
          {hypothesis.rationale && <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium">How to test:</span> {hypothesis.rationale}</p>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-red-600"
          onClick={() => setHypotheses(current => current.filter(item => item.id !== hypothesis.id))}
          aria-label="Remove hypothesis"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )

  const renderGap = (previous?: TimelineWorkspaceEvent, next?: TimelineWorkspaceEvent) => {
    if (mode !== 'robust') return null
    const gapQuestions = questions.filter(question => question.afterEventId === previous?.id)
    const gapHypotheses = hypotheses.filter(hypothesis => hypothesis.afterEventId === previous?.id)
    return (
      <li className="relative py-2" key={`gap-${previous?.id || 'start'}`}>
        <div className="timeline-gap space-y-2 rounded-lg border border-dashed p-3">
          {gapQuestions.map(renderQuestion)}
          {gapHypotheses.map(renderHypothesis)}
          <div className="flex flex-wrap items-center justify-center gap-1">
            <span className="mr-1 text-xs text-muted-foreground">{gapLabel(previous, next)}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openAddEvent(previous
                ? { anchorEventId: previous.id, relation: 'after' }
                : next
                  ? { anchorEventId: next.id, relation: 'before' }
                  : undefined)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />Add event here
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openAddQuestion(previous?.id, next?.id)}>
              <CircleHelp className="mr-1 h-3.5 w-3.5" />What happened here?
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void runAiAssist({ afterEventId: previous?.id, beforeEventId: next?.id })}
              disabled={assistLoading}
            >
              <Sparkles className="mr-1 h-3.5 w-3.5" />AI review this gap
            </Button>
          </div>
        </div>
      </li>
    )
  }

  return (
    <div className="timeline-results space-y-6" data-testid="timeline-results">
      {workspaceError && <p role="alert" className="rounded border border-red-300 p-3 text-sm text-red-700">{workspaceError}</p>}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Timeline presentation" data-timeline-toolbar="true">
        <Button aria-pressed={presentation === 'analyst'} variant={presentation === 'analyst' ? 'default' : 'outline'} onClick={() => setPresentation('analyst')}>Analyst view</Button>
        <Button aria-pressed={presentation === 'narrative'} variant={presentation === 'narrative' ? 'default' : 'outline'} onClick={() => setPresentation('narrative')}>Narrative view</Button>
        <Button variant="outline" onClick={exportWorkspace}>Export JSON</Button>
      </div>
      {presentation === 'analyst' && <nav aria-label="Workspace navigation" className="timeline-workspace-nav">
        <a href="#timeline-sequence"><Calendar aria-hidden="true"/><span><strong>Event sequence</strong><small>{events.length} events · {questions.filter(q=>q.status==='open').length} open {questions.filter(q=>q.status==='open').length===1?'question':'questions'}</small></span></a>
        <a href="#timeline-judgments"><Brain aria-hidden="true"/><span><strong>Judgments &amp; dissent</strong><small>Assess claims and competing explanations</small></span></a>
        <a href="#timeline-narrative-editor"><FileSearch aria-hidden="true"/><span><strong>Narrative editor</strong><small>Shape chapters and select key events</small></span></a>
      </nav>}
      <p className="text-xs text-muted-foreground">Event and chapter links refer to this open timeline or an imported copy; they are not published evidence URLs. Export JSON to keep an offline copy.</p>
      <div hidden={presentation !== 'analyst'} className="space-y-4">
      <Card id="timeline-overview" className="timeline-overview scroll-mt-24">
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{sortedEvents.length} {sortedEvents.length === 1 ? 'event' : 'events'}</Badge>
              {questions.length > 0 && <Badge variant="outline">{questions.length} {questions.length === 1 ? 'question' : 'questions'}</Badge>}
              {hypotheses.length > 0 && <Badge variant="outline">{hypotheses.length} {hypotheses.length === 1 ? 'hypothesis' : 'hypotheses'}</Badge>}
              {workspaceOrigin === 'manual' ? (
                <Badge variant="outline">Analyst-created</Badge>
              ) : (
                <>
                  <Badge variant="outline">{result.article.domain}</Badge>
                  <Badge variant="outline">{result.extraction.sourceMode}</Badge>
                </>
              )}
            </div>
            <CardTitle className="text-xl leading-tight">{result.article.title}</CardTitle>
            {result.article.url && (
              <a
                href={result.article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                <span className="truncate">{result.article.url}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => openAddEvent()}>
              <Plus className="mr-2 h-4 w-4" />Add event
            </Button>
            <Button variant="outline" size="sm" onClick={copyTimeline}>
              {copyStatus === 'copied' ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy'}
            </Button>
            {mode === 'robust' && (
              <>
                <Button variant="outline" size="sm" onClick={() => openAddQuestion()}>
                  <CircleHelp className="mr-2 h-4 w-4" />Add question
                </Button>
              </>
            )}
            {onRegenerate && (
              <Button variant="outline" size="sm" onClick={onRegenerate} disabled={regenerating}>
                <Clock3 className="mr-2 h-4 w-4" />Regenerate
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Analysis depth</p>
              <p className="text-xs text-muted-foreground">
                {mode === 'basic'
                  ? 'A clean chronology with lightweight event editing.'
                  : 'Track provenance, review status, notes, information gaps, and answers.'}
              </p>
            </div>
            <div className="flex rounded-md border bg-background p-1" role="group" aria-label="Timeline analysis depth">
              <Button size="sm" variant={mode === 'basic' ? 'default' : 'ghost'} aria-pressed={mode === 'basic'} onClick={() => setMode('basic')}>
                Basic
              </Button>
              <Button size="sm" variant={mode === 'robust' ? 'default' : 'ghost'} aria-pressed={mode === 'robust'} onClick={() => setMode('robust')}>
                Robust analyst
              </Button>
            </div>
          </div>
          {workspaceOrigin === 'manual' ? (
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="font-medium">Known events</div>
                <p className="mt-1 text-muted-foreground">Add only what you currently know; mark uncertainty in the assessment and note.</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="font-medium">Information gaps</div>
                <p className="mt-1 text-muted-foreground">Place questions before, between, or after events instead of inventing transitions.</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="font-medium">Research findings</div>
                <p className="mt-1 text-muted-foreground">Record answers here with source URLs, then add supported events separately.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-2 font-medium"><FileSearch className="h-4 w-4" />Content source</div>
                  <p className="mt-1 text-muted-foreground">{result.extraction.contentSource}</p>
                  {result.extraction.method && <p className="mt-1 text-xs text-muted-foreground">Method: {result.extraction.method}</p>}
                  {result.extraction.fallbackAttempts.length > 1 && (
                    <p className="mt-1 text-xs text-muted-foreground">Tried: {result.extraction.fallbackAttempts.join(' → ')}</p>
                  )}
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" />Extraction quality</div>
                  <p className="mt-1 text-muted-foreground">{Math.round(result.extraction.quality.score)}% · {result.extraction.wordCount.toLocaleString()} words</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-2 font-medium"><Calendar className="h-4 w-4" />Published</div>
                  <p className="mt-1 text-muted-foreground">{result.article.publishedAt || 'Not reliably available'}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Analyst edits are kept separate from the extraction result and reset when you regenerate. Copy or export the working timeline first.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card aria-label="Timeline contents" className="timeline-contents">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Timeline contents</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Choose the reading order, scan the events, or jump directly to a section.</p>
          </div>
          <div className="w-full space-y-1 sm:w-40">
            <Label htmlFor="timeline-sort-direction" className="text-xs">Sort events</Label>
            <select
              id="timeline-sort-direction"
              className={selectClasses()}
              value={sortDirection}
              onChange={event => setSortDirection(event.target.value as TimelineSortDirection)}
            >
              <option value="oldest">Oldest first</option>
              <option value="latest">Latest first</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
          <nav aria-label="Timeline sections">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Jump to section</p>
            <ul className="space-y-1 text-sm">
              <li><a className="text-blue-600 hover:underline dark:text-blue-400" href="#timeline-overview">Overview</a></li>
              {mode === 'robust' && <li><a className="text-blue-600 hover:underline dark:text-blue-400" href="#timeline-ai-review">AI review</a></li>}
              <li><a className="text-blue-600 hover:underline dark:text-blue-400" href="#timeline-sequence">Event sequence</a></li>
              {mode === 'robust' && <li><a className="text-blue-600 hover:underline dark:text-blue-400" href="#timeline-next-steps">Continue investigation</a></li>}
            </ul>
          </nav>
          <nav aria-label="Timeline events">
            <Label htmlFor="timeline-find-event" className="text-xs">Find an event</Label>
            <Input id="timeline-find-event" type="search" className="mb-3 mt-1 bg-background" placeholder="Search titles or dates…" value={eventQuery} onChange={event=>setEventQuery(event.target.value)}/>
            {eventQuery.trim() && <p role="status" className="mb-2 text-xs text-muted-foreground">{displayedEvents.filter(event=>`${event.title} ${timelineEventTemporalLabel(event)}`.toLocaleLowerCase().includes(eventQuery.trim().toLocaleLowerCase())).length} matching event links. The sequence below stays complete.</p>}
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Events in displayed order</p>
            {displayedEvents.length > 0 ? (
              <ol className="grid max-h-48 gap-x-5 gap-y-1 overflow-y-auto pr-2 text-sm sm:grid-cols-2">
                {displayedEvents.filter(event=>`${event.title} ${timelineEventTemporalLabel(event)}`.toLocaleLowerCase().includes(eventQuery.trim().toLocaleLowerCase())).map(event => (
                  <li key={event.id} className="min-w-0">
                    <a
                      className="flex min-w-0 gap-2 text-blue-600 hover:underline dark:text-blue-400"
                      href={`#${eventAnchorIds.get(event.id)}`}
                    >
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{timelineEventTemporalLabel(event)}</span>
                      <span className="truncate">{event.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No events yet. Add an event or start with a research question.</p>
            )}
          </nav>
        </CardContent>
      </Card>

      {sortedEvents.length === 0 ? (
        <Card id="timeline-sequence" tabIndex={-1} className="timeline-sequence scroll-mt-24 border-dashed">
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold">{workspaceOrigin === 'manual' ? 'Start with what you know' : 'No supported dated events found'}</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              {workspaceOrigin === 'manual'
                ? 'Add a known dated event, or begin with an open question when the chronology itself is uncertain.'
                : 'The source may not contain reliable dates, or all events may have been removed from this working view. Add an analyst event without changing the source extraction.'}
            </p>
            {mode === 'robust' && (questions.length > 0 || hypotheses.length > 0) && (
              <div className="mx-auto mt-4 max-w-2xl space-y-2 text-left">
                {questions.map(renderQuestion)}
                {hypotheses.map(renderHypothesis)}
              </div>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button onClick={() => openAddEvent()}><Plus className="mr-2 h-4 w-4" />Add first event</Button>
              {mode === 'robust' && (
                <Button variant="outline" onClick={() => openAddQuestion()}><CircleHelp className="mr-2 h-4 w-4" />Add research question</Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card id="timeline-sequence" tabIndex={-1} className="timeline-sequence scroll-mt-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Working event sequence</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="ml-3 border-l-2 border-blue-200 pl-6 dark:border-blue-900">
              {displayedSequence.map(item => {
                if (item.kind === 'gap') return renderGap(item.previous, item.next)
                const { event, sequenceIndex } = item
                const originalEvent = event.original || result.events.find((_, index) => event.id === `source-${result.requestId}-${index}`)
                return (
                  <li
                    id={eventAnchorIds.get(event.id)}
                    tabIndex={-1}
                    key={event.id}
                    className="timeline-event-card relative scroll-mt-24"
                  >
                    <span className="timeline-event-node absolute -left-[31px] top-6 h-3 w-3 rounded-full border-2 border-blue-600 bg-background" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {event.eventDate ? (
                            <time
                              dateTime={`${event.eventDate}${event.eventTime && event.datePrecision === 'day' ? `T${event.eventTime}` : ''}`}
                              className="font-mono text-sm font-semibold text-blue-700 dark:text-blue-300"
                            >
                              {timelineEventTemporalLabel(event)}
                            </time>
                          ) : (
                            <span className="font-mono text-sm font-semibold text-blue-700 dark:text-blue-300">
                              {timelineEventTemporalLabel(event)}
                            </span>
                          )}
                          <Badge variant="outline" className="capitalize">{event.category}</Badge>
                          {event.importance !== 'normal' && (
                            <Badge variant="outline" className={`capitalize ${importanceClasses[event.importance]}`}>{event.importance}</Badge>
                          )}
                          <Badge variant="outline" className={event.origin === 'source' ? '' : 'border-purple-300 text-purple-700 dark:border-purple-800 dark:text-purple-300'}>
                            {event.origin === 'source' ? event.modified ? 'Source · edited' : 'Source' : 'Analyst added'}
                          </Badge>
                          {mode === 'robust' && (
                            <Badge variant="outline" className={`capitalize ${assessmentClasses[event.assessment === 'corroborated' && !timelineCorroboration(evidence,event).eligible ? 'unreviewed' : event.assessment]}`}>{timelineAssessmentLabel(evidence,event)}</Badge>
                          )}
                          {event.placement?.mode === 'relative' && (
                            <Badge variant="outline">{event.placement.relation === 'before' ? 'Before event' : 'After event'}</Badge>
                          )}
                          {event.placement?.mode === 'position' && (
                            <Badge variant="outline">Position {(event.sequenceOrder ?? sequenceIndex) + 1}</Badge>
                          )}
                        </div>
                        <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight">{event.title}</h3>
                        {event.description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{event.description}</p>}
                        {event.origin === 'source' && <details className="mt-2 text-sm"><summary className="cursor-pointer">Original extraction and source</summary>{originalEvent ? <div className="my-2"><p>{originalEvent.eventDate} ({originalEvent.datePrecision} precision) · {originalEvent.title}</p>{originalEvent.description && <p>{originalEvent.description}</p>}<p>{originalEvent.category} · {originalEvent.importance} importance</p></div> : <p>Original event unavailable; consult the preserved source export.</p>}{result.article.url && <a className="text-blue-600 underline" href={result.article.url} target="_blank" rel="noopener noreferrer">Open extraction source</a>}<p className="text-xs text-muted-foreground">Source extraction is a candidate claim; source presence does not establish corroboration.</p></details>}
                        <TimelineEvidence event={event} events={events} evidence={evidence} onChange={saveEvidence} sourceImportWorkspaceId={sourceImportWorkspaceId} />
                        {mode === 'robust' && event.analystNote && (
                          <p className="mt-2 rounded border-l-2 border-purple-400 bg-purple-50/60 px-3 py-2 text-sm dark:bg-purple-950/20">
                            <span className="font-medium">Analyst note:</span> {event.analystNote}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Actions for ${event.title}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEditEvent(event)}><Pencil className="mr-2 h-4 w-4" />Edit event</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openAddEvent({ anchorEventId: event.id, relation: 'before' })}><Plus className="mr-2 h-4 w-4" />Add event before</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openAddEvent({ anchorEventId: event.id, relation: 'after' })}><Plus className="mr-2 h-4 w-4" />Add event after</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={() => removeEvent(event.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />Remove from timeline
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      </div>
      {presentation === 'analyst' && <div id="timeline-judgments" tabIndex={-1} className="timeline-section-anchor"><TimelineJudgments analysis={analysis} events={events} evidence={evidence} editable onChange={saveAnalysis} /></div>}
      <div id="timeline-narrative-editor" tabIndex={-1} className="timeline-section-anchor"><TimelineNarrative analysis={analysis} evidence={evidence} onEvidence={saveEvidence} narrative={narrative} events={events} editing={presentation === 'analyst'} sourceUrl={result.article.url} openGapCount={questions.filter(question => question.status === 'open').length} onNarrative={setNarrative} onEvents={setEvents} onInspect={id => {
        setPresentation('analyst')
        window.setTimeout(() => {
          const anchor = timelineEventAnchor(id)
          window.location.hash = anchor
          const element = document.getElementById(anchor)
          element?.focus({ preventScroll: true })
          element?.scrollIntoView({ behavior: 'instant', block: 'start' })
        }, 0)
      }} /></div>
      <div hidden={presentation !== 'analyst'} className="space-y-6">
      {mode === 'robust' && (
        <Card id="timeline-ai-review" className="scroll-mt-4 border-purple-200 dark:border-purple-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />AI timeline assistant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="timeline-ai-task">AI task</Label>
                <select
                  id="timeline-ai-task"
                  className={selectClasses()}
                  value={assistAction}
                  onChange={event => {
                    setAssistAction(event.target.value as TimelineAssistAction)
                    setAssistSuggestions([])
                    setAssistError(null)
                  }}
                >
                  <option value="identify_gaps">Find chronology gaps</option>
                  <option value="suggest_questions">Suggest collection questions</option>
                  <option value="generate_hypotheses">Generate working hypotheses</option>
                </select>
              </div>
              <Button onClick={() => void runAiAssist()} disabled={assistLoading || sortedEvents.length === 0}>
                {assistLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {assistLoading ? 'Reviewing…' : 'Run AI review'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              AI sees only the current event summaries. It does not browse, answer factual gaps, or modify the timeline. Review every suggestion before keeping it.
            </p>
            {assistError && <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{assistError}</p>}
            {assistSuggestions.length > 0 && (
              <div className="space-y-3" aria-label="AI suggestions">
                <p className="text-sm font-medium">Suggestions awaiting review</p>
                {assistSuggestions.map(suggestion => (
                  <div key={suggestion.id} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <Badge variant="outline" className="capitalize">AI {suggestion.kind}</Badge>
                        <p className="mt-2 text-sm font-medium">{suggestion.content}</p>
                        {suggestion.rationale && <p className="mt-1 text-sm text-muted-foreground">{suggestion.rationale}</p>}
                        {(suggestion.afterEventId || suggestion.beforeEventId) && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Applies {gapLabel(
                              sortedEvents.find(event => event.id === suggestion.afterEventId),
                              sortedEvents.find(event => event.id === suggestion.beforeEventId),
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" onClick={() => keepSuggestion(suggestion)}>
                          <Check className="mr-1 h-4 w-4" />{suggestion.kind === 'question' ? 'Add question' : 'Keep hypothesis'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setAssistSuggestions(current => current.filter(item => item.id !== suggestion.id))}>
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === 'robust' && (
        <Card id="timeline-next-steps" className="scroll-mt-4">
          <CardHeader>
            <CardTitle className="text-base">Continue the investigation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 font-medium"><Search className="h-4 w-4" />Collect evidence</div>
              <p className="mt-1 text-xs text-muted-foreground">Search across news, government, archives, and other sources for an open question.</p>
              <Button className="mt-3" variant="outline" size="sm" asChild>
                <a
                  href={`/dashboard/tools/collection${firstOpenQuestion ? `?query=${encodeURIComponent(firstOpenQuestion.question)}` : ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Agentic Research
                </a>
              </Button>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 font-medium"><CircleHelp className="h-4 w-4" />Test explanations</div>
              <p className="mt-1 text-xs text-muted-foreground">Move competing timeline hypotheses into ACH when they need structured evidence testing.</p>
              <Button className="mt-3" variant="outline" size="sm" asChild>
                <a href="/dashboard/tools/ach" target="_blank" rel="noopener noreferrer">Open ACH</a>
              </Button>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 font-medium"><Brain className="h-4 w-4" />Analyze behavior</div>
              <p className="mt-1 text-xs text-muted-foreground">Use Behavior Analysis only when events reveal a repeatable actor action and location; COM-B follows from there.</p>
              <Button className="mt-3" variant="outline" size="sm" asChild>
                <a href="/dashboard/analysis-frameworks/behavior/create" target="_blank" rel="noopener noreferrer">Open Behavior Analysis</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {workspaceOrigin === 'extracted' && (
        <p className="text-xs text-muted-foreground">
          Request {result.requestId} · {result.model.name}
          {result.model.rejectedEventCount > 0 ? ` · ${result.model.rejectedEventCount} events omitted during validation` : ''}
        </p>
      )}

      <Dialog open={eventEditor !== null} onOpenChange={open => { if (!open) setEventEditor(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{eventEditor?.eventId ? 'Edit timeline event' : 'Add timeline event'}</DialogTitle>
            <DialogDescription>
              {eventEditor?.eventId
                ? workspaceOrigin === 'manual'
                  ? 'Update what you know, including where it belongs in the working sequence.'
                  : 'Changes are marked as analyst edits; the original extracted event remains in JSON exports.'
                : 'This event will be labeled analyst added. Place it by date/time, relative to another event, or at a sequence position.'}
            </DialogDescription>
          </DialogHeader>
          {eventEditor && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timeline-event-placement">Placement</Label>
                <select
                  id="timeline-event-placement"
                  className={selectClasses()}
                  value={eventEditor.placementMode}
                  onChange={event => setEventEditor({
                    ...eventEditor,
                    placementMode: event.target.value as EventEditorState['placementMode'],
                  })}
                >
                  <option value="absolute">At a date and/or time</option>
                  <option value="relative" disabled={sortedEvents.filter(item => item.id !== eventEditor.eventId).length === 0}>Before or after an event</option>
                  <option value="position">At a sequence position</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {eventEditor.placementMode === 'absolute'
                    ? 'The event is inserted chronologically. A time can be recorded even when the date is unknown.'
                    : eventEditor.placementMode === 'relative'
                      ? 'The event is inserted directly before or after the selected event.'
                      : 'Choose a common position or enter an exact 1-based position.'}
                </p>
              </div>
              {eventEditor.placementMode === 'relative' && (
                <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <Label htmlFor="timeline-event-relation">Relation</Label>
                    <select
                      id="timeline-event-relation"
                      className={selectClasses()}
                      value={eventEditor.relativeRelation}
                      onChange={event => setEventEditor({
                        ...eventEditor,
                        relativeRelation: event.target.value as EventEditorState['relativeRelation'],
                      })}
                    >
                      <option value="before">Before</option>
                      <option value="after">After</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeline-event-anchor">Reference event</Label>
                    <select
                      id="timeline-event-anchor"
                      className={selectClasses()}
                      value={eventEditor.anchorEventId}
                      onChange={event => setEventEditor({ ...eventEditor, anchorEventId: event.target.value })}
                    >
                      {sortedEvents.filter(item => item.id !== eventEditor.eventId).map(item => (
                        <option key={item.id} value={item.id}>{timelineEventTemporalLabel(item)} — {item.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {eventEditor.placementMode === 'position' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="timeline-event-position-choice">Sequence position</Label>
                    <select
                      id="timeline-event-position-choice"
                      className={selectClasses()}
                      value={eventEditor.positionChoice}
                      onChange={event => setEventEditor({
                        ...eventEditor,
                        positionChoice: event.target.value as EventEditorState['positionChoice'],
                      })}
                    >
                      <option value="first">First</option>
                      <option value="second">Second</option>
                      <option value="third">Third</option>
                      <option value="second_to_last">Second to last</option>
                      <option value="last">Last</option>
                      <option value="custom">Exact position…</option>
                    </select>
                  </div>
                  {eventEditor.positionChoice === 'custom' && (
                    <div className="space-y-2">
                      <Label htmlFor="timeline-event-position-number">Position number</Label>
                      <Input
                        id="timeline-event-position-number"
                        type="number"
                        min={1}
                        max={sortedEvents.filter(item => item.id !== eventEditor.eventId).length + 1}
                        step={1}
                        value={eventEditor.positionNumber}
                        onChange={event => setEventEditor({ ...eventEditor, positionNumber: event.target.value })}
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timeline-event-date">Date{eventEditor.placementMode === 'absolute' ? '' : ' (optional)'}</Label>
                  <Input id="timeline-event-date" value={eventEditor.eventDate} onChange={event => setEventEditor({ ...eventEditor, eventDate: event.target.value })} placeholder="YYYY, YYYY-MM, or YYYY-MM-DD" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeline-event-time">Time{eventEditor.placementMode === 'absolute' ? '' : ' (optional)'}</Label>
                  <Input id="timeline-event-time" type="time" step={1} value={eventEditor.eventTime} onChange={event => setEventEditor({ ...eventEditor, eventTime: event.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeline-event-title">Title</Label>
                <Input id="timeline-event-title" value={eventEditor.title} onChange={event => setEventEditor({ ...eventEditor, title: event.target.value })} maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeline-event-description">Description</Label>
                <Textarea id="timeline-event-description" value={eventEditor.description} onChange={event => setEventEditor({ ...eventEditor, description: event.target.value })} maxLength={500} rows={3} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timeline-event-category">Category</Label>
                  <select id="timeline-event-category" className={selectClasses()} value={eventEditor.category} onChange={event => setEventEditor({ ...eventEditor, category: event.target.value as TimelineEventCategory })}>
                    {categories.map(category => <option key={category} value={category}>{category}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeline-event-importance">Importance</Label>
                  <select id="timeline-event-importance" className={selectClasses()} value={eventEditor.importance} onChange={event => setEventEditor({ ...eventEditor, importance: event.target.value as TimelineEventImportance })}>
                    {importanceLevels.map(level => <option key={level} value={level}>{level}</option>)}
                  </select>
                </div>
              </div>
              {mode === 'robust' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="timeline-event-assessment">Assessment</Label>
                    <select id="timeline-event-assessment" className={selectClasses()} value={eventEditor.assessment} onChange={event => setEventEditor({ ...eventEditor, assessment: event.target.value as TimelineEventAssessment })}>
                      {assessmentLevels.map(level => <option key={level} value={level} disabled={level === 'corroborated' && !events.some(event => event.id === eventEditor.eventId && timelineCorroboration(evidence,event).eligible)}>{level}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeline-event-note">Analyst note</Label>
                    <Textarea id="timeline-event-note" value={eventEditor.analystNote} onChange={event => setEventEditor({ ...eventEditor, analystNote: event.target.value })} maxLength={2000} rows={3} placeholder="Reasoning, caveats, corroboration, or follow-up needed" />
                  </div>
                </>
              )}
              {editorError && <p role="alert" className="text-sm text-red-600">{editorError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventEditor(null)}>Cancel</Button>
            <Button onClick={saveEvent}>Save event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={questionEditor !== null} onOpenChange={open => { if (!open) setQuestionEditor(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{questionEditor?.questionId ? 'Review timeline question' : 'Add timeline question'}</DialogTitle>
            <DialogDescription>Record an information gap without inventing an event. Add an answer later when evidence supports one.</DialogDescription>
          </DialogHeader>
          {questionEditor && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timeline-question">Question</Label>
                <Textarea id="timeline-question" value={questionEditor.question} onChange={event => setQuestionEditor({ ...questionEditor, question: event.target.value })} maxLength={300} rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeline-question-answer">Evidence-backed answer (optional)</Label>
                <Textarea id="timeline-question-answer" value={questionEditor.answer} onChange={event => setQuestionEditor({ ...questionEditor, answer: event.target.value })} maxLength={2000} rows={4} placeholder="Leave blank while this remains an information gap" />
              </div>
              {(questionEditor.sources || []).length > 0 && (
                <div className="space-y-2">
                  <Label>Attached answer sources</Label>
                  {questionEditor.sources.map(source => (
                    <div key={source.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                      <span className="min-w-0 truncate">{source.title || source.url}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setQuestionEditor({
                          ...questionEditor,
                          sources: questionEditor.sources.filter(item => item.id !== source.id),
                        })}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-medium">Cite the finding</p>
                  <p className="text-xs text-muted-foreground">Attach the source you used. It will be preserved in copy, JSON export, and the browser draft.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeline-question-source-url">Source URL (optional)</Label>
                  <Input
                    id="timeline-question-source-url"
                    type="url"
                    value={questionEditor.newSourceUrl}
                    onChange={event => setQuestionEditor({ ...questionEditor, newSourceUrl: event.target.value })}
                    placeholder="https://example.com/source"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeline-question-source-title">Source title (optional)</Label>
                  <Input
                    id="timeline-question-source-title"
                    value={questionEditor.newSourceTitle}
                    onChange={event => setQuestionEditor({ ...questionEditor, newSourceTitle: event.target.value })}
                    maxLength={300}
                    placeholder="Document or article title"
                  />
                </div>
              </div>
              {editorError && <p role="alert" className="text-sm text-red-600">{editorError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionEditor(null)}>Cancel</Button>
            <Button onClick={saveQuestion}>Save question</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
