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
import { decodeTimelineWorkspace, TIMELINE_IMPORT_MAX_BYTES } from '@/lib/timeline-workspace-codec'
import type { TimelineAnalysisResult } from '@/types/timeline-analysis'
import type { TimelineWorkspaceState } from '@/types/timeline-workspace'

const MANUAL_DRAFT_KEY = 'researchtools.timeline.manual-draft.v1'
const MANUAL_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000
const RECOVERY_PREFIX = 'researchtools.timeline.recovery.v1.'
let protectedDraftRaw: string | null = null

function recoveryDrafts(): Array<{ key: string, raw: string }> {
  try {
    return Object.keys(window.localStorage).filter(key => key.startsWith(RECOVERY_PREFIX))
      .map(key => ({ key, raw: window.localStorage.getItem(key)! }))
  } catch { return [] }
}

function preserveUnreadableDraft(raw: string): boolean {
  protectedDraftRaw = raw
  try {
    if (!recoveryDrafts().some(item => item.raw === raw)) {
      const key = `${RECOVERY_PREFIX}${Date.now()}-${crypto.randomUUID()}`
      window.localStorage.setItem(key, raw)
      if (window.localStorage.getItem(key) !== raw) return false
    }
    return true
  } catch { return false }
}

interface ManualTimelineDraft {
  schemaVersion: 'timeline-browser-draft.v1'
  expiresAt: string
  result: TimelineAnalysisResult
  workspace: TimelineWorkspaceState
  origin?: 'manual' | 'extracted'
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
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(MANUAL_DRAFT_KEY)
    if (!raw) return null
    const candidate = JSON.parse(raw) as ManualTimelineDraft
    if (typeof candidate?.expiresAt === 'string' && Number.isFinite(Date.parse(candidate.expiresAt)) && Date.parse(candidate.expiresAt) <= Date.now()) {
      window.localStorage.removeItem(MANUAL_DRAFT_KEY)
      return null
    }
    const valid = candidate?.schemaVersion === 'timeline-browser-draft.v1'
      && Date.parse(candidate.expiresAt) > Date.now()
      && candidate.result?.schemaVersion === 'timeline-analysis.v1'
      && typeof candidate.result.article?.title === 'string'
      && (candidate.workspace?.mode === 'basic' || candidate.workspace?.mode === 'robust')
      && Array.isArray(candidate.workspace.events)
      && Array.isArray(candidate.workspace.questions)
      && Array.isArray(candidate.workspace.hypotheses)
    if (valid && (candidate.origin === undefined || candidate.origin === 'manual' || candidate.origin === 'extracted')) {
      const decoded = decodeTimelineWorkspace(JSON.stringify({
        schemaVersion: 'timeline-workspace.v1', exportedAt: new Date().toISOString(),
        source: candidate.origin === 'extracted' ? candidate.result : { schemaVersion: 'timeline-manual.v1', title: candidate.result.article.title },
        analystWorkspace: candidate.workspace,
      }))
      return { ...candidate, workspace: decoded.analystWorkspace }
    }
    preserveUnreadableDraft(raw)
  } catch {
    if (raw) preserveUnreadableDraft(raw)
  }
  return null
}

