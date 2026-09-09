import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Calendar,
  Check,
  CircleHelp,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileSearch,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
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
import { inferTimelineDatePrecision } from '@/lib/timeline-analysis'
import { assistTimeline, TimelineAssistError } from '@/lib/timeline-assist'
import type {
  TimelineAnalysisResult,
  TimelineEventCategory,
  TimelineEventImportance,
} from '@/types/timeline-analysis'
import type { TimelineAssistAction, TimelineAssistInput, TimelineAssistSuggestion } from '@/types/timeline-assist'
import type {
  TimelineEventAssessment,
  TimelineWorkspaceEvent,
  TimelineWorkspaceExport,
  TimelineWorkspaceHypothesis,
  TimelineWorkspaceMode,
  TimelineWorkspaceQuestion,
  TimelineQuestionStatus,
} from '@/types/timeline-workspace'

interface TimelineResultsProps {
  result: TimelineAnalysisResult
  onRegenerate?: () => void
  regenerating?: boolean
}

interface EventEditorState {
  eventId?: string
  afterEventId?: string
  beforeEventId?: string
  eventDate: string
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
}

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
  }))
}

function timelineMarkdown(
  result: TimelineAnalysisResult,
  events: TimelineWorkspaceEvent[],
  questions: TimelineWorkspaceQuestion[],
  hypotheses: TimelineWorkspaceHypothesis[],
): string {
  const lines = [
    `# ${result.article.title}`,
    '',
    `Source: ${result.article.url}`,
    '',
  ]
  for (const event of events) {
    const provenance = event.origin === 'source'
      ? event.modified ? 'source extraction, analyst edited' : 'source extraction'
      : 'analyst added'
    lines.push(`- **${event.eventDate}** — ${event.title} _[${provenance}; ${event.assessment}]_`)
    if (event.description) lines.push(`  ${event.description}`)
    if (event.analystNote) lines.push(`  Analyst note: ${event.analystNote}`)
  }
  if (events.length === 0) lines.push('No timeline events are currently included.')
  if (questions.length > 0) {
    lines.push('', '## Analyst questions', '')
    for (const question of questions) {
      lines.push(`- [${question.status === 'answered' ? 'x' : ' '}] ${question.question}`)
      if (question.answer) lines.push(`  Answer: ${question.answer}`)
    }
  }
  if (hypotheses.length > 0) {
    lines.push('', '## Working hypotheses', '')
    for (const hypothesis of hypotheses) {
      lines.push(`- ${hypothesis.hypothesis} _[AI suggested; analyst retained as hypothesis]_`)
      if (hypothesis.rationale) lines.push(`  Test: ${hypothesis.rationale}`)
    }
  }
  return lines.join('\n')
}

function selectClasses(): string {
  return 'flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950'
}

function gapLabel(previous?: TimelineWorkspaceEvent, next?: TimelineWorkspaceEvent): string {
  if (!previous && next) return `before ${next.eventDate}`
  if (previous && !next) return `after ${previous.eventDate}`
  if (previous && next) return `between ${previous.eventDate} and ${next.eventDate}`
  return 'in this timeline'
}

export function TimelineResults(props: TimelineResultsProps) {
  return <TimelineWorkspace key={props.result.requestId} {...props} />
}

