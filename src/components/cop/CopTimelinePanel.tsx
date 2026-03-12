import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Users, FileText, Brain, Clock, Loader2, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getCopHeaders } from '@/lib/cop-auth'

// ── Types ────────────────────────────────────────────────────────

interface TimelineEntry {
  date: string
  events: number
  evidence: number
  analyses: number
}

interface RawActivity {
  date: string
  // timeline response shape
  events?: number
  event_count?: number
  evidence?: number
  evidence_count?: number
  analyses?: number
  framework_count?: number
  // intelligence/timeline response shape
  entities_added?: number
  evidence_added?: number
  frameworks_created?: number
}

interface CopTimelinePanelProps {
  sessionId: string
  expanded: boolean
}

// ── Helpers ──────────────────────────────────────────────────────

function normalizeEntry(raw: RawActivity): TimelineEntry {
  return {
    date: raw.date,
    events: raw.events ?? raw.event_count ?? raw.entities_added ?? 0,
    evidence: raw.evidence ?? raw.evidence_count ?? raw.evidence_added ?? 0,
    analyses: raw.analyses ?? raw.framework_count ?? raw.frameworks_created ?? 0,
  }
}

function formatTickDate(val: string): string {
  const d = new Date(val)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ── Component ────────────────────────────────────────────────────

export default function CopTimelinePanel({ sessionId, expanded }: CopTimelinePanelProps) {
  const [data, setData] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchTimeline() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/cop/${sessionId}/activity?limit=200`, {
          headers: getCopHeaders(),
        })

        if (!res.ok) {
          throw new Error(`Failed to fetch timeline (${res.status})`)
        }

        const json = await res.json()

        // Aggregate activity entries by date
        const activityList: Array<{ created_at: string; entity_type?: string; action?: string }> =
          json.activity ?? []

        const byDate: Record<string, { events: number; evidence: number; analyses: number }> = {}
        for (const entry of activityList) {
          const date = (entry.created_at ?? '').slice(0, 10)
          if (!date) continue
          if (!byDate[date]) byDate[date] = { events: 0, evidence: 0, analyses: 0 }
          const etype = (entry.entity_type ?? '').toLowerCase()
          if (etype === 'evidence' || entry.action === 'evidence_added') {
            byDate[date].evidence++
          } else if (etype === 'framework' || etype === 'hypothesis' || entry.action === 'framework_run') {
            byDate[date].analyses++
          } else {
            byDate[date].events++
          }
        }

        const rawArray: TimelineEntry[] = Object.entries(byDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, counts]) => ({ date, ...counts }))

        if (!cancelled) {
          setData(rawArray)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load timeline')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchTimeline()
    return () => { cancelled = true }
  }, [sessionId])

  // ── Summary totals ──────────────────────────────────────────────

  const totals = useMemo(() => {
    let events = 0
    let evidence = 0
    let analyses = 0

    for (const entry of data) {
      events += entry.events
      evidence += entry.evidence
      analyses += entry.analyses
    }

    return { events, evidence, analyses }
  }, [data])

  const dateRange = useMemo(() => {
    if (data.length === 0) return null
    const first = data[0].date
    const last = data[data.length - 1].date
    return { from: formatTickDate(first), to: formatTickDate(last) }
  }, [data])

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

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
        <Clock className="h-6 w-6 text-gray-600" />
        <p className="text-xs text-gray-500 font-medium">No timeline data yet</p>
        <p className="text-[10px] text-gray-600 text-center">
          Activity will appear here as you add events, evidence, and analyses.
        </p>
      </div>
    )
  }

  // ── Chart rendering ────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Summary badges row */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 flex-wrap">
        <Badge variant="outline" className="gap-1 text-[10px] text-purple-400 border-purple-500/30">
          <Users className="h-3 w-3" />
          {totals.events} events
        </Badge>
        <Badge variant="outline" className="gap-1 text-[10px] text-blue-400 border-blue-500/30">
          <FileText className="h-3 w-3" />
          {totals.evidence} evidence
        </Badge>
        <Badge variant="outline" className="gap-1 text-[10px] text-emerald-400 border-emerald-500/30">
          <Brain className="h-3 w-3" />
          {totals.analyses} analyses
        </Badge>

        {dateRange && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-gray-500">
            <Calendar className="h-3 w-3" />
            {dateRange.from} – {dateRange.to}
          </span>
        )}
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0 px-1 py-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="gradEvents" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradEvidence" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradAnalyses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatTickDate}
            />

            {expanded && (
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
            )}

            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(17, 24, 39, 0.95)',
                border: '1px solid #374151',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#e5e7eb',
              }}
              labelFormatter={formatTickDate}
            />

            <Area
              type="monotone"
              dataKey="events"
              name="Events"
              stackId="1"
              stroke="#8b5cf6"
              fill="url(#gradEvents)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="evidence"
              name="Evidence"
              stackId="1"
              stroke="#3b82f6"
              fill="url(#gradEvidence)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="analyses"
              name="Analyses"
              stackId="1"
              stroke="#10b981"
              fill="url(#gradAnalyses)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
