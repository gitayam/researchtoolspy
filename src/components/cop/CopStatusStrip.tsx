import { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  Users,
  Network,
  Brain,
  HelpCircle,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CopWorkspaceStats } from '@/types/cop'

// ── Props ────────────────────────────────────────────────────────

interface CopStatusStripProps {
  sessionId: string
  className?: string
}

// ── Color helpers ────────────────────────────────────────────────

type StatusColor = 'green' | 'amber' | 'red'

const STATUS_COLOR_CLASSES: Record<StatusColor, string> = {
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  red:   'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

/** Standard threshold: 0 = red, 1-2 = amber, >2 = green */
function standardColor(count: number): StatusColor {
  if (count > 2) return 'green'
  if (count >= 1) return 'amber'
  return 'red'
}

/** Inverted threshold for open questions: 0 = green, 1-3 = amber, >3 = red */
function invertedColor(count: number): StatusColor {
  if (count === 0) return 'green'
  if (count <= 3) return 'amber'
  return 'red'
}

// ── KPI definitions ─────────────────────────────────────────────

interface KpiDef {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  getValue: (stats: CopWorkspaceStats) => number
  getColor: (count: number) => StatusColor
}

const KPI_DEFS: KpiDef[] = [
  {
    key: 'evidence',
    label: 'Evidence',
    icon: FileText,
    getValue: (s) => s.evidence_count,
    getColor: standardColor,
  },
  {
    key: 'entities',
    label: 'Entities',
    icon: Users,
    getValue: (s) => s.entity_count,
    getColor: standardColor,
  },
  {
    key: 'relationships',
    label: 'Relationships',
    icon: Network,
    getValue: (s) => s.relationship_count,
    getColor: standardColor,
  },
  {
    key: 'analyses',
    label: 'Analyses',
    icon: Brain,
    getValue: (s) => s.framework_count,
    getColor: standardColor,
  },
  {
    key: 'questions',
    label: 'Open Questions',
    icon: HelpCircle,
    getValue: (s) => s.open_questions,
    getColor: invertedColor,
  },
]

// ── Component ────────────────────────────────────────────────────

export default function CopStatusStrip({ sessionId, className }: CopStatusStripProps) {
  const [stats, setStats] = useState<CopWorkspaceStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')
      const headers: Record<string, string> = {}
      if (userHash) headers['X-User-Hash'] = userHash

      const res = await fetch(`/api/cop/${sessionId}/stats`, { headers })
      if (!res.ok) throw new Error('Failed to fetch stats')
      const data = await res.json()
      setStats(data.stats ?? data)
    } catch {
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // ── Loading state ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 px-4 py-2', className)}>
        <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
        <span className="text-xs text-gray-500">Loading workspace stats...</span>
      </div>
    )
  }

  // ── Failed fetch: render nothing ──────────────────────────────

  if (!stats) return null

  // ── KPI bar ───────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'flex items-center gap-4 overflow-x-auto px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50',
        className,
      )}
    >
      {KPI_DEFS.map((kpi) => {
        const value = kpi.getValue(stats)
        const color = kpi.getColor(value)
        const Icon = kpi.icon

        return (
          <div
            key={kpi.key}
            className="flex items-center gap-2 shrink-0"
          >
            <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
              {kpi.label}
            </span>
            <Badge
              variant="outline"
              className={cn(
                'text-[11px] px-2 py-0 leading-5 border-transparent font-semibold',
                STATUS_COLOR_CLASSES[color],
              )}
            >
              {value}
            </Badge>
          </div>
        )
      })}
    </div>
  )
}
