import { useState, useEffect, useCallback } from 'react'
import { useCopChangeListener } from '@/hooks/useCopChanges'
import { getCopHeaders } from '@/lib/cop-auth'
import {
  HelpCircle,
  Plus,
  ChevronDown,
  ChevronRight,
  Check,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Star,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CopRfi, CopRfiAnswer, CopRfiPriority } from '@/types/cop'
import { RFI_PRIORITY_COLORS } from '@/types/cop'
import { splitKeyQuestions, type QuestionLike } from '@/components/cop/shell/key-questions'
import { FiledEvidence } from '@/components/cop/evidence-links/FiledEvidence'

/** An RFI as the list returns it; `is_key` once the server stars key questions. */
type KeyRfi = CopRfi & QuestionLike

// ── Priority options ─────────────────────────────────────────────

const PRIORITY_OPTIONS: { value: CopRfiPriority; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

// ── Status badge colors ──────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  open: '#3b82f6',
  answered: '#f59e0b',
  accepted: '#22c55e',
  closed: '#6b7280',
}

// ── Props ────────────────────────────────────────────────────────

interface CopRfiTabProps {
  sessionId: string
  onRfiCountChange?: (count: number) => void
  /** The session's key questions: shown starred, and offered as RFIs until tracked. */
  keyQuestions?: string[] | null
}

// ── Component ────────────────────────────────────────────────────

