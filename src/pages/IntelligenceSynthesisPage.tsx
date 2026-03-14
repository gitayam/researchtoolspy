/**
 * Intelligence Synthesis Dashboard
 * Cross-framework analysis and predictive intelligence
 *
 * 7 Sections (all load independently in parallel):
 * 1. Hero + KPI Strip
 * 2. Cross-Framework Synthesis
 * 3. Entity Convergence Table
 * 4. Analysis Timeline
 * 5. Network Intelligence
 * 6. Contradictions
 * 7. Predictive Indicators
 */

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Brain,
  Target,
  FileText,
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Network,
  Eye,
  Lightbulb,
  ChevronUp,
  ChevronDown,
  Users,
  Layers,
  Crosshair,
  ArrowUpDown,
  Sparkles,
  CircleDot,
} from 'lucide-react'
import type {
  IntelligenceKpi,
  SynthesisResponse,
  SynthesisFinding,
  ConvergencePoint,
  EntityConvergenceResponse,
  EntityConvergenceRow,
  TimelineResponse,
  NetworkIntelligenceResponse,
  ContradictionsResponse,
  Contradiction,
  PredictionsResponse,
  WatchItem,
  CollectionGap,
} from '@/types/intelligence-synthesis'
import { getCopHeaders } from '@/lib/cop-auth'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchSection<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: getCopHeaders() })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }
  return response.json()
}

// ─── Skeleton Component ───────────────────────────────────────────────────────

function SectionSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
          style={{ width: `${75 - i * 12}%` }}
        />
      ))}
    </div>
  )
}

function SectionError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-red-500 dark:text-red-400 text-sm py-2">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
      <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ─── Risk / Severity Color Helpers ────────────────────────────────────────────

function riskBadgeColor(level: string | null | undefined): string {
  switch (level) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
    case 'MEDIUM':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    case 'LOW':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

function severityBadgeColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
    case 'WARNING':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
    case 'INFO':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
  }
}

function severityCardBorder(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return 'border-l-4 border-l-red-500'
    case 'WARNING':
      return 'border-l-4 border-l-amber-500'
    case 'INFO':
      return 'border-l-4 border-l-blue-500'
    default:
      return 'border-l-4 border-l-gray-300'
  }
}

function strengthBadge(strength: string): string {
  switch (strength) {
    case 'strong':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'moderate':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    case 'weak':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
  }
}

