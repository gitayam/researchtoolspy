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

// ── Types ────────────────────────────────────────────────────────

interface Finding {
  finding: string
  confidence: number
  supporting_frameworks: string[]
  evidence_count?: number
}

interface Contradiction {
  description: string
  side_a: { framework_type: string; session_id: string; claim: string }
  side_b: { framework_type: string; session_id: string; claim: string }
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  suggested_resolution?: string
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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    const userHash = localStorage.getItem('omnicore_user_hash')
    if (userHash) {
      headers['Authorization'] = `Bearer ${userHash}`
    }

    try {
      const [synthRes, contraRes] = await Promise.all([
        fetch('/api/intelligence/synthesis', { headers }),
        fetch('/api/intelligence/contradictions', { headers }),
      ])

      if (!synthRes.ok) {
        throw new Error(`Synthesis failed (${synthRes.status})`)
      }
      if (!contraRes.ok) {
        throw new Error(`Contradictions failed (${contraRes.status})`)
      }

      const synthData = await synthRes.json()
      const contraData = await contraRes.json()

      setFindings(Array.isArray(synthData.key_findings) ? synthData.key_findings : [])
      setContradictions(Array.isArray(contraData.contradictions) ? contraData.contradictions : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis')
    } finally {
      setLoading(false)
    }
  }, [])

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
        <p className="text-xs text-gray-500">No analyses run yet</p>
        <p className="text-[10px] text-gray-600 mt-1">
          Run a SWOT, ACH, or other framework analysis to see synthesized results here.
        </p>
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-y-auto px-3 py-3 space-y-4">
      {/* Key Findings */}
      {visibleFindings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Key Findings
          </h3>
          <div className="space-y-1.5">
            {visibleFindings.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-gray-200 leading-relaxed">{f.finding}</p>
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
                    {f.supporting_frameworks.map((fw) => (
                      <Badge
                        key={fw}
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 leading-4 text-gray-400 border-gray-600"
                      >
                        {fw}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {!expanded && findings.length > 5 && (
            <p className="text-[10px] text-gray-500 italic">
              +{findings.length - 5} more findings (expand to view)
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
                className="rounded border border-amber-800/40 bg-amber-900/20 px-2.5 py-2 space-y-1.5"
              >
                <div className="flex items-start gap-2 text-xs">
                  <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-gray-300 leading-relaxed">{c.description}</p>
                </div>
                <div className="flex items-center gap-1.5 pl-5">
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 leading-4 text-gray-400 border-gray-600"
                  >
                    {c.side_a.framework_type}
                  </Badge>
                  <ArrowRight className="h-3 w-3 text-gray-500 shrink-0" />
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 leading-4 text-gray-400 border-gray-600"
                  >
                    {c.side_b.framework_type}
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
