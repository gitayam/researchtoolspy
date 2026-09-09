import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Calendar, FileSearch, Info, Loader2, PencilLine } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TimelineResults } from '@/components/timeline/TimelineResults'
import { analyzeTimeline, TimelineAnalysisError } from '@/lib/timeline-analysis'
import type { TimelineAnalysisResult } from '@/types/timeline-analysis'
import type { TimelineWorkspaceState } from '@/types/timeline-workspace'

const MANUAL_DRAFT_KEY = 'researchtools.timeline.manual-draft.v1'
const MANUAL_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

interface ManualTimelineDraft {
  schemaVersion: 'timeline-browser-draft.v1'
  expiresAt: string
  result: TimelineAnalysisResult
  workspace: TimelineWorkspaceState
}

function createRequestId(): string {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `manual-${id}`
}

function emptyManualWorkspace(): TimelineWorkspaceState {
  return { mode: 'robust', events: [], questions: [], hypotheses: [] }
}

function manualTimelineResult(title: string): TimelineAnalysisResult {
  return {
    schemaVersion: 'timeline-analysis.v1',
    requestId: createRequestId(),
    outcome: 'no_events',
    article: { url: '', title, domain: '' },
    events: [],
    extraction: {
      contentSource: 'analyst-input',
      sourceMode: 'supplied',
      method: 'manual',
      wordCount: 0,
      quality: { version: 'manual-entry.v1', score: 100, accepted: true },
      fallbackAttempts: ['analyst-input'],
    },
    model: { name: 'manual-entry', status: 'no_events', rejectedEventCount: 0 },
  }
}

function readManualDraft(): ManualTimelineDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(MANUAL_DRAFT_KEY)
    if (!raw) return null
    const candidate = JSON.parse(raw) as ManualTimelineDraft
    const valid = candidate?.schemaVersion === 'timeline-browser-draft.v1'
      && Date.parse(candidate.expiresAt) > Date.now()
      && candidate.result?.schemaVersion === 'timeline-analysis.v1'
      && typeof candidate.result.article?.title === 'string'
      && (candidate.workspace?.mode === 'basic' || candidate.workspace?.mode === 'robust')
      && Array.isArray(candidate.workspace.events)
      && Array.isArray(candidate.workspace.questions)
      && Array.isArray(candidate.workspace.hypotheses)
    if (valid) return candidate
    window.localStorage.removeItem(MANUAL_DRAFT_KEY)
  } catch {
    window.localStorage.removeItem(MANUAL_DRAFT_KEY)
  }
  return null
}