function priorityBadgeColor(priority: string): string {
  switch (priority) {
    case 'HIGH':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'MEDIUM':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    case 'LOW':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

function trajectoryConfig(trajectory: string) {
  switch (trajectory) {
    case 'ESCALATING':
      return {
        color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        icon: TrendingUp,
        label: 'Escalating',
      }
    case 'DE_ESCALATING':
      return {
        color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        icon: TrendingDown,
        label: 'De-escalating',
      }
    case 'STABLE':
    default:
      return {
        color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
        icon: Minus,
        label: 'Stable',
      }
  }
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

function MiniSparkline({ data, color = '#3b82f6' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <div className="h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill="url(#sparkGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Confidence Gauge ─────────────────────────────────────────────────────────

function ConfidenceGauge({ value }: { value: number }) {
  // value is 0-100 (from LLM)
  const pct = Math.round(value)
  const color =
    pct >= 70 ? 'text-green-600 dark:text-green-400' :
    pct >= 40 ? 'text-amber-600 dark:text-amber-400' :
    'text-red-600 dark:text-red-400'
  const bgColor =
    pct >= 70 ? 'bg-green-500' :
    pct >= 40 ? 'bg-amber-500' :
    'bg-red-500'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18" cy="18" r="15.5"
            fill="none"
            className="stroke-gray-200 dark:stroke-gray-700"
            strokeWidth="3"
          />
          <circle
            cx="18" cy="18" r="15.5"
            fill="none"
            className={bgColor.replace('bg-', 'stroke-')}
            strokeWidth="3"
            strokeDasharray={`${pct} ${100 - pct}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${color}`}>{pct}%</span>
        </div>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">Overall Confidence</span>
    </div>
  )
}

// Chart colors
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function IntelligenceSynthesisPage() {
  // ─── Section 1: KPI ────────────────────────────────────────────────────────
  const [kpiData, setKpiData] = useState<IntelligenceKpi | null>(null)
  const [kpiLoading, setKpiLoading] = useState(true)
  const [kpiError, setKpiError] = useState<string | null>(null)

  // ─── Section 2: Synthesis ──────────────────────────────────────────────────
  const [synthesisData, setSynthesisData] = useState<SynthesisResponse | null>(null)
  const [synthesisLoading, setSynthesisLoading] = useState(true)
  const [synthesisError, setSynthesisError] = useState<string | null>(null)

  // ─── Section 3: Entity Convergence ─────────────────────────────────────────
  const [entityData, setEntityData] = useState<EntityConvergenceResponse | null>(null)
  const [entityLoading, setEntityLoading] = useState(true)
  const [entityError, setEntityError] = useState<string | null>(null)
  const [entitySort, setEntitySort] = useState<{ field: keyof EntityConvergenceRow; dir: 'asc' | 'desc' }>({
    field: 'convergence_score',
    dir: 'desc',
  })

  // ─── Section 4: Timeline ───────────────────────────────────────────────────
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [timelineError, setTimelineError] = useState<string | null>(null)

  // ─── Section 5: Network ────────────────────────────────────────────────────
  const [networkData, setNetworkData] = useState<NetworkIntelligenceResponse | null>(null)
  const [networkLoading, setNetworkLoading] = useState(true)
  const [networkError, setNetworkError] = useState<string | null>(null)

  // ─── Section 6: Contradictions ─────────────────────────────────────────────
  const [contradictionsData, setContradictionsData] = useState<ContradictionsResponse | null>(null)
  const [contradictionsLoading, setContradictionsLoading] = useState(true)
  const [contradictionsError, setContradictionsError] = useState<string | null>(null)

  // ─── Section 7: Predictions ────────────────────────────────────────────────
  const [predictionsData, setPredictionsData] = useState<PredictionsResponse | null>(null)
  const [predictionsLoading, setPredictionsLoading] = useState(true)
  const [predictionsError, setPredictionsError] = useState<string | null>(null)

  // ─── Parallel fetches (all independent) ────────────────────────────────────

  useEffect(() => {
    fetchSection<IntelligenceKpi>('/api/intelligence/kpi')
      .then(setKpiData)
      .catch(err => setKpiError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setKpiLoading(false))
  }, [])

  useEffect(() => {
    fetchSection<SynthesisResponse>('/api/intelligence/synthesis')
      .then(setSynthesisData)
      .catch(err => setSynthesisError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setSynthesisLoading(false))
  }, [])

  useEffect(() => {
    fetchSection<EntityConvergenceResponse>('/api/intelligence/entities')
      .then(setEntityData)
      .catch(err => setEntityError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setEntityLoading(false))
  }, [])

  useEffect(() => {
    fetchSection<TimelineResponse>('/api/intelligence/timeline')
      .then(setTimelineData)
      .catch(err => setTimelineError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setTimelineLoading(false))
  }, [])

  useEffect(() => {
    fetchSection<NetworkIntelligenceResponse>('/api/intelligence/network')
      .then(setNetworkData)
      .catch(err => setNetworkError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setNetworkLoading(false))
  }, [])

  useEffect(() => {
    fetchSection<ContradictionsResponse>('/api/intelligence/contradictions')
      .then(setContradictionsData)
      .catch(err => setContradictionsError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setContradictionsLoading(false))
  }, [])

  useEffect(() => {
    fetchSection<PredictionsResponse>('/api/intelligence/predictions')
      .then(setPredictionsData)
      .catch(err => setPredictionsError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setPredictionsLoading(false))
  }, [])

  // ─── Entity Sort Logic ─────────────────────────────────────────────────────

  const sortedEntities = useMemo(() => {
    if (!entityData?.entities) return []
    const sorted = [...entityData.entities]
    sorted.sort((a, b) => {
      const aVal = a[entitySort.field]
      const bVal = b[entitySort.field]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return entitySort.dir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      const numA = Number(aVal)
      const numB = Number(bVal)
      return entitySort.dir === 'asc' ? numA - numB : numB - numA
    })
    return sorted
  }, [entityData, entitySort])

  function toggleEntitySort(field: keyof EntityConvergenceRow) {
    setEntitySort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'desc' }
    )
  }

  function SortIcon({ field }: { field: keyof EntityConvergenceRow }) {
    if (entitySort.field !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-40" />
    }
    return entitySort.dir === 'asc' ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ─── Section 1: Hero + KPI Strip ────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700 dark:from-indigo-900 dark:via-blue-900 dark:to-purple-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Lightbulb className="h-8 w-8 text-white/90" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Intelligence Synthesis
            </h1>
          </div>
          <p className="text-blue-100 text-sm sm:text-base mb-6">
            Cross-framework analysis and predictive intelligence
          </p>

          {/* KPI Strip */}
          {kpiLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 animate-pulse">
                  <div className="h-3 bg-white/20 rounded w-2/3 mb-2" />
                  <div className="h-6 bg-white/20 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : kpiError ? (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4 text-red-100 text-sm">
              <AlertTriangle className="h-4 w-4 inline mr-2" />
              {kpiError}
            </div>
          ) : kpiData ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Active Frameworks */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/15 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="h-4 w-4 text-blue-200" />
                  <span className="text-xs text-blue-200 font-medium">Active Frameworks</span>
                </div>
                <p className="text-2xl font-bold text-white">{kpiData.active_frameworks}</p>
              </div>

              {/* Entities Tracked */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/15 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-green-200" />
                  <span className="text-xs text-blue-200 font-medium">Entities Tracked</span>
                </div>
                <p className="text-2xl font-bold text-white">{kpiData.entities_tracked}</p>
              </div>

              {/* Evidence Items */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/15 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-amber-200" />
                  <span className="text-xs text-blue-200 font-medium">Evidence Items</span>
                </div>
                <p className="text-2xl font-bold text-white">{kpiData.evidence_count}</p>
              </div>

              {/* Avg Confidence */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/15 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-purple-200" />
                  <span className="text-xs text-blue-200 font-medium">Avg Confidence</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-white">
                    {kpiData.avg_confidence}%
                  </p>
                  <MiniSparkline data={kpiData.confidence_sparkline} color="#a78bfa" />
                </div>
              </div>

              {/* Deception Risk */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/15 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-red-200" />
                  <span className="text-xs text-blue-200 font-medium">Deception Risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-white">
                    {kpiData.deception_risk_score}/5
                  </p>
                  <Badge className={`text-xs ${riskBadgeColor(kpiData.deception_risk_level)}`}>
                    {kpiData.deception_risk_level}
                  </Badge>
                </div>
              </div>

              {/* Coverage Gaps */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/15 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="h-4 w-4 text-cyan-200" />
                  <span className="text-xs text-blue-200 font-medium">Coverage Gaps</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {kpiData.coverage_gap_pct}%
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ─── Main Content ───────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ─── Section 2: Cross-Framework Synthesis ─────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              Cross-Framework Synthesis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {synthesisLoading ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
                  Generating synthesis...
                </p>
                <SectionSkeleton lines={5} />
              </div>
            ) : synthesisError ? (
              <SectionError message={synthesisError} />
            ) : !synthesisData || synthesisData.key_findings.length === 0 ? (
              <EmptyState message="No synthesis data available yet. Run analyses across multiple frameworks to generate cross-framework insights." />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Key Findings */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Key Findings
                  </h3>
                  <div className="space-y-3">
                    {synthesisData.key_findings.map((finding: SynthesisFinding, idx: number) => (
                      <div
                        key={idx}
                        className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2"
                      >
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                          {finding.finding}
                        </p>
                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Confidence bar */}
                          <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                            <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                              Confidence
                            </span>
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-indigo-500 h-2 rounded-full transition-all"
                                style={{ width: `${Math.round(finding.confidence)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 shrink-0">
                              {Math.round(finding.confidence)}%
                            </span>
                          </div>
                          {/* Framework badges */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {finding.supporting_frameworks.map((fw: string) => (
                              <Badge
                                key={fw}
                                variant="secondary"
                                className="text-xs"
                              >
                                {fw}
                              </Badge>
                            ))}
                          </div>
                          <span className="text-xs text-gray-400">
                            {finding.evidence_count} evidence
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Convergence Points */}
                  {synthesisData.convergence_points.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        Convergence Points
                      </h3>
                      {synthesisData.convergence_points.map((cp: ConvergencePoint, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
                        >
                          <Crosshair className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-gray-800 dark:text-gray-200">
                              {cp.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge className={`text-xs ${strengthBadge(cp.strength)}`}>
                                {cp.strength}
                              </Badge>
                              {cp.frameworks.map((fw, fwIdx) => (
                                <span key={fwIdx} className="text-xs text-gray-400">
                                  {fw.type}: {fw.element}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confidence Gauge */}
                <div className="flex flex-col items-center justify-start gap-4">
                  <ConfidenceGauge value={synthesisData.overall_confidence} />

                  {/* Confidence Breakdown */}
                  {synthesisData.confidence_breakdown.length > 0 && (
                    <div className="w-full space-y-2">
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">
                        By Framework
                      </h4>
                      {synthesisData.confidence_breakdown.map((item) => (
                        <div key={item.framework_type} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 dark:text-gray-400 w-20 truncate text-right">
                            {item.framework_type}
                          </span>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className="bg-indigo-500 h-1.5 rounded-full"
                              style={{ width: `${Math.round(item.confidence)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-8">
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Section 3: Entity Convergence Table ──────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5 text-emerald-500" />
              Entity Convergence
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entityLoading ? (
              <SectionSkeleton lines={6} />
            ) : entityError ? (
              <SectionError message={entityError} />
            ) : !entityData || entityData.entities.length === 0 ? (
              <EmptyState message="No entity convergence data available. Entities will appear here once they are referenced across multiple frameworks." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      {([
                        { field: 'entity_name' as const, label: 'Name' },
                        { field: 'entity_type' as const, label: 'Type' },
                        { field: 'frameworks_count' as const, label: 'Frameworks' },
                        { field: 'convergence_score' as const, label: 'Convergence' },
                        { field: 'relationship_count' as const, label: 'Relationships' },
                        { field: 'risk_level' as const, label: 'Risk Level' },
                      ]).map(({ field, label }) => (
                        <th
                          key={field}
                          className="py-2 px-3 text-left font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none"
                          onClick={() => toggleEntitySort(field)}
                        >
                          <div className="flex items-center gap-1">
                            {label}
                            <SortIcon field={field} />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {sortedEntities.map((entity: EntityConvergenceRow) => (
                      <tr
                        key={entity.entity_id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100">
                          {entity.entity_name}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-xs">
                            {entity.entity_type}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">
                          {entity.frameworks_count}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 max-w-[80px] bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full"
                                style={{ width: `${Math.round(entity.convergence_score * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {Math.round(entity.convergence_score * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">
                          {entity.relationship_count}
                        </td>
                        <td className="py-2.5 px-3">
                          {entity.risk_level ? (
                            <Badge className={`text-xs ${riskBadgeColor(entity.risk_level)}`}>
                              {entity.risk_level}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">--</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Section 4: Analysis Timeline ─────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-blue-500" />
              Analysis Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timelineLoading ? (
              <SectionSkeleton lines={4} />
            ) : timelineError ? (
              <SectionError message={timelineError} />
            ) : !timelineData || timelineData.activity.length === 0 ? (
              <EmptyState message="No timeline data available. Activity will be tracked as you create and update analyses." />
            ) : (
              <div className="space-y-6">
                {/* Daily Activity Chart */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Daily Activity
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timelineData.activity}>
                        <defs>
                          <linearGradient id="gradFrameworks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradEvidence" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradEntities" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(val: string) => {
                            const d = new Date(val)
                            return `${d.getMonth() + 1}/${d.getDate()}`
                          }}
                          className="text-gray-500"
                        />
                        <YAxis tick={{ fontSize: 11 }} className="text-gray-500" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(255,255,255,0.95)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Area
                          type="monotone"
                          dataKey="frameworks_created"
                          name="Frameworks"
                          stackId="1"
                          stroke="#3b82f6"
                          fill="url(#gradFrameworks)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="evidence_added"
                          name="Evidence"
                          stackId="1"
                          stroke="#10b981"
                          fill="url(#gradEvidence)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="entities_added"
                          name="Entities"
                          stackId="1"
                          stroke="#f59e0b"
                          fill="url(#gradEntities)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Cumulative Evidence Chart */}
                {timelineData.evidence_accumulation.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Cumulative Evidence
                    </h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timelineData.evidence_accumulation}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(val: string) => {
                              const d = new Date(val)
                              return `${d.getMonth() + 1}/${d.getDate()}`
                            }}
                            className="text-gray-500"
                          />
                          <YAxis tick={{ fontSize: 11 }} className="text-gray-500" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(255,255,255,0.95)',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="cumulative"
                            name="Total Evidence"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Milestones */}
                {timelineData.milestones.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Milestones
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {timelineData.milestones.map((ms, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2"
                        >
                          <CircleDot className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-indigo-800 dark:text-indigo-200">
                              {ms.description}
                            </p>
                            <p className="text-xs text-indigo-500 dark:text-indigo-400">
                              {new Date(ms.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Section 5: Network Intelligence ──────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Network className="h-5 w-5 text-violet-500" />
              Network Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            {networkLoading ? (
              <SectionSkeleton lines={4} />
            ) : networkError ? (
              <SectionError message={networkError} />
            ) : !networkData ? (
              <EmptyState message="No network intelligence data available. Build entity relationships to see network analysis." />
            ) : (
              <div className="space-y-6">
                {/* Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Nodes</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {networkData.metrics.total_nodes}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Edges</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {networkData.metrics.total_edges}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Communities</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {networkData.metrics.community_count}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Network Density</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {networkData.metrics.network_density.toFixed(3)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Key Influencers */}
                  {networkData.key_influencers.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                        Key Influencers
                      </h3>
                      <div className="space-y-2">
                        {networkData.key_influencers.slice(0, 5).map((inf, idx) => (
                          <div
                            key={inf.entity_id}
                            className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
                          >
                            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-bold shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {inf.entity_name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {inf.role}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                                {inf.composite_score.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-400">score</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bridge Nodes */}
                  {networkData.bridge_nodes.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                        Bridge Nodes
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Entities that connect otherwise separate communities
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {networkData.bridge_nodes.map((nodeId) => {
                          const nodeName = networkData.nodes.find(n => n.id === nodeId)?.name || nodeId
                          return (
                            <Badge
                              key={nodeId}
                              variant="outline"
                              className="bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300"
                            >
                              {nodeName}
                            </Badge>
                          )
                        })}
                      </div>

                      {/* Community Summary */}
                      {networkData.communities.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Communities
                          </h4>
                          <div className="space-y-1.5">
                            {networkData.communities.map((comm) => (
                              <div
                                key={comm.id}
                                className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5"
                              >
                                <span className="text-gray-600 dark:text-gray-400">
                                  Community {comm.id}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {comm.dominant_type}
                                  </Badge>
                                  <span className="text-gray-500 dark:text-gray-400">
                                    {comm.size} members
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Section 6: Contradictions ─────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Contradictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contradictionsLoading ? (
              <SectionSkeleton lines={4} />
            ) : contradictionsError ? (
              <SectionError message={contradictionsError} />
            ) : !contradictionsData || contradictionsData.contradictions.length === 0 ? (
              <EmptyState message="No contradictions detected. Contradictions will appear when frameworks produce conflicting assessments." />
            ) : (
              <div className="space-y-4">
                {/* Summary Bar */}
                <div className="flex items-center gap-3 flex-wrap bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {contradictionsData.total_count} contradiction{contradictionsData.total_count !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    {contradictionsData.by_severity.CRITICAL > 0 && (
                      <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                        {contradictionsData.by_severity.CRITICAL} critical
                      </Badge>
                    )}
                    {contradictionsData.by_severity.WARNING > 0 && (
                      <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        {contradictionsData.by_severity.WARNING} warning
                      </Badge>
                    )}
                    {contradictionsData.by_severity.INFO > 0 && (
                      <Badge className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {contradictionsData.by_severity.INFO} info
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Contradiction Cards */}
                <div className="space-y-3">
                  {contradictionsData.contradictions.map((c: Contradiction, idx: number) => (
                    <div
                      key={idx}
                      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${severityCardBorder(c.severity)}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {c.description}
                        </p>
                        <Badge className={`text-xs shrink-0 ${severityBadgeColor(c.severity)}`}>
                          {c.severity}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        {/* Side A */}
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                          <div className="flex items-center gap-1 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {c.side_a.framework_type}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-700 dark:text-gray-300">
                            {c.side_a.claim}
                          </p>
                        </div>

                        {/* Side B */}
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                          <div className="flex items-center gap-1 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {c.side_b.framework_type}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-700 dark:text-gray-300">
                            {c.side_b.claim}
                          </p>
                        </div>
                      </div>

                      {c.suggested_resolution && (
                        <div className="flex items-start gap-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">
                          <Lightbulb className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-indigo-800 dark:text-indigo-200">
                            <span className="font-medium">Suggested resolution: </span>
                            {c.suggested_resolution}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Section 7: Predictive Indicators ─────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-rose-500" />
              Predictive Indicators
            </CardTitle>
          </CardHeader>
          <CardContent>
            {predictionsLoading ? (
              <SectionSkeleton lines={5} />
            ) : predictionsError ? (
              <SectionError message={predictionsError} />
            ) : !predictionsData ? (
              <EmptyState message="No prediction data available. Predictive indicators will appear once sufficient analysis data is collected." />
            ) : (
              <div className="space-y-6">
                {/* Risk Trajectory */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Risk Trajectory
                    </span>
                    {(() => {
                      const config = trajectoryConfig(predictionsData.risk_trajectory)
                      const Icon = config.icon
                      return (
                        <Badge className={`text-xs ${config.color}`}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      )
                    })()}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {predictionsData.risk_trajectory_reasoning}
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Watch List */}
                  {predictionsData.watch_list.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                        Watch List
                      </h3>
                      <div className="space-y-2">
                        {predictionsData.watch_list.map((item: WatchItem, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
                          >
                            <Eye className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {item.entity_or_topic}
                                </span>
                                <Badge className={`text-xs ${priorityBadgeColor(item.priority)}`}>
                                  {item.priority}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {item.reason}
                              </p>
                              {item.related_frameworks.length > 0 && (
                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                  {item.related_frameworks.map((fw) => (
                                    <Badge key={fw} variant="outline" className="text-xs">
                                      {fw}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Collection Gaps */}
                  {predictionsData.collection_gaps.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                        Collection Gaps
                      </h3>
                      <div className="space-y-2">
                        {predictionsData.collection_gaps.map((gap: CollectionGap, idx: number) => (
                          <div
                            key={idx}
                            className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Target className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
                                {gap.area}
                              </span>
                              <Badge variant="outline" className="text-xs ml-auto">
                                {gap.current_evidence_count} evidence
                              </Badge>
                            </div>
                            <p className="text-xs text-amber-800 dark:text-amber-300 mb-1">
                              {gap.recommended_action}
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                              Impact: {gap.impact_if_filled}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Emerging Patterns */}
                {predictionsData.emerging_patterns.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                      Emerging Patterns
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {predictionsData.emerging_patterns.map((pattern, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
                        >
                          <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-gray-800 dark:text-gray-200">
                              {pattern.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 max-w-[100px] bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                <div
                                  className="bg-purple-500 h-1.5 rounded-full"
                                  style={{ width: `${Math.round(pattern.confidence * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {Math.round(pattern.confidence * 100)}% confidence
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
