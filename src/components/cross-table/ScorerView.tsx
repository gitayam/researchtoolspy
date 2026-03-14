/**
 * ScorerView — Stripped-down view for invited Delphi participants.
 *
 * Renders at /dashboard/tools/cross-table/:id/score
 * Shows only the Matrix tab + submit button.
 * No weights, no results, no AI, no sensitivity.
 * Accepts invite token from URL query params.
 */

import { useState, useEffect, useCallback, useReducer } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2, Send, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MatrixGrid } from './MatrixGrid'
import type { CrossTable, Score } from '@/lib/cross-table/types'
import { getCopHeaders } from '@/lib/cop-auth'
import {
  CrossTableContext,
  editorReducer,
} from './cross-table-context'

// ── Main Component ─────────────────────────────────────────────

export function ScorerView() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')

  const [table, setTable] = useState<CrossTable | null>(null)
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Accept invite if token present
  useEffect(() => {
    if (!inviteToken || !id) return
    const accept = async () => {
      try {
        await fetch(`/api/cross-table/${id}/scorers/accept`, {
          method: 'POST',
          headers: getCopHeaders(),
          body: JSON.stringify({ invite_token: inviteToken }),
        })
      } catch {
        // Ignore — may already be accepted
      }
    }
    accept()
  }, [id, inviteToken])

  // Fetch table and scores
  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cross-table/${id}`, {
        headers: getCopHeaders(),
        signal,
      })
      if (res.status === 404) {
        setError('Cross table not found')
        return
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      setTable(data.table)
      setScores(data.scores ?? [])
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    fetchData(controller.signal)
    return () => controller.abort()
  }, [fetchData])

  const handleSubmit = async (scoresToSubmit: Score[]) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/cross-table/${id}/scores`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({
          scores: scoresToSubmit.map((s) => ({
            row_id: s.row_id,
            col_id: s.col_id,
            score: s.score,
            confidence: s.confidence,
            notes: s.notes,
          })),
        }),
      })
      if (!res.ok) throw new Error('Failed to submit scores')
      setSubmitted(true)
    } catch {
      setError('Failed to submit scores. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !table) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error ?? 'Cross table not found'}
        </div>
      </div>
    )
  }

  return (
    <ScorerViewInner
      table={table}
      scores={scores}
      submitting={submitting}
      submitted={submitted}
      onSubmit={handleSubmit}
    />
  )
}

// ── Inner component with shared context provider ───────────────

interface ScorerViewInnerProps {
  table: CrossTable
  scores: Score[]
  submitting: boolean
  submitted: boolean
  onSubmit: (scores: Score[]) => Promise<void>
}

function ScorerViewInner({ table, scores, submitting, submitted, onSubmit }: ScorerViewInnerProps) {
  const [state, dispatch] = useReducer(editorReducer, {
    table,
    scores,
    scoresDirty: false,
    configVersion: 0,
    activeTab: 'matrix',
  })

  useEffect(() => {
    dispatch({ type: 'SET_TABLE', table })
  }, [table])

  useEffect(() => {
    dispatch({ type: 'SET_SCORES', scores })
  }, [scores])

  const totalCells = table.config.rows.length * table.config.columns.length
  const filledCells = state.scores.filter((s) => s.score !== null).length
  const completionPct = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="rounded-full bg-green-100 p-6 mb-6">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Scores Submitted</h2>
        <p className="text-muted-foreground max-w-md">
          Your scores for &ldquo;{table.title}&rdquo; have been submitted.
          The table owner will be notified.
        </p>
      </div>
    )
  }

  return (
    <CrossTableContext.Provider value={{ state, dispatch }}>
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{table.title}</h1>
            <p className="text-xs text-muted-foreground">
              Score each cell, then submit when ready
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Badge variant="outline" className="text-xs tabular-nums">
              {completionPct}% complete
            </Badge>
            <Button
              size="sm"
              className="bg-[#4F5BFF] hover:bg-[#4F5BFF]/90"
              disabled={submitting || filledCells === 0}
              onClick={() => onSubmit(state.scores)}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Submit Scores
            </Button>
          </div>
        </div>

        {/* Matrix only — no tabs */}
        <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
          <MatrixGrid />
        </div>

        {/* Incomplete warning */}
        {completionPct < 100 && filledCells > 0 && (
          <div className="border-t border-slate-200 px-4 py-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {totalCells - filledCells} cell{totalCells - filledCells !== 1 ? 's' : ''} still empty.
              You can submit partial scores.
            </span>
          </div>
        )}
      </div>
    </CrossTableContext.Provider>
  )
}
