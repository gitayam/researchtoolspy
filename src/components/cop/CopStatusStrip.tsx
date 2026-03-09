import { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  Users,
  Network,
  Brain,
  HelpCircle,
  Loader2,
  Flag,
  Edit2,
  Check,
  AlertTriangle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CopWorkspaceStats } from '@/types/cop'

// ── Props ────────────────────────────────────────────────────────

interface CopStatusStripProps {
  sessionId: string
  className?: string
  missionBrief?: string
  onUpdateMissionBrief?: (brief: string) => void
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

/** Blocker color: 0 = green (no blockers), any > 0 = red */
function blockerColor(count: number): StatusColor {
  if (count === 0) return 'green'
  return 'red'
}

// ── KPI definitions ─────────────────────────────────────────────

interface KpiDef {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  getValue: (stats: CopWorkspaceStats & { blocker_count?: number }) => number
  getColor: (count: number) => StatusColor
  /** Only show this KPI when its value is non-zero */
  hideWhenZero?: boolean
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
    key: 'hypotheses',
    label: 'Hypotheses',
    icon: Brain,
    getValue: (s) => s.hypothesis_count ?? 0,
    getColor: standardColor,
    hideWhenZero: true,
  },
  {
    key: 'analyses',
    label: 'Analyses',
    icon: Flag,
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
  {
    key: 'blockers',
    label: 'Blockers',
    icon: AlertTriangle,
    getValue: (s) => (s as any).blocker_count ?? 0,
    getColor: blockerColor,
    hideWhenZero: true,
  },
]

// ── Component ────────────────────────────────────────────────────

export default function CopStatusStrip({ sessionId, className, missionBrief: initialBrief, onUpdateMissionBrief }: CopStatusStripProps) {
  const [stats, setStats] = useState<CopWorkspaceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [brief, setBrief] = useState(initialBrief || '')

  useEffect(() => {
    setBrief(initialBrief || '')
  }, [initialBrief])

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
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const handleSaveBrief = () => {
    onUpdateMissionBrief?.(brief)
    setIsEditing(false)
  }

  // ── Loading state ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50', className)}>
        <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
        <span className="text-xs text-gray-500">Loading workspace stats...</span>
      </div>
    )
  }

  // ── KPI bar ───────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'flex flex-col md:flex-row md:items-center gap-3 md:gap-6 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50',
        className,
      )}
    >
      {/* Mission Brief Section */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <Flag className="h-4 w-4 text-emerald-500" />
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Mission Brief:</span>
        </div>
        {isEditing ? (
          <div className="flex-1 flex items-center gap-1">
            <input
              type="text"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveBrief()}
              className="flex-1 bg-white dark:bg-gray-800 border border-emerald-500/50 rounded px-2 py-0.5 text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              autoFocus
              placeholder="e.g. Geoguess the bus and identify persona @lanaraae"
            />
            <button onClick={handleSaveBrief} className="p-1 hover:bg-emerald-500/20 rounded text-emerald-500 cursor-pointer">
              <Check className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            className={cn(
              "group flex-1 flex items-center gap-2 cursor-pointer rounded px-2 py-0.5 transition-colors",
              brief
                ? "hover:bg-gray-100 dark:hover:bg-gray-800"
                : "bg-amber-50 dark:bg-amber-900/20 border border-dashed border-amber-300 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/30"
            )}
            onClick={() => setIsEditing(true)}
          >
            <span className={cn(
              "text-xs truncate flex-1",
              brief ? "text-gray-700 dark:text-gray-200" : "text-amber-600 dark:text-amber-400"
            )}>
              {brief || 'Set mission objective so newcomers know what to work on...'}
            </span>
            <Edit2 className="h-3 w-3 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        )}
      </div>

      {/* KPI Stats */}
      <div className="flex items-center gap-4 overflow-x-auto shrink-0 pb-1 md:pb-0">
        {KPI_DEFS.map((kpi) => {
          const value = stats ? kpi.getValue(stats) : 0

          // Skip KPIs that should be hidden when zero
          if (kpi.hideWhenZero && value === 0) return null

          const color = kpi.getColor(value)
          const Icon = kpi.icon

          return (
            <div
              key={kpi.key}
              className="flex items-center gap-1.5 shrink-0"
              title={`${kpi.label}: ${value}`}
            >
              <Icon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
              <span className="hidden lg:inline text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                {kpi.label}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[11px] px-1.5 py-0 leading-5 border-transparent font-semibold tabular-nums',
                  STATUS_COLOR_CLASSES[color],
                )}
              >
                {value}
              </Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}
