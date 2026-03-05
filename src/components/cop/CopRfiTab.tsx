import { useState, useEffect, useCallback, useRef } from 'react'
import {
  HelpCircle,
  Plus,
  ChevronDown,
  ChevronRight,
  Check,
  ExternalLink,
  Loader2,
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
  const [expandedRfi, setExpandedRfi] = useState<string | null>(null)

  // New RFI form
  const [showForm, setShowForm] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [newPriority, setNewPriority] = useState<CopRfiPriority>('medium')
  const [submitting, setSubmitting] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch RFIs ──────────────────────────────────────────────

  const fetchRfis = useCallback(async () => {
    try {
      const res = await fetch(`/api/cop/${sessionId}/rfis`)
      if (!res.ok) return
      const data = await res.json()
      const items: CopRfi[] = data.rfis ?? data ?? []
      setRfis(items)
      const openCount = items.filter(r => r.status === 'open').length
      onRfiCountChange?.(openCount)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [sessionId, onRfiCountChange])

  // Initial fetch
  useEffect(() => {
    fetchRfis()
  }, [fetchRfis])

  // Poll every 30s
  useEffect(() => {
    intervalRef.current = setInterval(fetchRfis, 30000)
    return () => {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, priority: newPriority }),
      })
      if (!res.ok) throw new Error('Failed to create RFI')
      setNewQuestion('')
      setNewPriority('medium')
      setShowForm(false)
      await fetchRfis()
    } catch {
      // ignore
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer_id: answerId, is_accepted: true }),
        })
        await fetchRfis()
      } catch {
        // ignore
      }
    },
    [sessionId, fetchRfis]
  )

  // ── Toggle expand ───────────────────────────────────────────

  const toggleExpand = (rfiId: string) => {
    setExpandedRfi(prev => (prev === rfiId ? null : rfiId))
  }

  const openCount = rfis.filter(r => r.status === 'open').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">RFI</h2>
          {openCount > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-blue-500 text-white text-[10px] font-bold px-1">
              {openCount}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm(!showForm)}
          className="h-6 text-[10px] px-2 border-gray-600 text-gray-300 hover:bg-gray-800"
        >
          <Plus className="h-3 w-3 mr-0.5" />
          New RFI
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {/* New RFI form */}
        {showForm && (
          <div className="rounded border border-gray-700 bg-gray-800/60 p-2 space-y-2">
            <textarea
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              placeholder="What do you need to know?"
              rows={2}
              className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as CopRfiPriority)}
                className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {PRIORITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
          <p className="text-xs text-gray-500 text-center py-4">Loading RFIs...</p>
        ) : sortedRfis.length > 0 ? (
          sortedRfis.map(rfi => {
            const isExpanded = expandedRfi === rfi.id
            const answers: CopRfiAnswer[] = rfi.answers ?? []

            return (
              <div
                key={rfi.id}
                className="rounded border border-gray-700 bg-gray-800/30"
              >
                {/* RFI header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(rfi.id)}
                  className="w-full flex items-start gap-2 px-2.5 py-2 text-left hover:bg-gray-800/50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-gray-500 mt-0.5 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-gray-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs text-gray-200 leading-relaxed">{rfi.question}</p>
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
                  <div className="border-t border-gray-700 px-2.5 py-2 space-y-2">
                    {answers.length > 0 ? (
                      answers.map(answer => (
                        <div
                          key={answer.id}
                          className="rounded bg-gray-800/60 px-2 py-1.5 space-y-1"
                        >
                          <p className="text-xs text-gray-300">{answer.answer_text}</p>
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
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="text-center py-6">
            <HelpCircle className="h-6 w-6 text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">
              No RFIs yet. Create one to request information.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
