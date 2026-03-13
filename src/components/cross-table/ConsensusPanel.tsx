/**
 * ConsensusPanel — Delphi consensus view with IQR heatmap,
 * Kendall's W gauge, per-scorer completion, and round history.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Loader2, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useCrossTable } from './cross-table-context'
import type { DelphiConsensus, DelphiCellStats } from '@/lib/cross-table/types'

// ── Fetch helpers ──────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const userHash = localStorage.getItem('omnicore_user_hash')
  if (userHash) headers['X-User-Hash'] = userHash
  return headers
}

interface ScorerInfo {
  id: string
  user_id: number | null
  status: string
  completion_percent: number
}

// ── IQR color scale ────────────────────────────────────────────

function iqrColor(iqr: number, highDisagreement: boolean): string {
  if (highDisagreement) return 'bg-red-200 text-red-900'
  if (iqr > 0.2) return 'bg-amber-100 text-amber-900'
  if (iqr > 0.1) return 'bg-yellow-50 text-yellow-900'
  return 'bg-green-100 text-green-900'
}

function kendallLabel(w: number): { label: string; color: string } {
  if (w >= 0.7) return { label: 'Strong', color: 'text-green-700' }
  if (w >= 0.4) return { label: 'Moderate', color: 'text-amber-600' }
  if (w >= 0.2) return { label: 'Weak', color: 'text-orange-600' }
  return { label: 'Very Weak', color: 'text-red-600' }
}

// ── Component ──────────────────────────────────────────────────

export function ConsensusPanel() {
  const { state } = useCrossTable()
  const { table } = state
  const { rows, columns } = table.config
  const currentRound = table.config.delphi?.current_round ?? 1

  const [selectedRound, setSelectedRound] = useState(currentRound)
  const [consensus, setConsensus] = useState<DelphiConsensus | null>(null)
  const [scorers, setScorers] = useState<ScorerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch consensus data
  const fetchConsensus = useCallback(async (round: number, signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const [consensusRes, scorersRes] = await Promise.all([
        fetch(`/api/cross-table/${table.id}/consensus?round=${round}`, {
          headers: getHeaders(),
          signal,
        }),
        fetch(`/api/cross-table/${table.id}/scorers`, {
          headers: getHeaders(),
          signal,
        }),
      ])

      if (!consensusRes.ok) throw new Error('Failed to load consensus data')
      if (!scorersRes.ok) throw new Error('Failed to load scorers')

      const consensusData = await consensusRes.json()
      const scorersData = await scorersRes.json()

      setConsensus(consensusData.consensus)
      setScorers(scorersData.scorers ?? [])
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [table.id])

  useEffect(() => {
    const controller = new AbortController()
    fetchConsensus(selectedRound, controller.signal)
    return () => controller.abort()
  }, [fetchConsensus, selectedRound])

  // Build cell stats lookup
  const cellStatsMap = useMemo(() => {
    const map = new Map<string, DelphiCellStats>()
    if (!consensus) return map
    for (const cell of consensus.cell_stats) {
      map.set(`${cell.row_id}:${cell.col_id}`, cell)
    }
    return map
  }, [consensus])

  // ── Loading ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!consensus) return null

  const kw = kendallLabel(consensus.kendall_w)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Round selector + Kendall's W */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Round navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedRound((r) => Math.max(1, r - 1))}
            disabled={selectedRound <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium tabular-nums">
            Round {selectedRound} of {currentRound}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedRound((r) => Math.min(currentRound, r + 1))}
            disabled={selectedRound >= currentRound}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Kendall's W gauge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Kendall&apos;s W</div>
            <div className={cn('text-lg font-bold tabular-nums', kw.color)}>
              {consensus.kendall_w.toFixed(3)}
            </div>
          </div>
          <div className="w-24">
            <Progress
              value={consensus.kendall_w * 100}
              className="h-2.5"
              indicatorClassName={cn(
                consensus.kendall_w >= 0.7 ? 'bg-green-500' :
                consensus.kendall_w >= 0.4 ? 'bg-amber-500' :
                'bg-red-500'
              )}
            />
            <div className="text-[10px] text-muted-foreground text-center mt-0.5">
              {kw.label} agreement
            </div>
          </div>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="text-xs">
          {consensus.cell_stats.filter((c) => c.count > 0).length} cells scored
        </Badge>
        {consensus.high_disagreement_count > 0 ? (
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {consensus.high_disagreement_count} high disagreement
          </Badge>
        ) : (
          <Badge className="text-xs bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            No high disagreement
          </Badge>
        )}
        <Badge variant="outline" className="text-xs">
          {scorers.filter((s) => s.status === 'accepted' || s.status === 'submitted').length} active scorers
        </Badge>
      </div>

      {/* IQR Heatmap Grid */}
      <div className="overflow-x-auto">
        <TooltipProvider>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2 font-medium text-muted-foreground sticky left-0 bg-white z-10">
                  Alternative
                </th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="p-2 font-medium text-muted-foreground text-center min-w-[80px]"
                  >
                    <span className="truncate block max-w-[100px]">{col.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="p-2 font-medium sticky left-0 bg-white z-10">
                    <span className="truncate block max-w-[140px]">{row.label}</span>
                  </td>
                  {columns.map((col) => {
                    const cell = cellStatsMap.get(`${row.id}:${col.id}`)
                    if (!cell || cell.count === 0) {
                      return (
                        <td key={col.id} className="p-1 text-center">
                          <div className="rounded bg-slate-50 px-2 py-1.5 text-muted-foreground">
                            --
                          </div>
                        </td>
                      )
                    }
                    return (
                      <td key={col.id} className="p-1 text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'rounded px-2 py-1.5 font-mono tabular-nums cursor-default',
                                iqrColor(cell.iqr, cell.high_disagreement)
                              )}
                            >
                              {cell.median.toFixed(2)}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-0.5">
                              <div>Median: {cell.median.toFixed(3)}</div>
                              <div>IQR: {cell.iqr.toFixed(3)}</div>
                              <div>Range: {cell.min.toFixed(2)} - {cell.max.toFixed(2)}</div>
                              <div>Responses: {cell.count}</div>
                              {cell.high_disagreement && (
                                <div className="text-red-600 font-medium">High disagreement</div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TooltipProvider>
      </div>

      {/* Per-scorer completion */}
      {scorers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Scorer Progress</h3>
          <div className="space-y-2">
            {scorers.map((scorer) => (
              <div key={scorer.id} className="flex items-center gap-3">
                <div className="w-24 shrink-0">
                  <Badge
                    variant={scorer.status === 'submitted' ? 'default' : 'outline'}
                    className="text-[10px] w-full justify-center"
                  >
                    {scorer.status}
                  </Badge>
                </div>
                <div className="flex-1">
                  <Progress
                    value={scorer.completion_percent}
                    className="h-2"
                    indicatorClassName={
                      scorer.completion_percent === 100
                        ? 'bg-green-500'
                        : 'bg-[#4F5BFF]'
                    }
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                  {scorer.completion_percent}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
