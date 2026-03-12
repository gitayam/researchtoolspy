import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Brain,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getCopHeaders } from '@/lib/cop-auth'

// ── Types ────────────────────────────────────────────────────────

interface Hypothesis {
  id: string
  statement: string
  status: 'active' | 'proven' | 'disproven' | 'archived'
  confidence: number
  evidence_count?: number
  supporting_count?: number
  contradicting_count?: number
  created_at: string
}

interface Finding {
  finding: string
  confidence: number
  status: string
}

interface Contradiction {
  description: string
  side_a: string
  side_b: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
}

// ── Props ────────────────────────────────────────────────────────

interface CopAnalysisSummaryProps {
  sessionId: string
  expanded: boolean
}

// ── Component ────────────────────────────────────────────────────

export default function CopAnalysisSummary({ sessionId, expanded }: CopAnalysisSummaryProps) {
  const [findings, setFindings] = useState<Finding[]>([])
  const [contradictions, setContradictions] = useState<Contradiction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const headers = getCopHeaders()

    try {
      const res = await fetch(`/api/cop/${sessionId}/hypotheses`, { headers })

      if (!res.ok) {
        throw new Error(`Failed to load hypotheses (${res.status})`)
      }

      const data = await res.json()
      const hypotheses: Hypothesis[] = data.hypotheses ?? []

      // Derive findings from hypotheses with evidence
      const derivedFindings: Finding[] = hypotheses
        .filter(h => h.status !== 'archived')
        .sort((a, b) => b.confidence - a.confidence)
        .map(h => ({
          finding: h.statement,
          confidence: h.confidence,
          status: h.status,
        }))

      // Derive contradictions: active hypotheses with contradicting evidence
      const derivedContradictions: Contradiction[] = hypotheses
        .filter(h => h.status === 'active' && (h.contradicting_count ?? 0) > 0)
        .map(h => ({
          description: `Hypothesis "${h.statement.slice(0, 80)}${h.statement.length > 80 ? '...' : ''}" has contradicting evidence`,
          side_a: `${h.supporting_count ?? 0} supporting`,
          side_b: `${h.contradicting_count ?? 0} contradicting`,
          severity: (h.contradicting_count ?? 0) >= 3 ? 'CRITICAL' as const : (h.contradicting_count ?? 0) >= 2 ? 'WARNING' as const : 'INFO' as const,
        }))

      setFindings(derivedFindings)
      setContradictions(derivedContradictions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const visibleFindings = expanded ? findings.slice(0, 20) : findings.slice(0, 5)
  const isEmpty = findings.length === 0 && contradictions.length === 0

  // ── Loading state ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 text-gray-500 animate-spin" />
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────────

  if (error) {
    return (
      <div className="text-center py-6 px-3">
        <p className="text-xs text-red-400 mb-2">{error}</p>
        <button
          type="button"
          onClick={fetchData}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  // ── Empty state ──────────────────────────────────────────────

  if (isEmpty) {
    return (
      <div className="text-center py-6 px-3">
        <Brain className="h-6 w-6 text-gray-600 mx-auto mb-2" />
        <p className="text-xs text-gray-500">No hypotheses yet</p>
        <p className="text-[10px] text-gray-600 mt-1">
          Add hypotheses to see analysis and contradictions here.
        </p>
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-y-auto px-3 py-3 space-y-4">
      {/* Key Findings (Hypotheses by confidence) */}
      {visibleFindings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Hypotheses
          </h3>
          <div className="space-y-1.5">
            {visibleFindings.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className={cn(
                  'h-3.5 w-3.5 mt-0.5 shrink-0',
                  f.status === 'proven' ? 'text-emerald-400' :
                  f.status === 'disproven' ? 'text-red-400' :
                  'text-blue-400'
                )} />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-gray-700 dark:text-gray-200 leading-relaxed">{f.finding}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge
                      className={cn(
                        'text-[9px] px-1.5 py-0 leading-4 border-transparent text-white',
                        f.confidence >= 75
                          ? 'bg-emerald-600'
                          : f.confidence >= 50
                            ? 'bg-amber-600'
                            : 'bg-gray-600'
                      )}
                    >
                      {f.confidence}%
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] px-1.5 py-0 leading-4 border-gray-600',
                        f.status === 'proven' ? 'text-emerald-400' :
                        f.status === 'disproven' ? 'text-red-400' :
                        'text-gray-400'
                      )}
                    >
                      {f.status}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {!expanded && findings.length > 5 && (
            <p className="text-[10px] text-gray-500 italic">
              +{findings.length - 5} more hypotheses (expand to view)
            </p>
          )}
        </div>
      )}

      {/* Contradictions */}
      {contradictions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Contradictions
            </h3>
            <span className="text-[10px] text-gray-500">({contradictions.length})</span>
          </div>
          <div className="space-y-1.5">
            {contradictions.map((c, i) => (
              <div
                key={i}
                className="rounded border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-2 space-y-1.5"
              >
                <div className="flex items-start gap-2 text-xs">
                  <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{c.description}</p>
                </div>
                <div className="flex items-center gap-1.5 pl-5">
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 leading-4 text-emerald-400 border-emerald-600"
                  >
                    {c.side_a}
                  </Badge>
                  <ArrowRight className="h-3 w-3 text-gray-500 shrink-0" />
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 leading-4 text-red-400 border-red-600"
                  >
                    {c.side_b}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
