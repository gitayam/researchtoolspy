import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { getCopHeaders } from '../../lib/cop-auth'
import { Inbox, Check, X, FileText, MapPin, Clock, ChevronDown, ChevronUp, Plus, Link2, Copy } from 'lucide-react'
import type { CopSubmission } from '../../types/cop'

const CopIntakeFormBuilder = lazy(() => import('./CopIntakeFormBuilder'))

interface CopSubmissionInboxProps {
  sessionId: string
  expanded: boolean
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  triaged: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  accepted: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function CopSubmissionInbox({ sessionId, expanded }: CopSubmissionInboxProps) {
  const [submissions, setSubmissions] = useState<CopSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const [tab, setTab] = useState<'inbox' | 'forms'>('inbox')
  const [showBuilder, setShowBuilder] = useState(false)
  const [createdLink, setCreatedLink] = useState<string | null>(null)

  const fetchSubmissions = useCallback(async (signal?: AbortSignal) => {
    try {
      const params = filter ? `?status=${filter}` : ''
      const res = await fetch(`/api/cop/${sessionId}/submissions${params}`, {
        headers: getCopHeaders(),
        signal,
      })
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setSubmissions(data.submissions ?? [])
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
    } finally {
      setLoading(false)
    }
  }, [sessionId, filter])

  useEffect(() => {
    const controller = new AbortController()
    fetchSubmissions(controller.signal)
    intervalRef.current = setInterval(() => fetchSubmissions(controller.signal), 30000)
    return () => {
      controller.abort()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchSubmissions])

  const handleTriage = useCallback(async (subId: string, status: 'accepted' | 'rejected', rejectionReason?: string) => {
    try {
      const res = await fetch(`/api/cop/${sessionId}/submissions`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({ id: subId, status, rejection_reason: rejectionReason || null }),
      })
      if (!res.ok) throw new Error('Failed to triage')
      await fetchSubmissions()
    } catch (err) {
      console.error('[CopSubmissionInbox] Triage failed:', err)
    }
  }, [sessionId, fetchSubmissions])

  if (!expanded) {
    const pendingCount = submissions.filter(s => s.status === 'pending').length
    return (
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {pendingCount > 0 && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
              {pendingCount} pending
            </span>
          )}
          <span className="text-[9px] text-muted-foreground">{submissions.length} total</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar + actions */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1">
          {(['inbox', 'forms'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setShowBuilder(false); setCreatedLink(null) }}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {t === 'inbox' ? 'Submissions' : 'Forms'}
            </button>
          ))}
        </div>
        {tab === 'forms' && (
          <button
            onClick={() => { setShowBuilder(!showBuilder); setCreatedLink(null) }}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors cursor-pointer"
          >
            <Plus className="h-3 w-3" /> New Form
          </button>
        )}
      </div>

      {/* Forms tab */}
      {tab === 'forms' && (
        <div className="flex-1 overflow-y-auto">
          {createdLink && (
            <div className="mx-2 mt-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 space-y-1">
              <p className="text-[10px] font-medium text-emerald-400">Form created! Share link:</p>
              <div className="flex items-center gap-1">
                <code className="text-[10px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded flex-1 truncate">{createdLink}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(createdLink); }}
                  className="shrink-0 p-1 rounded hover:bg-emerald-500/20 text-emerald-400 cursor-pointer"
                  title="Copy link"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
          {showBuilder && (
            <Suspense fallback={<div className="p-4 text-xs text-muted-foreground text-center">Loading builder...</div>}>
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
              <p>Create intake forms to crowdsource data from contributors.</p>
              <p className="mt-1 text-[10px]">Or type <code className="px-1 py-0.5 rounded bg-muted">drop: Title</code> in the capture bar.</p>
            </div>
          )}
        </div>
      )}

      {/* Inbox tab */}
      {tab === 'inbox' && (
        <>
      {/* Filter bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 dark:border-slate-800">
        {['pending', 'accepted', 'rejected', ''].map(s => (
          <button
            key={s || 'all'}
            onClick={() => setFilter(s)}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
              filter === s
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Submissions list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
        ) : submissions.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">No submissions</div>
        ) : (
          submissions.map(sub => (
            <div key={sub.id} className="border-b border-slate-200 dark:border-slate-800 last:border-0">
              <button
                onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[sub.status]}`}>
                      {sub.status}
                    </span>
                    <span className="text-xs truncate">{sub.submitter_name || 'Anonymous'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {sub.lat != null && <MapPin className="h-3 w-3 text-muted-foreground" />}
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </span>
                    {expandedId === sub.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </div>
                </div>
              </button>

              {expandedId === sub.id && (
                <div className="px-3 pb-3 space-y-2">
                  {/* Form data */}
                  <div className="bg-muted/30 rounded p-2 text-xs space-y-1">
                    {Object.entries(sub.form_data).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="font-medium text-muted-foreground">{key}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Contact info */}
                  {sub.submitter_contact && (
                    <div className="text-[10px] text-muted-foreground">
                      Contact: {sub.submitter_contact}
                    </div>
                  )}

                  {/* Triage actions */}
                  {sub.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTriage(sub.id, 'accepted')}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                      >
                        <Check className="h-3 w-3" /> Accept
                      </button>
                      <button
                        onClick={() => handleTriage(sub.id, 'rejected')}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      >
                        <X className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
        </>
      )}
    </div>
  )
}