function writeManualDraft(draft: ManualTimelineDraft): boolean {
  try {
    window.localStorage.setItem(MANUAL_DRAFT_KEY, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function TimelineAnalysisPage() {
  const [searchParams] = useSearchParams()
  const queryUrl = searchParams.get('url') || ''
  const [entryMode, setEntryMode] = useState<'manual' | 'article'>(() => queryUrl ? 'article' : 'manual')
  const [url, setUrl] = useState(() => queryUrl)
  const [manualDraft, setManualDraft] = useState<ManualTimelineDraft | null>(() => readManualDraft())
  const [manualTitle, setManualTitle] = useState(() => readManualDraft()?.result.article.title || '')
  const [result, setResult] = useState<TimelineAnalysisResult | null>(null)
  const [resultOrigin, setResultOrigin] = useState<'manual' | 'extracted' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    requestRef.current?.abort()
    requestRef.current = null
    const updateId = window.setTimeout(() => {
      setLoading(false)
      setResult(null)
      setResultOrigin(null)
      setError(null)
      setUrl(queryUrl)
      if (queryUrl) setEntryMode('article')
    }, 0)
    return () => window.clearTimeout(updateId)
  }, [queryUrl])

  useEffect(() => () => requestRef.current?.abort(), [])

  const runAnalysis = async (event?: FormEvent) => {
    event?.preventDefault()
    const target = url.trim()
    if (!target) {
      setError('Enter an article URL to build a timeline.')
      return
    }

    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError(null)
    setResult(null)
    setResultOrigin(null)
    try {
      const nextResult = await analyzeTimeline({ url: target }, { signal: controller.signal })
      if (!controller.signal.aborted) {
        setResult(nextResult)
        setResultOrigin('extracted')
      }
    } catch (caught) {
      if (controller.signal.aborted) return
      if (caught instanceof TimelineAnalysisError && caught.status === 422) {
        setError('The page did not expose enough article text. Try an archive or analyze a working copy in Content Research.')
      } else {
        setError(caught instanceof Error ? caught.message : 'Timeline analysis failed. Please try again.')
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setLoading(false)
      }
    }
  }

  const startManualTimeline = () => {
    const title = manualTitle.trim()
    if (!title) {
      setError('Name the investigation or timeline before starting.')
      return
    }
    if (title.length > 200) {
      setError('Keep the timeline title under 200 characters.')
      return
    }
    if (manualDraft && !window.confirm('Replace the existing browser timeline draft? Export it first if you need to keep both.')) return

    const nextResult = manualTimelineResult(title)
    const nextDraft: ManualTimelineDraft = {
      schemaVersion: 'timeline-browser-draft.v1',
      expiresAt: new Date(Date.now() + MANUAL_DRAFT_TTL_MS).toISOString(),
      result: nextResult,
      workspace: emptyManualWorkspace(),
    }
    const savedLocally = writeManualDraft(nextDraft)
    setManualDraft(nextDraft)
    setResult(nextResult)
    setResultOrigin('manual')
    setError(savedLocally ? null : 'The timeline is open, but this browser could not save the local draft. Export JSON before leaving.')
  }

  const resumeManualTimeline = () => {
    if (!manualDraft) return
    setResult(manualDraft.result)
    setResultOrigin('manual')
    setEntryMode('manual')
    setError(null)
  }

  const handleManualWorkspaceChange = useCallback((workspace: TimelineWorkspaceState) => {
    setManualDraft(current => {
      if (!current) return current
      const next: ManualTimelineDraft = {
        ...current,
        expiresAt: new Date(Date.now() + MANUAL_DRAFT_TTL_MS).toISOString(),
        workspace,
      }
      writeManualDraft(next)
      return next
    })
  }, [])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 py-8">
      <div className="flex items-start gap-4">
        <Button variant="outline" size="icon" asChild aria-label="Back to research tools">
          <Link to="/dashboard/tools"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold"><Calendar className="h-8 w-8" />Timeline Analysis</h1>
          <p className="mt-1 text-muted-foreground">Build what you know, expose what is missing, and turn those gaps into evidence-backed research.</p>
        </div>
      </div>

      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription>No login is required. A manual guest draft stays in this browser for 7 days; saving it to a workspace or collaborating requires sign-in.</AlertDescription>
      </Alert>

      <div className="flex w-fit rounded-md border bg-background p-1" role="group" aria-label="Timeline starting point">
        <Button size="sm" variant={entryMode === 'manual' ? 'default' : 'ghost'} aria-pressed={entryMode === 'manual'} onClick={() => setEntryMode('manual')}>
          <PencilLine className="mr-2 h-4 w-4" />Start with what you know
        </Button>
        <Button size="sm" variant={entryMode === 'article' ? 'default' : 'ghost'} aria-pressed={entryMode === 'article'} onClick={() => setEntryMode('article')}>
          <FileSearch className="mr-2 h-4 w-4" />Extract an article
        </Button>
      </div>

      {entryMode === 'manual' ? (resultOrigin === 'manual' ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Create an investigation timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {manualDraft && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>Browser draft available: <strong>{manualDraft.result.article.title}</strong> · {manualDraft.workspace.events.length} events · {manualDraft.workspace.questions.length} questions</span>
                  <Button type="button" size="sm" variant="outline" onClick={resumeManualTimeline}>Resume draft</Button>
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="manual-timeline-title">Investigation or timeline title</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="manual-timeline-title"
                  value={manualTitle}
                  onChange={event => setManualTitle(event.target.value)}
                  maxLength={200}
                  placeholder="What sequence of events are you investigating?"
                  className="flex-1"
                />
                <Button type="button" onClick={startManualTimeline}>Create timeline</Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">You can begin with a known event or an unanswered question. Unknown transitions remain visible research gaps.</p>
          </CardContent>
        </Card>
      )) : (
        <Card>
          <CardHeader>
            <CardTitle>Build a timeline from an article</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={runAnalysis} className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="url"
                  value={url}
                  onChange={event => setUrl(event.target.value)}
                  placeholder="https://example.com/article"
                  aria-label="Article URL"
                  className="flex-1"
                />
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
                  {loading ? 'Building timeline…' : 'Build Timeline'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Dates are preserved at day, month, or year precision. Events without reliable dates are omitted rather than guessed.</p>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && resultOrigin && (
        <TimelineResults
          result={result}
          workspaceOrigin={resultOrigin}
          initialWorkspace={resultOrigin === 'manual' ? manualDraft?.workspace : undefined}
          onWorkspaceChange={resultOrigin === 'manual' ? handleManualWorkspaceChange : undefined}
          onRegenerate={resultOrigin === 'extracted' ? () => void runAnalysis() : undefined}
          regenerating={loading}
        />
      )}

      {result && resultOrigin === 'extracted' && (
        <div className="flex justify-end">
          <Button variant="outline" asChild>
            <Link to={`/dashboard/tools/content-intelligence?url=${encodeURIComponent(result.article.url)}`}>
              Continue in Content Research
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