export default function CopRfiTab({ sessionId, onRfiCountChange, keyQuestions }: CopRfiTabProps) {
  const [rfis, setRfis] = useState<KeyRfi[]>([])
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [expandedRfi, setExpandedRfi] = useState<string | null>(null)

  // New RFI form
  const [showForm, setShowForm] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [newPriority, setNewPriority] = useState<CopRfiPriority>('medium')
  const [newRequester, setNewRequester] = useState('')
  const [isBlocker, setIsBlocker] = useState(false)
  const [submitting, setSubmitting] = useState(false)


  // ── Fetch RFIs ──────────────────────────────────────────────

  const fetchRfis = useCallback(async (isBackground = false, signal?: AbortSignal) => {
    if (isBackground) setPolling(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/rfis`, { headers: getCopHeaders(), signal })
      if (!res.ok) throw new Error('Failed to fetch RFIs')
      const data = await res.json()
      const items: KeyRfi[] = data.rfis ?? data ?? []
      setRfis(items)
      setFetchError(false)
      const openCount = items.filter(r => r.status === 'open').length
      onRfiCountChange?.(openCount)
    } catch (e: any) {
      if (e?.name !== 'AbortError' && !isBackground) setFetchError(true)
    } finally {
      setLoading(false)
      setPolling(false)
    }
  }, [sessionId, onRfiCountChange])

  // Initial fetch; afterwards the COP change feed says when RFIs changed.
  useEffect(() => {
    const controller = new AbortController()
    fetchRfis(false, controller.signal)
    return () => controller.abort()
  }, [fetchRfis])
  useCopChangeListener(['rfi'], () => { fetchRfis(true) })

  // ── Sort RFIs: priority then date ──────────────────────────

  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }

  const sortedRfis = [...rfis].sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 9
    const pb = priorityOrder[b.priority] ?? 9
    if (pa !== pb) return pa - pb
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Key questions are starred RFIs: listed first.
  const split = splitKeyQuestions(sortedRfis, keyQuestions)
  const keyIds = new Set(split.key.map((r) => r.id))
  const orderedRfis = [...split.key, ...split.others]

  // ── Track a key question as an RFI ──────────────────────────

  const [trackingKey, setTrackingKey] = useState<string | null>(null)
  const [trackError, setTrackError] = useState<string | null>(null)

  const createKeyRfi = useCallback(async (question: string): Promise<string | null> => {
    const res = await fetch(`/api/cop/${sessionId}/rfis`, {
      method: 'POST',
      headers: getCopHeaders(),
      body: JSON.stringify({ question, priority: 'high', requester_name: 'Key question', is_key: true }),
    })
    if (!res.ok) throw new Error(res.status === 403 ? 'Only the session owner or an editor can add questions.' : `Couldn't add it (HTTP ${res.status}).`)
    const body = await res.json().catch(() => null) as { id?: unknown } | null
    return typeof body?.id === 'string' ? body.id : null
  }, [sessionId])

  // Evidence is filed under an RFI: a key question not tracked yet becomes one first,
  // then opens with "Add evidence" ready. Its status stays open.
  const [addEvidenceFor, setAddEvidenceFor] = useState<string | null>(null)
  const trackAndAddEvidence = useCallback(async (question: string) => {
    setTrackError(null)
    setTrackingKey(question)
    try {
      const id = await createKeyRfi(question)
      await fetchRfis()
      if (id) {
        setExpandedRfi(id)
        setAddEvidenceFor(id)
      }
    } catch (err) {
      setTrackError(err instanceof Error ? err.message : "Couldn't add it.")
    } finally {
      setTrackingKey(null)
    }
  }, [createKeyRfi, fetchRfis])

  const trackKeyQuestions = useCallback(async (questions: string[]) => {
    setTrackError(null)
    setTrackingKey(questions.length === 1 ? questions[0] : '*')
    try {
      for (const question of questions) await createKeyRfi(question)
    } catch (err) {
      setTrackError(err instanceof Error ? err.message : "Couldn't add it.")
    } finally {
      setTrackingKey(null)
      await fetchRfis()
    }
  }, [createKeyRfi, fetchRfis])

  // ── Star / unstar (servers that report is_key) ──────────────

  const handleToggleKey = useCallback(async (rfi: KeyRfi) => {
    const next = !(rfi.is_key && rfi.is_key !== 0)
    setRfis((prev) => prev.map((r) => (r.id === rfi.id ? { ...r, is_key: next ? 1 : 0 } : r)))
    try {
      const res = await fetch(`/api/cop/${sessionId}/rfis`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({ id: rfi.id, is_key: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      console.error('[CopRfiTab] Star failed:', err)
      setRfis((prev) => prev.map((r) => (r.id === rfi.id ? { ...r, is_key: rfi.is_key } : r)))
    }
  }, [sessionId])

  // ── Create RFI ──────────────────────────────────────────────

  const handleCreateRfi = useCallback(async () => {
    const trimmed = newQuestion.trim()
    if (!trimmed) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/rfis`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({
          question: trimmed,
          priority: newPriority,
          is_blocker: isBlocker,
          requester_name: newRequester.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to create RFI')
      setNewQuestion('')
      setNewPriority('medium')
      setNewRequester('')
      setIsBlocker(false)
      setShowForm(false)
      await fetchRfis()
    } catch (err) {
      console.error('[CopRfiTab] Create RFI failed:', err)
    } finally {
      setSubmitting(false)
    }
  }, [newQuestion, newPriority, isBlocker, newRequester, sessionId, fetchRfis])

  // ── Accept answer ───────────────────────────────────────────

  const handleAcceptAnswer = useCallback(
    async (rfiId: string, answerId: string) => {
      try {
        await fetch(`/api/cop/${sessionId}/rfis/${rfiId}/answers`, {
          method: 'PUT',
          headers: getCopHeaders(),
          body: JSON.stringify({ answer_id: answerId, is_accepted: true }),
        })
        await fetchRfis()
      } catch (err) {
        console.error('[CopRfiTab] Accept answer failed:', err)
      }
    },
    [sessionId, fetchRfis]
  )

  // ── Submit answer ──────────────────────────────────────────

  const [answerText, setAnswerText] = useState('')
  const [answerSource, setAnswerSource] = useState('')
  const [answerResponder, setAnswerResponder] = useState('')
  const [submittingAnswer, setSubmittingAnswer] = useState(false)

  const handleSubmitAnswer = useCallback(
    async (rfiId: string) => {
      const trimmed = answerText.trim()
      if (!trimmed) return

      setSubmittingAnswer(true)
      try {
        const res = await fetch(`/api/cop/${sessionId}/rfis/${rfiId}/answers`, {
          method: 'POST',
          headers: getCopHeaders(),
          body: JSON.stringify({
            answer_text: trimmed,
            source_url: answerSource.trim() || undefined,
            responder_name: answerResponder.trim() || undefined,
          }),
        })
        if (!res.ok) throw new Error('Failed to submit answer')
        setAnswerText('')
        setAnswerSource('')
        setAnswerResponder('')
        await fetchRfis()
      } catch (err) {
        console.error('[CopRfiTab] Submit answer failed:', err)
      } finally {
        setSubmittingAnswer(false)
      }
    },
    [answerText, answerSource, answerResponder, sessionId, fetchRfis]
  )

  // ── Toggle blocker ──────────────────────────────────────────

  const handleToggleBlocker = useCallback(
    async (rfiId: string, currentValue: number) => {
      const newValue = currentValue === 1 ? 0 : 1
      setRfis((prev) =>
        prev.map((r) =>
          r.id === rfiId ? { ...r, is_blocker: newValue } as any : r,
        ),
      )
      try {
        await fetch(`/api/cop/${sessionId}/rfis`, {
          method: 'PUT',
          headers: getCopHeaders(),
          body: JSON.stringify({ id: rfiId, is_blocker: newValue }),
        })
      } catch (err) {
        console.error('[CopRfiTab] Toggle blocker failed:', err)
        setRfis((prev) =>
          prev.map((r) =>
            r.id === rfiId ? { ...r, is_blocker: currentValue } as any : r,
          ),
        )
      }
    },
    [sessionId],
  )

  // ── Update RFI status ────────────────────────────────────────

  const handleStatusChange = useCallback(
    async (rfiId: string, newStatus: string) => {
      setRfis((prev) =>
        prev.map((r) => r.id === rfiId ? { ...r, status: newStatus } as any : r),
      )
      try {
        await fetch(`/api/cop/${sessionId}/rfis`, {
          method: 'PUT',
          headers: getCopHeaders(),
          body: JSON.stringify({ id: rfiId, status: newStatus }),
        })
        await fetchRfis()
      } catch (err) {
        console.error('[CopRfiTab] Status change failed:', err)
        await fetchRfis()
      }
    },
    [sessionId, fetchRfis],
  )

  // ── Assign RFI ───────────────────────────────────────────────

  const handleAssign = useCallback(
    async (rfiId: string, assignedTo: string) => {
      try {
        await fetch(`/api/cop/${sessionId}/rfis`, {
          method: 'PUT',
          headers: getCopHeaders(),
          body: JSON.stringify({ id: rfiId, assigned_to: assignedTo || null }),
        })
        await fetchRfis()
      } catch (err) {
        console.error('[CopRfiTab] Assign RFI failed:', err)
      }
    },
    [sessionId, fetchRfis],
  )

  // ── Toggle expand ───────────────────────────────────────────

  const toggleExpand = (rfiId: string) => {
    setExpandedRfi(prev => {
      if (prev !== rfiId) {
        setAnswerText('')
        setAnswerSource('')
        setAnswerResponder('')
      }
      return prev === rfiId ? null : rfiId
    })
  }

  const openCount = rfis.filter(r => r.status === 'open').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-200">
            Questions <span className="font-normal text-gray-500 dark:text-gray-400">· RFIs</span>
          </h2>
          {openCount > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-blue-500 text-white text-[10px] font-bold px-1">
              {openCount}
            </span>
          )}
          {polling && (
            <Loader2 className="h-3 w-3 text-gray-500 animate-spin" />
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm(!showForm)}
          className="h-6 pointer-coarse:h-11 pointer-coarse:px-3 pointer-coarse:text-sm text-[10px] px-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Plus className="h-3 w-3 mr-0.5" />
          New question
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {/* New RFI form */}
        {showForm && (
          <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-2 space-y-2">
            <textarea
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              placeholder="What do you need to know?"
              rows={2}
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as CopRfiPriority)}
                className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {PRIORITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newRequester}
                onChange={e => setNewRequester(e.target.value)}
                placeholder="Your name"
                className="w-24 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBlocker}
                  onChange={e => setIsBlocker(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-red-500 focus:ring-red-500 h-3 w-3"
                />
                <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium uppercase">Blocker</span>
              </label>
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={handleCreateRfi}
                disabled={submitting || !newQuestion.trim()}
                className="h-6 text-[10px] px-2"
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Submit'}
              </Button>
            </div>
          </div>
        )}

        {/* Key questions that no RFI tracks yet */}
        {!loading && !fetchError && split.untracked.length > 0 && (
          <div className="rounded border border-amber-300/60 bg-amber-50 p-2 space-y-1.5 dark:border-amber-700/50 dark:bg-amber-950/20">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                <Star className="h-3 w-3 fill-amber-400 text-amber-500" aria-hidden="true" />
                Key questions not yet tracked as RFIs
              </p>
              {split.untracked.length > 1 && (
                <button
                  type="button"
                  onClick={() => trackKeyQuestions(split.untracked)}
                  disabled={trackingKey !== null}
                  className="shrink-0 rounded px-1.5 py-0.5 pointer-coarse:min-h-11 pointer-coarse:px-3 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:text-amber-300 dark:hover:bg-amber-900/40 cursor-pointer"
                >
                  {trackingKey === '*' ? 'Adding…' : 'Track all'}
                </button>
              )}
            </div>
            <ul className="space-y-1">
              {split.untracked.map((question) => (
                <li key={question} className="flex items-start gap-2">
                  <span className="flex-1 text-xs text-gray-800 dark:text-gray-200">{question}</span>
                  <button
                    type="button"
                    onClick={() => trackAndAddEvidence(question)}
                    disabled={trackingKey !== null}
                    className="shrink-0 rounded px-1.5 py-0.5 pointer-coarse:min-h-11 pointer-coarse:px-3 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:text-amber-300 dark:hover:bg-amber-900/40 cursor-pointer"
                  >
                    Add evidence
                  </button>
                  <button
                    type="button"
                    onClick={() => trackKeyQuestions([question])}
                    disabled={trackingKey !== null}
                    className="shrink-0 rounded border border-amber-400/70 px-1.5 py-0.5 pointer-coarse:min-h-11 pointer-coarse:px-3 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/40 cursor-pointer"
                  >
                    {trackingKey === question ? 'Adding…' : 'Track as RFI'}
                  </button>
                </li>
              ))}
            </ul>
            {trackError && <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">{trackError}</p>}
          </div>
        )}

        {/* RFI list */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
            <span className="text-xs text-gray-500">Loading RFIs...</span>
          </div>
        ) : fetchError ? (
          <div className="text-center py-6">
            <p className="text-xs text-gray-500 mb-2">Failed to load RFIs.</p>
            <button
              type="button"
              onClick={() => { setLoading(true); setFetchError(false); fetchRfis() }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : orderedRfis.length > 0 ? (
          orderedRfis.map(rfi => {
            const isExpanded = expandedRfi === rfi.id
            const isKey = keyIds.has(rfi.id)
            const answers: CopRfiAnswer[] = rfi.answers ?? []

            return (
              <div
                key={rfi.id}
                className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30"
              >
                {/* RFI header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(rfi.id)}
                  aria-expanded={isExpanded}
                  className="w-full flex items-start gap-2 px-2.5 py-2 pointer-coarse:min-h-11 text-left hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-gray-500 mt-0.5 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-gray-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs pointer-coarse:text-sm text-gray-900 dark:text-gray-200 leading-relaxed">
                      {isKey && <Star className="inline h-3 w-3 mr-1 -mt-0.5 fill-amber-400 text-amber-500" aria-label="Key question" />}
                      {rfi.question}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge
                        className="text-white text-[9px] px-1.5 py-0 leading-4"
                        style={{
                          backgroundColor: RFI_PRIORITY_COLORS[rfi.priority],
                          borderColor: RFI_PRIORITY_COLORS[rfi.priority],
                        }}
                      >
                        {rfi.priority}
                      </Badge>
                      <Badge
                        className="text-white text-[9px] px-1.5 py-0 leading-4"
                        style={{
                          backgroundColor: STATUS_COLORS[rfi.status] ?? '#6b7280',
                          borderColor: STATUS_COLORS[rfi.status] ?? '#6b7280',
                        }}
                      >
                        {rfi.status}
                      </Badge>
                      {(rfi as any).is_blocker === 1 && (
                        <Badge
                          className="text-[9px] px-1.5 py-0 leading-4 bg-red-900/50 text-red-400 border-red-500/30"
                        >
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                          BLOCKER
                        </Badge>
                      )}
                      {(rfi as any).requester_name && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          by {(rfi as any).requester_name}
                        </span>
                      )}
                      {(rfi.evidence_count ?? 0) > 0 && (
                        <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">
                          {rfi.evidence_count} evidence
                        </span>
                      )}
                      {answers.length > 0 && (
                        <span className="text-[10px] text-gray-500">
                          {answers.length} answer{answers.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded answers */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 px-2.5 py-2 space-y-2">
                    {/* Controls row: blocker, assign, status */}
                    <div className="flex flex-wrap items-center gap-2 py-1">
                      {split.serverStars && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleKey(rfi)}
                            aria-pressed={isKey}
                            className="flex items-center gap-1 rounded px-1 py-0.5 pointer-coarse:min-h-11 pointer-coarse:px-2 text-[10px] text-gray-600 hover:bg-amber-50 dark:text-gray-400 dark:hover:bg-amber-950/30 cursor-pointer"
                          >
                            <Star className={isKey ? 'h-3.5 w-3.5 fill-amber-400 text-amber-500' : 'h-3.5 w-3.5'} aria-hidden="true" />
                            {isKey ? 'Key question' : 'Make key question'}
                          </button>
                          <div className="h-3 w-px bg-gray-300 dark:bg-gray-600" />
                        </>
                      )}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(rfi as any).is_blocker === 1}
                          onChange={() => handleToggleBlocker(rfi.id, (rfi as any).is_blocker ?? 0)}
                          className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-red-500 focus:ring-red-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <span className="text-[10px] text-gray-600 dark:text-gray-400">Blocker</span>
                      </label>
                      <div className="h-3 w-px bg-gray-300 dark:bg-gray-600" />
                      <input
                        type="text"
                        defaultValue={(rfi as any).assigned_to ?? ''}
                        placeholder="Assign to..."
                        onBlur={(e) => handleAssign(rfi.id, e.target.value.trim())}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        className="w-28 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex-1" />
                      {rfi.status !== 'closed' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(rfi.id, 'closed')}
                          className="h-5 text-[10px] px-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          Close
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(rfi.id, 'open')}
                          className="h-5 text-[10px] px-1.5 text-blue-500 hover:text-blue-700"
                        >
                          Reopen
                        </Button>
                      )}
                    </div>

                    <FiledEvidence
                      sessionId={sessionId}
                      targetType="rfi"
                      targetId={rfi.id}
                      label="question"
                      startOpen={addEvidenceFor === rfi.id}
                      className="rounded border border-gray-200 bg-white/60 p-2 dark:border-gray-700 dark:bg-gray-900/30"
                    />

                    <h4 className="pt-1 text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                      Answers <span className="font-normal text-gray-500 dark:text-gray-400">(optional — the question can stay open)</span>
                    </h4>
                    {answers.length > 0 ? (
                      answers.map(answer => (
                        <div
                          key={answer.id}
                          className="rounded bg-gray-100 dark:bg-gray-800/60 px-2 py-1.5 space-y-1"
                        >
                          <p className="text-xs text-gray-700 dark:text-gray-300">{answer.answer_text}</p>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500">
                            {answer.source_url && (
                              <a
                                href={answer.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-blue-400 hover:text-blue-300"
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                                Source
                              </a>
                            )}
                            {answer.responder_name && (
                              <span>{answer.responder_name}</span>
                            )}
                            <span>{new Date(answer.created_at).toLocaleString()}</span>
                            <div className="flex-1" />
                            {!answer.is_accepted && rfi.status !== 'accepted' && (
                              <button
                                type="button"
                                onClick={() => handleAcceptAnswer(rfi.id, answer.id)}
                                className="flex items-center gap-0.5 text-green-400 hover:text-green-300"
                                title="Accept this answer"
                              >
                                <Check className="h-3 w-3" />
                                Accept
                              </button>
                            )}
                            {answer.is_accepted === 1 && (
                              <span className="text-green-400 flex items-center gap-0.5">
                                <Check className="h-3 w-3" />
                                Accepted
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-gray-500 italic">No answers yet.</p>
                    )}

                    {/* Answer submission form */}
                    {rfi.status !== 'accepted' && rfi.status !== 'closed' && (
                      <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-2 space-y-1.5 mt-1">
                        <textarea
                          value={answerText}
                          onChange={e => setAnswerText(e.target.value)}
                          placeholder="Your answer..."
                          rows={2}
                          className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="url"
                            value={answerSource}
                            onChange={e => setAnswerSource(e.target.value)}
                            placeholder="Source URL (optional)"
                            className="flex-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={answerResponder}
                            onChange={e => setAnswerResponder(e.target.value)}
                            placeholder="Name (optional)"
                            className="w-24 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleSubmitAnswer(rfi.id)}
                            disabled={submittingAnswer || !answerText.trim()}
                            className="h-6 text-[10px] px-2"
                          >
                            {submittingAnswer ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Submit'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="text-center py-6">
            <HelpCircle className="h-6 w-6 text-gray-500 dark:text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No questions yet. Ask one with New question, or with !question in the Signal room.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
