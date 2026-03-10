import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FileText,
  Brain,
  HelpCircle,
  UserPlus,
  Settings,
  Activity,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCopHeaders } from '@/lib/cop-auth'

// ── Types ────────────────────────────────────────────────────────

interface ActivityItem {
  id: string
  cop_session_id: string
  user_id: number
  action: string
  entity_type: string
  entity_id: string
  summary: string
  created_at: string
}

interface CopActivityPanelProps {
  sessionId: string
  expanded: boolean
}

// ── Helpers ──────────────────────────────────────────────────────


function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Action icon mapping ──────────────────────────────────────────

const ACTION_ICONS: Record<string, { icon: typeof Activity; color: string }> = {
  added_evidence:       { icon: FileText,   color: 'text-blue-400' },
  ran_analysis:         { icon: Brain,       color: 'text-purple-400' },
  answered_rfi:         { icon: HelpCircle,  color: 'text-amber-400' },
  invited_collaborator: { icon: UserPlus,    color: 'text-green-400' },
  updated_session:      { icon: Settings,    color: 'text-gray-400' },
}

function getActionIcon(action: string) {
  return ACTION_ICONS[action] ?? { icon: Activity, color: 'text-gray-400' }
}

// ── Component ────────────────────────────────────────────────────

export default function CopActivityPanel({ sessionId, expanded }: CopActivityPanelProps) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch activity ──────────────────────────────────────────────

  const fetchActivity = useCallback(
    async (offset = 0, append = false, signal?: AbortSignal) => {
      if (!append) setLoading(true)
      else setLoadingMore(true)

      setError(null)

      try {
        const res = await fetch(
          `/api/cop/${sessionId}/activity?limit=50&offset=${offset}`,
          { headers: getCopHeaders(), signal },
        )

        if (!res.ok) {
          throw new Error(`Failed to fetch activity (${res.status})`)
        }

        const json = await res.json()
        const incoming: ActivityItem[] = json.activity ?? []

        setTotal(json.total ?? 0)

        if (append) {
          setItems((prev) => [...prev, ...incoming])
        } else {
          setItems(incoming)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load activity')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [sessionId],
  )

  // ── Initial fetch + auto-refresh every 30s ─────────────────────

  useEffect(() => {
    const controller = new AbortController()
    fetchActivity(0, false, controller.signal)

    intervalRef.current = setInterval(() => {
      fetchActivity(0, false, controller.signal)
    }, 30_000)

    return () => {
      controller.abort()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchActivity])

  // ── Load more handler ──────────────────────────────────────────

  const handleLoadMore = useCallback(() => {
    fetchActivity(items.length, true)
  }, [fetchActivity, items.length])

  // ── Loading state ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <p className="text-xs text-red-400">{error}</p>
      </div>
    )
  }

  // ── Empty state ────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
        <Activity className="h-6 w-6 text-gray-500 dark:text-gray-400" />
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">No activity yet</p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
          Actions like adding evidence, running analyses, and answering RFIs will appear here.
        </p>
      </div>
    )
  }

  // ── Activity list ──────────────────────────────────────────────

  const hasMore = total > items.length

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0">
        <ul className="divide-y divide-slate-200 dark:divide-gray-700">
          {items.map((item) => {
            const { icon: Icon, color } = getActionIcon(item.action)
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 px-3 py-2.5 bg-slate-50 dark:bg-gray-800/30 hover:bg-slate-100 dark:hover:bg-gray-800/50 transition-colors"
              >
                <span className={`mt-0.5 shrink-0 ${color}`}>
                  <Icon size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 dark:text-gray-200 leading-snug">{item.summary}</p>
                  <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-0.5">{timeAgo(item.created_at)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Load more — only visible in expanded mode when there are more items */}
      {expanded && hasMore && (
        <div className="border-t border-slate-200 dark:border-gray-700 px-3 py-2 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