function TimelineWorkspace({ result, onRegenerate, regenerating = false }: TimelineResultsProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [mode, setMode] = useState<TimelineWorkspaceMode>('basic')
  const [events, setEvents] = useState<TimelineWorkspaceEvent[]>(() => workspaceEvents(result))
  const [questions, setQuestions] = useState<TimelineWorkspaceQuestion[]>([])
  const [hypotheses, setHypotheses] = useState<TimelineWorkspaceHypothesis[]>([])
  const [eventEditor, setEventEditor] = useState<EventEditorState | null>(null)
  const [questionEditor, setQuestionEditor] = useState<QuestionEditorState | null>(null)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [assistAction, setAssistAction] = useState<TimelineAssistAction>('identify_gaps')
  const [assistSuggestions, setAssistSuggestions] = useState<TimelineAssistSuggestion[]>([])
  const [assistLoading, setAssistLoading] = useState(false)
  const [assistError, setAssistError] = useState<string | null>(null)
  const copyResetRef = useRef<number | null>(null)
  const assistRequestRef = useRef<AbortController | null>(null)
  const sortedEvents = useMemo(
    () => [...events].sort((left, right) => left.eventDate.localeCompare(right.eventDate) || left.title.localeCompare(right.title)),
    [events],
  )

  useEffect(() => () => {
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current)
    assistRequestRef.current?.abort()
  }, [])

  const copyTimeline = async () => {
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(timelineMarkdown(result, sortedEvents, questions, hypotheses))
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
      source: result,
      analystWorkspace: { mode, events: sortedEvents, questions, hypotheses },
    }
    const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    const safeDomain = result.article.domain.replace(/[^a-z0-9.-]+/gi, '-')
    const safeRequestId = result.requestId.replace(/[^a-z0-9_-]+/gi, '-')
    anchor.download = `timeline-${safeDomain}-${safeRequestId}.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0)
  }

  const openAddEvent = (afterEventId?: string, beforeEventId?: string) => {
    setEditorError(null)
    setEventEditor({
      afterEventId,
      beforeEventId,
      eventDate: '',
      title: '',
      description: '',
      category: 'event',
      importance: 'normal',
      assessment: 'unreviewed',
      analystNote: '',
    })
  }

  const openEditEvent = (event: TimelineWorkspaceEvent) => {
    setEditorError(null)
    setEventEditor({
      eventId: event.id,
      eventDate: event.eventDate,
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
    const eventDate = eventEditor.eventDate.trim()
    const title = eventEditor.title.trim()
    const description = eventEditor.description.trim()
    const analystNote = eventEditor.analystNote.trim()
    const datePrecision = inferTimelineDatePrecision(eventDate)
    if (!datePrecision) {
      setEditorError('Use a real date in YYYY, YYYY-MM, or YYYY-MM-DD format.')
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

    if (eventEditor.eventId) {
      setEvents(current => current.map(event => {
        if (event.id !== eventEditor.eventId) return event
        const contentChanged = event.eventDate !== eventDate
          || event.title !== title
          || (event.description || '') !== description
          || event.category !== eventEditor.category
          || event.importance !== eventEditor.importance
        return {
            ...event,
            eventDate,
            datePrecision,
            title,
            description: description || null,
            category: eventEditor.category,
            importance: eventEditor.importance,
            assessment: eventEditor.assessment,
            analystNote,
            modified: event.modified || contentChanged,
            original: event.original || (event.origin === 'source' && contentChanged
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
      }))
    } else {
      setEvents(current => [...current, {
        id: createId('analyst'),
        origin: 'analyst',
        assessment: eventEditor.assessment,
        analystNote,
        modified: false,
        eventDate,
        datePrecision,
        title,
        description: description || null,
        category: eventEditor.category,
        importance: eventEditor.importance,
      }])
    }
    setEventEditor(null)
    setEditorError(null)
  }

  const removeEvent = (eventId: string) => {
    const index = sortedEvents.findIndex(event => event.id === eventId)
    const previousId = index > 0 ? sortedEvents[index - 1].id : undefined
    const nextId = index >= 0 && index < sortedEvents.length - 1 ? sortedEvents[index + 1].id : undefined
    setEvents(current => current.filter(event => event.id !== eventId))
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
        events: sortedEvents,
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
    })
  }

  const openEditQuestion = (question: TimelineWorkspaceQuestion) => {
    setEditorError(null)
    setQuestionEditor({ ...question, questionId: question.id })
  }

  const saveQuestion = () => {
    if (!questionEditor) return
    const question = questionEditor.question.trim()
    const answer = questionEditor.answer.trim()
    if (!question) {
      setEditorError('Enter a research question.')
      return
    }
    if (question.length > 300 || answer.length > 2000) {
      setEditorError('Keep the question under 300 characters and the answer under 2,000.')
      return
    }
    const nextQuestion: TimelineWorkspaceQuestion = {
      id: questionEditor.questionId || createId('question'),
      afterEventId: questionEditor.afterEventId,
      beforeEventId: questionEditor.beforeEventId,
      question,
      answer,
      status: answer ? 'answered' : 'open',
    }
    setQuestions(current => questionEditor.questionId
      ? current.map(item => item.id === questionEditor.questionId ? nextQuestion : item)
      : [...current, nextQuestion])
    setQuestionEditor(null)
    setEditorError(null)
  }

  const renderQuestion = (question: TimelineWorkspaceQuestion) => (
    <div key={question.id} className="rounded-lg border border-dashed border-purple-300 bg-purple-50/70 p-3 dark:border-purple-800 dark:bg-purple-950/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CircleHelp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <Badge variant="outline" className="border-purple-300 text-purple-700 dark:border-purple-800 dark:text-purple-300">
              {question.status === 'answered' ? 'Answered' : 'Information gap'}
            </Badge>
          </div>
          <p className="mt-2 text-sm font-medium">{question.question}</p>
          {question.answer && <p className="mt-2 text-sm text-muted-foreground">{question.answer}</p>}
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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditQuestion(question)} aria-label="Edit question">
            <Pencil className="h-3.5 w-3.5" />
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
        <div className="space-y-2 rounded-lg border border-dashed bg-muted/20 p-2">
          {gapQuestions.map(renderQuestion)}
          {gapHypotheses.map(renderHypothesis)}
          <div className="flex flex-wrap items-center justify-center gap-1">
            <span className="mr-1 text-xs text-muted-foreground">{gapLabel(previous, next)}</span>
            <Button variant="ghost" size="sm" onClick={() => openAddEvent(previous?.id, next?.id)}>
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
    <div className="space-y-4" data-testid="timeline-results">
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{sortedEvents.length} {sortedEvents.length === 1 ? 'event' : 'events'}</Badge>
              {questions.length > 0 && <Badge variant="outline">{questions.length} {questions.length === 1 ? 'question' : 'questions'}</Badge>}
              {hypotheses.length > 0 && <Badge variant="outline">{hypotheses.length} {hypotheses.length === 1 ? 'hypothesis' : 'hypotheses'}</Badge>}
              <Badge variant="outline">{result.article.domain}</Badge>
              <Badge variant="outline">{result.extraction.sourceMode}</Badge>
            </div>
            <CardTitle className="text-xl leading-tight">{result.article.title}</CardTitle>
            <a
              href={result.article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              <span className="truncate">{result.article.url}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
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
                <Button variant="outline" size="sm" onClick={exportWorkspace}>
                  <Download className="mr-2 h-4 w-4" />Export JSON
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
        </CardContent>
      </Card>

      {mode === 'robust' && (
        <Card className="border-purple-200 dark:border-purple-900">
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

      {sortedEvents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold">No supported dated events found</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              The source may not contain reliable dates, or all events may have been removed from this working view. Add an analyst event without changing the source extraction.
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Chronological events</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="ml-3 border-l-2 border-blue-200 pl-6 dark:border-blue-900">
              {renderGap(undefined, sortedEvents[0])}
              {sortedEvents.map((event, index) => (
                <Fragment key={event.id}>
                  <li className="relative pb-1">
                    <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-blue-600 bg-background" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <time dateTime={event.eventDate} className="font-mono text-sm font-semibold text-blue-700 dark:text-blue-300">{event.eventDate}</time>
                          <Badge variant="outline" className="capitalize">{event.category}</Badge>
                          {event.importance !== 'normal' && (
                            <Badge variant="outline" className={`capitalize ${importanceClasses[event.importance]}`}>{event.importance}</Badge>
                          )}
                          <Badge variant="outline" className={event.origin === 'source' ? '' : 'border-purple-300 text-purple-700 dark:border-purple-800 dark:text-purple-300'}>
                            {event.origin === 'source' ? event.modified ? 'Source · edited' : 'Source' : 'Analyst added'}
                          </Badge>
                          {mode === 'robust' && (
                            <Badge variant="outline" className={`capitalize ${assessmentClasses[event.assessment]}`}>{event.assessment}</Badge>
                          )}
                        </div>
                        <h3 className="mt-2 font-semibold leading-snug">{event.title}</h3>
                        {event.description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{event.description}</p>}
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
                          <DropdownMenuItem onSelect={() => openAddEvent(sortedEvents[index - 1]?.id, event.id)}><Plus className="mr-2 h-4 w-4" />Add event before</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openAddEvent(event.id, sortedEvents[index + 1]?.id)}><Plus className="mr-2 h-4 w-4" />Add event after</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={() => removeEvent(event.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />Remove from timeline
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                  {renderGap(event, sortedEvents[index + 1])}
                </Fragment>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Request {result.requestId} · {result.model.name}
        {result.model.rejectedEventCount > 0 ? ` · ${result.model.rejectedEventCount} events omitted during validation` : ''}
      </p>

      <Dialog open={eventEditor !== null} onOpenChange={open => { if (!open) setEventEditor(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{eventEditor?.eventId ? 'Edit timeline event' : 'Add timeline event'}</DialogTitle>
            <DialogDescription>
              {eventEditor?.eventId
                ? 'Changes are marked as analyst edits and preserve the original extracted event in JSON exports.'
                : `This event will be labeled analyst added and placed chronologically by its date${eventEditor && (eventEditor.afterEventId || eventEditor.beforeEventId) ? ` (${gapLabel(sortedEvents.find(event => event.id === eventEditor.afterEventId), sortedEvents.find(event => event.id === eventEditor.beforeEventId))})` : ''}.`}
            </DialogDescription>
          </DialogHeader>
          {eventEditor && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timeline-event-date">Date</Label>
                <Input id="timeline-event-date" value={eventEditor.eventDate} onChange={event => setEventEditor({ ...eventEditor, eventDate: event.target.value })} placeholder="YYYY, YYYY-MM, or YYYY-MM-DD" />
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
                      {assessmentLevels.map(level => <option key={level} value={level}>{level}</option>)}
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
        <DialogContent className="sm:max-w-xl">
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
  )
}