function writeManualDraft(draft: ManualTimelineDraft): boolean {
  try {
    if (protectedDraftRaw && !preserveUnreadableDraft(protectedDraftRaw)) return false
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
  const [initialWorkspace, setInitialWorkspace] = useState<TimelineWorkspaceState | undefined>()
  const [workspaceGeneration, setWorkspaceGeneration] = useState(0)
  const [recovery] = useState(() => {
    const saved = recoveryDrafts()
    return protectedDraftRaw && !saved.some(item => item.raw === protectedDraftRaw)
      ? [...saved, { key: 'original-draft', raw: protectedDraftRaw }]
      : saved
  })
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
    setInitialWorkspace(undefined)
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
    setInitialWorkspace(nextDraft.workspace)
    setResult(nextResult)
    setResultOrigin('manual')
    setError(savedLocally ? null : 'The timeline is open, but this browser could not save the local draft. Export JSON before leaving.')
  }

  const resumeManualTimeline = () => {
    if (!manualDraft) return
    setResult(manualDraft.result)
    setResultOrigin(manualDraft.origin ?? 'manual')
    setInitialWorkspace(manualDraft.workspace)
    setWorkspaceGeneration(current => current + 1)
    setEntryMode(manualDraft.origin === 'extracted' ? 'article' : 'manual')
    setError(null)
  }

  const handleManualWorkspaceChange = useCallback((workspace: TimelineWorkspaceState) => {
    if (!result || !resultOrigin) return
    const next: ManualTimelineDraft = {
      schemaVersion: 'timeline-browser-draft.v1', result, origin: resultOrigin,
      expiresAt: new Date(Date.now() + MANUAL_DRAFT_TTL_MS).toISOString(), workspace,
    }
    setManualDraft(next)
    if (!writeManualDraft(next)) setError('The timeline is open, but this browser could not save the local draft. Export JSON before leaving.')
  }, [result, resultOrigin])

  const importWorkspace = async (file: File) => {
    try {
      if (file.size > TIMELINE_IMPORT_MAX_BYTES) throw new Error('Timeline JSON must be 4 MiB or smaller.')
      const imported = decodeTimelineWorkspace(await file.text())
      requestRef.current?.abort()
      requestRef.current = null
      setLoading(false)
      const origin = imported.source.schemaVersion === 'timeline-manual.v1' ? 'manual' : 'extracted'
      const nextResult = imported.source.schemaVersion === 'timeline-manual.v1' ? manualTimelineResult(imported.source.title) : imported.source
      const draft: ManualTimelineDraft = {
        schemaVersion: 'timeline-browser-draft.v1', expiresAt: new Date(Date.now() + MANUAL_DRAFT_TTL_MS).toISOString(),
        result: nextResult, origin, workspace: imported.analystWorkspace,
      }
      const saved = writeManualDraft(draft)
      setManualDraft(draft)
      setResult(nextResult)
      setResultOrigin(origin)
      setInitialWorkspace(imported.analystWorkspace)
      setWorkspaceGeneration(current => current + 1)
      setEntryMode(origin === 'manual' ? 'manual' : 'article')
      setUrl(nextResult.article.url)
      setError(saved ? null : 'Imported timeline is open, but local saving failed. Export JSON before leaving.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to import this timeline.')
    }
  }

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
        <AlertDescription>No login is required. One local draft stays in this browser for 7 days. Creating, extracting or importing another timeline replaces that draft. Durable workspace saving and collaboration are not available yet; export JSON to keep or share your work.</AlertDescription>
      </Alert>

      {recovery.length > 0 && <Alert variant="destructive">
        <AlertDescription className="space-y-2">
          <p>A saved timeline could not be read by this version. Its original JSON has been preserved for recovery. Recovery files contain the original browser draft envelope and may need repair before import.</p>
          {recovery.map((item, index) => <Button key={item.key} variant="outline" onClick={() => {
            const objectUrl = URL.createObjectURL(new Blob([item.raw], { type: 'application/json' }))
            const anchor = document.createElement('a')
            anchor.href = objectUrl
            anchor.download = `timeline-recovery-${index + 1}.json`
            anchor.click()
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
          }}>Download recovery JSON{recovery.length > 1 ? ` ${index + 1}` : ''}</Button>)}
        </AlertDescription>
      </Alert>}

      <div className="space-y-2 rounded-lg border p-4">
        <Label htmlFor="timeline-import">Import timeline JSON</Label>
        <Input id="timeline-import" type="file" accept=".json,application/json" onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void importWorkspace(file)
        }} />
        <p className="text-xs text-muted-foreground">Restore a timeline-workspace.v1 export (up to 4 MiB). Import reads the file locally and does not extract or fetch its sources. Export the current workspace first to keep both.</p>
        {manualDraft && !result && <Button variant="outline" onClick={resumeManualTimeline}>Resume saved timeline</Button>}
      </div>

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
          key={`${result.requestId}-${workspaceGeneration}`}
          result={result}
          workspaceOrigin={resultOrigin}
          initialWorkspace={initialWorkspace}
          onWorkspaceChange={handleManualWorkspaceChange}
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
