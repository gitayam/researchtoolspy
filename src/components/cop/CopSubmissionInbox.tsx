import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { getCopHeaders } from '../../lib/cop-auth'
import { Inbox, Check, X, MapPin, Clock, ChevronDown, ChevronUp, Plus, Copy, Loader2 } from 'lucide-react'
import type { CopChangedDetail, CopSubmission, CopSubmissionIngest } from '../../types/cop'
import { COP_CHANGED_EVENT, copRequest, notifyCopChanged } from '../../lib/cop-request'
import TagChips from './tags/TagChips'
import { useCopTagsContext } from './tags/tag-context'
import { uniqueTagNames } from './tags/tag-names'
import { cn } from '../../lib/utils'

const CopIntakeFormBuilder = lazy(() => import('./CopIntakeFormBuilder'))

interface CopSubmissionInboxProps {
  sessionId: string
  expanded: boolean
}

type Submission = CopSubmission & CopSubmissionIngest

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30',
  triaged: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
  accepted: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30',
  rejected: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30',
}

const STATUS_LABEL: Record<string, string> = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', '': 'All' }

/** Panels refetch on change events; this slow refetch only covers a missed one. */
const SAFETY_REFETCH_MS = 120_000

/** Filed into the COP: on arrival by the server, or by an analyst accepting it. */
function inCop(sub: Submission): boolean {
  return !!sub.linked_evidence_id && (sub.auto_ingested === true || sub.status === 'accepted')
}

function sourceLabel(sub: Submission): string | null {
  if ((sub.form_data as Record<string, unknown>)?._source === 'signal-bot') return 'Signal'
  if (sub.source === 'drop') return 'Drop form'
  if (sub.source === 'intake') return 'Intake form'
  return null
}

function FieldValue({ value }: { value: unknown }) {
  const text = typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value)
  // Only http(s) becomes a link; everything else is shown as the text it is.
  if (/^https?:\/\/\S+$/i.test(text.trim())) {
    return (
      <a href={text.trim()} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="break-all text-blue-700 underline dark:text-blue-300">
        {text.trim()}
      </a>
    )
  }
  return <span className="break-words">{text}</span>
}

