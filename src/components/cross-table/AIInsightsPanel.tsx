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
import { useCrossTable } from './CrossTableEditor'

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
  challenge?: string
  sensitivity_narrative?: string
  blind_spots?: string[]
  recommendations?: string[]
}

interface CriteriaSuggestion {
  label: string
  description: string
  rationale: string
}

interface ScoreSuggestion {
  row_id: string
  col_id: string
  suggested_score: number
  reasoning: string
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
        headers: getHeaders(),
      })
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      const data = await res.json()
      setInsights(data)
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
        headers: getHeaders(),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setCriteria(data.suggestions ?? [])
    } catch {
      // silent
    } finally {
      setCriteriaLoading(false)
    }
  }, [tableId])

  // ── Fetch score suggestions ─────────────────────────────────

  const fetchScoreSuggestions = useCallback(async () => {
    setScoreLoading(true)
    try {
      const res = await fetch(`/api/cross-table/${tableId}/ai/score-suggest`, {
        headers: getHeaders(),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setScoreSuggestions(data.suggestions ?? [])
    } catch {
      // silent
    } finally {
      setScoreLoading(false)
    }
  }, [tableId])

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={fetchInsights}
          disabled={insightsLoading || !hasScores}
          className="bg-[#4F5BFF] hover:bg-[#4F5BFF]/90"
        >
          {insightsLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {insights ? 'Refresh Analysis' : 'Generate Analysis'}
        </Button>
        <Button variant="outline" onClick={fetchCriteria} disabled={criteriaLoading}>
          {criteriaLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Lightbulb className="h-4 w-4 mr-2" />
          )}
          Suggest Criteria
        </Button>
        <Button variant="outline" onClick={fetchScoreSuggestions} disabled={scoreLoading || !hasScores}>
          {scoreLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Target className="h-4 w-4 mr-2" />
          )}
          Suggest Scores
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

          {/* Challenge mode */}
          {insights.challenge && (
            <InsightCard
              icon={AlertTriangle}
              title="Devil's Advocate"
              content={insights.challenge}
              variant="warning"
            />
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

          {/* Recommendations */}
          {insights.recommendations && insights.recommendations.length > 0 && (
            <Card className="border border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-[#4F5BFF]" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {insights.recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-[#4F5BFF] mt-0.5 shrink-0">{i + 1}.</span>
                      {rec}
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
                  <p className="text-[10px] text-muted-foreground mt-1 italic">{c.rationale}</p>
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
              {scoreSuggestions.slice(0, 10).map((s, i) => {
                const row = state.table.config.rows.find((r) => r.id === s.row_id)
                const col = state.table.config.columns.find((c) => c.id === s.col_id)
                return (
                  <div key={i} className="flex items-center gap-3 text-xs border-b border-slate-100 pb-2">
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {s.suggested_score}
                    </Badge>
                    <span className="font-medium truncate">{row?.label ?? s.row_id}</span>
                    <span className="text-muted-foreground">x</span>
                    <span className="font-medium truncate">{col?.label ?? s.col_id}</span>
                    <span className="text-muted-foreground ml-auto shrink-0 max-w-[200px] truncate">
                      {s.reasoning}
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
