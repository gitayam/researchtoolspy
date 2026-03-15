import { useState, useEffect, useCallback, useRef } from 'react'
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
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CopRfi, CopRfiAnswer, CopRfiPriority } from '@/types/cop'
import { RFI_PRIORITY_COLORS } from '@/types/cop'

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
}

// ── Component ────────────────────────────────────────────────────

export default function CopRfiTab({ sessionId, onRfiCountChange }: CopRfiTabProps) {
  const [rfis, setRfis] = useState<CopRfi[]>([])
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

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch RFIs ──────────────────────────────────────────────

  const fetchRfis = useCallback(async (isBackground = false, signal?: AbortSignal) => {
    if (isBackground) setPolling(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/rfis`, { headers: getCopHeaders(), signal })
      if (!res.ok) throw new Error('Failed to fetch RFIs')
      const data = await res.json()
      const items: CopRfi[] = data.rfis ?? data ?? []
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

  // Initial fetch + poll every 30s
  useEffect(() => {
    const controller = new AbortController()
    fetchRfis(false, controller.signal)
    intervalRef.current = setInterval(() => fetchRfis(true, controller.signal), 30000)
    return () => {
      controller.abort()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchRfis])

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
  }, [newQuestion, newPriority, sessionId, fetchRfis])

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
    setExpandedRfi(prev => (prev === rfiId ? null : rfiId))
  }

  const openCount = rfis.filter(r => r.status === 'open').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-200 uppercase tracking-wider">RFI</h2>
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
          className="h-6 text-[10px] px-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Plus className="h-3 w-3 mr-0.5" />
          New RFI
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
        ) : sortedRfis.length > 0 ? (
          sortedRfis.map(rfi => {
            const isExpanded = expandedRfi === rfi.id
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
                  className="w-full flex items-start gap-2 px-2.5 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-gray-500 mt-0.5 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-gray-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs text-gray-900 dark:text-gray-200 leading-relaxed">{rfi.question}</p>
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
              No RFIs yet. Create one to request information.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