export default function CopSubmissionInbox({ sessionId, expanded }: CopSubmissionInboxProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'inbox' | 'forms'>('inbox')
  const [showBuilder, setShowBuilder] = useState(false)
  const [createdLink, setCreatedLink] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [triageMessage, setTriageMessage] = useState<{ id: string; ok: boolean; text: string } | null>(null)
  const tags = useCopTagsContext()

  const fetchSubmissions = useCallback(async (signal?: AbortSignal) => {
    try {
      const params = filter ? `?status=${encodeURIComponent(filter)}` : ''
      const res = await fetch(`/api/cop/${encodeURIComponent(sessionId)}/submissions${params}`, {
        headers: getCopHeaders(),
        signal,
      })
      if (!res.ok) {
        setLoadError(res.status === 403 ? 'You need access to this COP to see its submissions.' : `Submissions could not be loaded (HTTP ${res.status}).`)
        return
      }
      const data = await res.json()
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : [])
      setLoadError(null)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setLoadError('Submissions could not be loaded. Check your connection.')
    } finally {
      setLoading(false)
    }
  }, [sessionId, filter])

  useEffect(() => {
    const controller = new AbortController()
    // fetchSubmissions sets state only after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSubmissions(controller.signal)
    const onChanged = (event: Event) => {
      const types = (event as CustomEvent<CopChangedDetail>).detail?.types ?? []
      if (types.includes('submission') || types.includes('evidence')) fetchSubmissions(controller.signal)
    }
    window.addEventListener(COP_CHANGED_EVENT, onChanged)
    const safety = setInterval(() => {
      if (document.visibilityState === 'visible') fetchSubmissions(controller.signal)
    }, SAFETY_REFETCH_MS)
    return () => {
      controller.abort()
      clearInterval(safety)
      window.removeEventListener(COP_CHANGED_EVENT, onChanged)
    }
  }, [fetchSubmissions])

  const handleTriage = useCallback(async (sub: Submission, status: 'accepted' | 'rejected') => {
    setBusyId(sub.id)
    setTriageMessage(null)
    const res = await copRequest<{ linked_evidence_id?: string | number | null; submission?: Submission }>(
      `/api/cop/${encodeURIComponent(sessionId)}/submissions`,
      { method: 'PUT', json: { id: sub.id, status, rejection_reason: null } },
    )
    setBusyId(null)
    if (res.ok === false) {
      setTriageMessage({
        id: sub.id,
        ok: false,
        text: res.status === 403 ? 'Only the session owner or an editor can triage submissions.' : res.error ?? `Could not update it (HTTP ${res.status}).`,
      })
      return
    }
    const evidenceId = res.data.linked_evidence_id ?? res.data.submission?.linked_evidence_id ?? null
    setTriageMessage({
      id: sub.id,
      ok: true,
      text: status === 'rejected' ? 'Rejected.' : evidenceId ? 'Added to the evidence feed.' : 'Accepted.',
    })
    notifyCopChanged(status === 'accepted' ? ['submission', 'evidence'] : ['submission'])
    await fetchSubmissions()
  }, [sessionId, fetchSubmissions])

  const tagsOf = (sub: Submission): string[] => uniqueTagNames([
    ...(sub.tags ?? []),
    ...(tags?.tagsFor('submission', sub.id) ?? []),
    ...(sub.linked_evidence_id ? tags?.tagsFor('evidence', sub.linked_evidence_id) ?? [] : []),
  ], 20)

  if (!expanded) {
    const pendingCount = submissions.filter(s => s.status === 'pending').length
    const filed = submissions.filter(inCop).length
    return (
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs">
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-yellow-500/20 dark:text-yellow-300">
              {pendingCount} to review
            </span>
          )}
          {filed > 0 && <span className="text-muted-foreground">{filed} in the COP</span>}
          <span className="text-muted-foreground">{submissions.length} shown</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar + actions */}
      <div className="flex items-center justify-between border-b border-slate-200 px-2 py-1.5 dark:border-slate-800">
        <div className="flex items-center gap-1" role="tablist" aria-label="Submissions or forms">
          {(['inbox', 'forms'] as const).map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => { setTab(t); setShowBuilder(false); setCreatedLink(null) }}
              className={cn(
                'min-h-9 cursor-pointer rounded-full px-3 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500',
                tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {t === 'inbox' ? 'Submissions' : 'Forms'}
            </button>
          ))}
        </div>
        {tab === 'forms' && (
          <button
            onClick={() => { setShowBuilder(!showBuilder); setCreatedLink(null) }}
            className="flex min-h-9 cursor-pointer items-center gap-1 rounded px-2 text-xs text-cyan-800 transition-colors hover:bg-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-cyan-300 dark:hover:bg-cyan-500/20"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New form
          </button>
        )}
      </div>

      {/* Forms tab */}
      {tab === 'forms' && (
        <div className="flex-1 overflow-y-auto">
          {createdLink && (
            <div className="mx-2 mt-2 space-y-1 rounded border border-emerald-300 bg-emerald-50 p-2 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <p className="text-xs font-medium text-emerald-900 dark:text-emerald-300">Form created. Share link:</p>
              <div className="flex items-center gap-1">
                <code className="flex-1 truncate rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">{createdLink}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(createdLink).catch(() => {}) }}
                  className="inline-flex min-h-9 min-w-9 shrink-0 cursor-pointer items-center justify-center rounded text-emerald-800 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                  aria-label="Copy link"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
          {showBuilder && (
            <Suspense fallback={<div className="p-4 text-center text-xs text-muted-foreground">Loading builder…</div>}>
              <CopIntakeFormBuilder
                sessionId={sessionId}
                onSaved={(_id, shareToken) => {
                  const link = `${window.location.origin}/drop/${shareToken}`
                  setCreatedLink(link)
                  setShowBuilder(false)
                  navigator.clipboard.writeText(link).catch(() => {})
                }}
              />
            </Suspense>
          )}
          {!showBuilder && !createdLink && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              <p>Create a form to collect tips from people outside the COP. What they send lands in Submissions.</p>
              <p className="mt-1">Or type <code className="rounded bg-muted px-1 py-0.5">survey: Title</code> in the capture bar.</p>
            </div>
          )}
        </div>
      )}

      {/* Inbox tab */}
      {tab === 'inbox' && (
        <>
          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 px-2 py-1.5 dark:border-slate-800" role="group" aria-label="Show">
            {['pending', 'accepted', 'rejected', ''].map(s => (
              <button
                key={s || 'all'}
                onClick={() => setFilter(s)}
                aria-pressed={filter === s}
                className={cn(
                  'min-h-9 shrink-0 cursor-pointer rounded-full px-3 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500',
                  filter === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-4 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading submissions…
              </div>
            ) : loadError ? (
              <div className="p-4 text-center text-xs text-red-700 dark:text-red-400" role="alert">
                {loadError}{' '}
                <button type="button" onClick={() => fetchSubmissions()} className="underline">Try again</button>
              </div>
            ) : submissions.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                <Inbox className="mx-auto mb-1 h-5 w-5" aria-hidden="true" />
                {filter === 'pending'
                  ? 'Nothing to review. Tips from your forms and drop links land here.'
                  : 'No submissions here yet.'}
              </div>
            ) : (
              submissions.map(sub => {
                const source = sourceLabel(sub)
                const subTags = tagsOf(sub)
                const filed = inCop(sub)
                const open = expandedId === sub.id
                return (
                  <div key={sub.id} className="border-b border-slate-200 last:border-0 dark:border-slate-800">
                    <button
                      onClick={() => setExpandedId(open ? null : sub.id)}
                      aria-expanded={open}
                      className="w-full px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className={cn('rounded-full border px-1.5 py-0.5 text-[11px] font-medium', STATUS_COLORS[sub.status])}>
                            {STATUS_LABEL[sub.status] ?? sub.status}
                          </span>
                          {filed && (
                            <span className="rounded-full border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200">
                              In the COP · unverified
                            </span>
                          )}
                          {source && <span className="text-[11px] text-muted-foreground">{source}</span>}
                          <span className="truncate text-xs">{sub.form_title || sub.submitter_name || 'Anonymous'}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                          {sub.lat != null && <MapPin className="h-3.5 w-3.5" aria-label="Has a location" />}
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="text-[11px]">{new Date(sub.created_at).toLocaleDateString()}</span>
                          {open ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
                        </div>
                      </div>
                      {subTags.length > 0 && <TagChips tags={subTags} max={4} className="mt-1" />}
                    </button>

                    {open && (
                      <div className="space-y-2 px-3 pb-3">
                        <div className="space-y-1 rounded bg-muted/30 p-2 text-xs">
                          {Array.isArray((sub.form_data as Record<string, unknown>)._attachments) && (
                            <div className="space-y-0.5 rounded border border-border p-1.5">
                              <span className="font-medium text-muted-foreground">Attachments:</span>
                              {((sub.form_data as Record<string, unknown>)._attachments as { key?: string; name?: string; size?: number }[]).map((file, i) => (
                                <div key={file.key ?? i} className="break-all">
                                  {String(file.name ?? 'file')} ({Math.ceil(Number(file.size || 0) / 1024)} KB)
                                </div>
                              ))}
                            </div>
                          )}
                          {Object.entries(sub.form_data).filter(([key]) => !key.startsWith('_')).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <span className="shrink-0 font-medium text-muted-foreground">{key}:</span>
                              <FieldValue value={value} />
                            </div>
                          ))}
                        </div>

                        {sub.submitter_contact && (
                          <div className="text-xs text-muted-foreground">Contact: {sub.submitter_contact}</div>
                        )}

                        {sub.status === 'pending' && (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => handleTriage(sub, 'accepted')}
                              disabled={busyId === sub.id}
                              className="flex min-h-11 items-center gap-1.5 rounded-md bg-emerald-700 px-3 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                            >
                              {busyId === sub.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                              {filed ? 'Mark reviewed' : 'Accept into the COP'}
                            </button>
                            <button
                              onClick={() => handleTriage(sub, 'rejected')}
                              disabled={busyId === sub.id}
                              className="flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm text-red-800 transition-colors hover:bg-red-50 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 dark:text-red-300 dark:hover:bg-red-500/20"
                            >
                              <X className="h-4 w-4" aria-hidden="true" /> Reject
                            </button>
                          </div>
                        )}
                        {triageMessage?.id === sub.id && (
                          <p role="status" className={cn('text-xs', triageMessage.ok ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-700 dark:text-red-400')}>
                            {triageMessage.text}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
