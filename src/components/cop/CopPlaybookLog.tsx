import { useState, useEffect, useCallback, useRef } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────

type LogStatus = 'success' | 'partial' | 'failed'

interface LogEntry {
  id: string
  rule_id: string
  rule_name: string
  trigger_event: string
  trigger_event_id: string | null
  actions_taken: Array<{ action: string; result?: Record<string, unknown>; error?: string }>
  status: LogStatus
  error_message: string | null
  duration_ms: number | null
  created_at: string
}

interface CopPlaybookLogProps {
  sessionId: string
  playbookId: string
  onClose?: () => void
}

// ── Constants ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LogStatus, { label: string; icon: typeof CheckCircle2; color: string }> = {
  success: { label: 'Success', icon: CheckCircle2, color: 'text-green-400' },
  partial: { label: 'Partial', icon: AlertTriangle, color: 'text-yellow-400' },
  failed:  { label: 'Failed',  icon: XCircle,      color: 'text-red-400' },
}

const PAGE_SIZE = 30

// ── Component ─────────────────────────────────────────────────────

export default function CopPlaybookLog({ sessionId, playbookId, onClose }: CopPlaybookLogProps) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState<LogStatus | ''>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const controllerRef = useRef<AbortController | null>(null)

  // ── Fetch ──────────────────────────────────────────────────

  const fetchLog = useCallback(async (newOffset: number, filter: string) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setLoading(true)
    try {
      let url = `/api/cop/${sessionId}/playbooks/${playbookId}/log?limit=${PAGE_SIZE}&offset=${newOffset}`
      if (filter) url += `&status=${filter}`

      const res = await fetch(url, { headers: getCopHeaders(), signal: controller.signal })
      if (!res.ok) throw new Error('Failed to fetch log')
      const data = await res.json()
      setEntries(data.log ?? [])
      setTotal(data.total ?? 0)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('[CopPlaybookLog] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [sessionId, playbookId])

  useEffect(() => {
    fetchLog(offset, statusFilter)
    return () => controllerRef.current?.abort()
  }, [fetchLog, offset, statusFilter])

  // ── Render ─────────────────────────────────────────────────

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-500 uppercase tracking-wider">
          Execution Log ({total})
        </div>
        <div className="flex items-center gap-2">
          {/* Status filter */}
          <div className="flex items-center gap-1">
            <Filter className="h-3 w-3 text-zinc-500" />
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as LogStatus | ''); setOffset(0) }}
              className="bg-zinc-900/50 border border-zinc-700 rounded px-1.5 py-0.5 text-[11px] text-zinc-300"
            >
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Close
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && entries.length === 0 && (
        <div className="flex items-center justify-center py-6 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading...
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="text-center py-6 text-zinc-500 text-sm">
          No execution log entries yet. Activate the playbook and wait for matching events.
        </div>
      )}

      {/* Log entries */}
      {entries.length > 0 && (
        <div className="space-y-1">
          {entries.map(entry => {
            const config = STATUS_CONFIG[entry.status]
            const StatusIcon = config.icon
            const isExpanded = expandedId === entry.id

            return (
              <div key={entry.id} className="bg-zinc-800/30 border border-zinc-700/40 rounded-lg overflow-hidden">
                {/* Entry header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-zinc-800/50 transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                    : <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                  }

                  <StatusIcon className={`h-3.5 w-3.5 ${config.color} shrink-0`} />

                  <span className="text-sm text-zinc-200 truncate flex-1">
                    {entry.rule_name || entry.rule_id}
                  </span>

                  {entry.trigger_event && (
                    <span className="text-[10px] text-zinc-500 shrink-0">
                      {entry.trigger_event}
                    </span>
                  )}

                  {entry.duration_ms !== null && (
                    <span className="text-[10px] text-zinc-600 flex items-center gap-0.5 shrink-0">
                      <Clock className="h-2.5 w-2.5" />
                      {entry.duration_ms}ms
                    </span>
                  )}

                  <span className="text-[10px] text-zinc-600 shrink-0">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-zinc-700/30 px-3 py-2 text-xs space-y-2">
                    {/* Actions taken */}
                    {entry.actions_taken.length > 0 && (
                      <div>
                        <div className="text-zinc-500 uppercase text-[10px] mb-1">
                          Actions ({entry.actions_taken.length})
                        </div>
                        {entry.actions_taken.map((a, i) => (
                          <div key={i} className="flex items-start gap-2 py-0.5">
                            {a.error
                              ? <XCircle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                              : <CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 shrink-0" />
                            }
                            <div className="min-w-0">
                              <span className="text-blue-400">{a.action}</span>
                              {a.result && (
                                <pre className="text-[10px] text-zinc-500 font-mono mt-0.5 whitespace-pre-wrap break-all">
                                  {JSON.stringify(a.result, null, 2)}
                                </pre>
                              )}
                              {a.error && (
                                <div className="text-red-400 mt-0.5">{a.error}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Error message */}
                    {entry.error_message && (
                      <div className="text-red-400 bg-red-500/10 rounded p-2">
                        {entry.error_message}
                      </div>
                    )}

                    {/* IDs */}
                    <div className="text-[10px] text-zinc-600 space-x-3">
                      <span>Log: {entry.id}</span>
                      <span>Rule: {entry.rule_id}</span>
                      {entry.trigger_event_id && <span>Event: {entry.trigger_event_id}</span>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="px-2 py-1 hover:text-zinc-300 disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="px-2 py-1 hover:text-zinc-300 disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
