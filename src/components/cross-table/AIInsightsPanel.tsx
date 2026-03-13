/**
 * AIInsightsPanel — AI-generated analysis, challenge mode, blind spots,
 * criteria suggestions, and ghost score suggestions.
 */

import { useState, useCallback } from 'react'
import {
  Sparkles,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Loader2,
  Eye,
  Target,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useCrossTable } from './cross-table-context'

// ── Auth header helper ──────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const userHash = localStorage.getItem('omnicore_user_hash')
  if (userHash) headers['X-User-Hash'] = userHash
  return headers
}

// ── Types ───────────────────────────────────────────────────────

interface AIInsights {
  summary?: string
  challenges?: string[]
  sensitivity_narrative?: string
  blind_spots?: string[]
}

interface CriteriaSuggestion {
  label: string
  description: string
}

interface ScoreSuggestion {
  row_id: string
  col_id: string
  score: number | string
  rationale: string
  confidence?: number
}

// ── Component ───────────────────────────────────────────────────

export function AIInsightsPanel() {
  const { state } = useCrossTable()
  const tableId = state.table.id
  const hasScores = state.scores.some((s) => s.score !== null)

  // ── Insights state ──────────────────────────────────────────
  const [insights, setInsights] = useState<AIInsights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState<string | null>(null)

  // ── Criteria suggestions state ──────────────────────────────
  const [criteria, setCriteria] = useState<CriteriaSuggestion[]>([])
  const [criteriaLoading, setCriteriaLoading] = useState(false)

  // ── Score suggestions state ─────────────────────────────────
  const [scoreSuggestions, setScoreSuggestions] = useState<ScoreSuggestion[]>([])
  const [scoreLoading, setScoreLoading] = useState(false)

  // ── Fetch insights ──────────────────────────────────────────

  const fetchInsights = useCallback(async () => {
    setInsightsLoading(true)
    setInsightsError(null)
    try {
      const res = await fetch(`/api/cross-table/${tableId}/ai/insights`, {
        method: 'POST',
        headers: getHeaders(),
      })
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      const data = await res.json()
      setInsights(data.insights ?? data)
    } catch (err: unknown) {
      setInsightsError(err instanceof Error ? err.message : 'Failed to load insights')
    } finally {
      setInsightsLoading(false)
    }
  }, [tableId])

  // ── Fetch criteria suggestions ──────────────────────────────

  const fetchCriteria = useCallback(async () => {
    setCriteriaLoading(true)
    try {
      const res = await fetch(`/api/cross-table/${tableId}/ai/suggest-criteria`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ topic: state.table.title }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setCriteria(data.criteria ?? [])
    } catch {
      // silent
    } finally {
      setCriteriaLoading(false)
    }
  }, [tableId, state.table.title])

  // ── Fetch score suggestions ─────────────────────────────────

  const fetchScoreSuggestions = useCallback(async () => {
    setScoreLoading(true)
    try {
      // Request scores for each row individually, collect all results
      const rows = state.table.config.rows
      const allSuggestions: ScoreSuggestion[] = []

      for (const row of rows) {
        const res = await fetch(`/api/cross-table/${tableId}/ai/score-suggest`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ row_id: row.id }),
        })
        if (!res.ok) continue
        const data = await res.json()
        const rowSuggestions = (data.suggestions ?? []).map((s: any) => ({
          ...s,
          row_id: data.row_id ?? row.id,
        }))
        allSuggestions.push(...rowSuggestions)
      }

      setScoreSuggestions(allSuggestions)
    } catch {
      // silent
    } finally {
      setScoreLoading(false)
    }
  }, [tableId, state.table.config.rows])

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={fetchInsights}
          disabled={insightsLoading || !hasScores}
          className="bg-[#4F5BFF] hover:bg-[#4F5BFF]/90 text-xs sm:text-sm"
        >
          {insightsLoading ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1.5" />
          )}
          {insights ? 'Refresh' : 'Analyze'}
        </Button>
        <Button variant="outline" size="sm" onClick={fetchCriteria} disabled={criteriaLoading} className="text-xs sm:text-sm">
          {criteriaLoading ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Lightbulb className="h-4 w-4 mr-1.5" />
          )}
          <span className="hidden sm:inline">Suggest </span>Criteria
        </Button>
        <Button variant="outline" size="sm" onClick={fetchScoreSuggestions} disabled={scoreLoading || !hasScores} className="text-xs sm:text-sm">
          {scoreLoading ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Target className="h-4 w-4 mr-1.5" />
          )}
          <span className="hidden sm:inline">Suggest </span>Scores
        </Button>
      </div>

      {!hasScores && (
        <p className="text-xs text-muted-foreground">
          Score at least one cell to enable AI analysis.
        </p>
      )}

      {/* Error state */}
      {insightsError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-center justify-between">
          <span>{insightsError}</span>
          <Button variant="ghost" size="sm" onClick={fetchInsights}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Loading skeleton */}
      {insightsLoading && !insights && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border border-slate-200">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/6" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Insights cards */}
      {insights && (
        <div className="space-y-4">
          {/* Summary */}
          {insights.summary && (
            <InsightCard
              icon={MessageSquare}
              title="Analysis Summary"
              content={insights.summary}
            />
          )}

          {/* Challenges / Devil's Advocate */}
          {insights.challenges && insights.challenges.length > 0 && (
            <Card className="border border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Devil's Advocate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {insights.challenges.map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5 shrink-0">&#x2022;</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Sensitivity narrative */}
          {insights.sensitivity_narrative && (
            <InsightCard
              icon={Eye}
              title="Sensitivity Insights"
              content={insights.sensitivity_narrative}
            />
          )}

          {/* Blind spots */}
          {insights.blind_spots && insights.blind_spots.length > 0 && (
            <Card className="border border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Blind Spots
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {insights.blind_spots.map((spot, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5 shrink-0">&#x2022;</span>
                      {spot}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Criteria suggestions */}
      {criteria.length > 0 && (
        <Card className="border border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-[#4F5BFF]" />
              Suggested Criteria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {criteria.map((c, i) => (
                <div key={i} className="border border-slate-100 rounded-lg p-3">
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score suggestions */}
      {scoreSuggestions.length > 0 && (
        <Card className="border border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-[#D4673A]" />
              Suggested Scores
              <Badge variant="outline" className="text-[10px] font-normal">
                {scoreSuggestions.length} suggestions
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {scoreSuggestions.slice(0, 20).map((s, i) => {
                const row = state.table.config.rows.find((r) => r.id === s.row_id)
                const col = state.table.config.columns.find((c) => c.id === s.col_id)
                return (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {String(s.score)}
                      </Badge>
                      <span className="font-medium truncate">{row?.label ?? s.row_id}</span>
                      <span className="text-muted-foreground shrink-0">x</span>
                      <span className="font-medium truncate">{col?.label ?? s.col_id}</span>
                    </div>
                    <span className="text-muted-foreground sm:ml-auto shrink-0 max-w-full sm:max-w-[200px] truncate pl-6 sm:pl-0">
                      {s.rationale}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Insight Card ────────────────────────────────────────────────

function InsightCard({
  icon: Icon,
  title,
  content,
  variant = 'default',
}: {
  icon: typeof Sparkles
  title: string
  content: string
  variant?: 'default' | 'warning'
}) {
  return (
    <Card className={cn(
      'border',
      variant === 'warning' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200'
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className={cn(
            'h-4 w-4',
            variant === 'warning' ? 'text-amber-500' : 'text-[#4F5BFF]'
          )} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground whitespace-pre-line">{content}</p>
      </CardContent>
    </Card>
  )
}
