import { useState, useEffect } from 'react'
import { AlertTriangle, Brain, CheckCircle, HelpCircle, Loader2, Network, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// ── Types ────────────────────────────────────────────────────────

interface Gap {
  title: string
  description: string
  suggestion?: string
  severity: 'high' | 'medium' | 'low'
  icon: React.ReactNode
}

interface CopGapAnalysisProps {
  sessionId: string
}

// ── Auth helper ──────────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const userHash = localStorage.getItem('omnicore_user_hash')
  if (userHash) headers['X-User-Hash'] = userHash
  return headers
}

// ── Severity badge colors ────────────────────────────────────────

const SEVERITY_CLASSES: Record<Gap['severity'], string> = {
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

// ── Gap detection logic ──────────────────────────────────────────

function analyzeGaps(stats: any, rfis: any[]): Gap[] {
  const gaps: Gap[] = []

  if (stats.evidence_count === 0) {
    gaps.push({
      title: 'No evidence collected',
      description: 'Investigation has no evidence items yet.',
      suggestion: 'Add evidence via the Evidence Feed or URL analysis.',
      severity: 'high',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />,
    })
  } else if (stats.evidence_count < 5) {
    gaps.push({
      title: 'Limited evidence base',
      description: `Only ${stats.evidence_count} evidence items collected.`,
      suggestion: 'Consider gathering more sources to strengthen findings.',
      severity: 'medium',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />,
    })
  }

  if (stats.entity_count === 0) {
    gaps.push({
      title: 'No entities identified',
      description: 'No actors, sources, or events tracked.',
      suggestion: 'Identify key actors and sources from evidence.',
      severity: 'high',
      icon: <Users className="h-3.5 w-3.5 text-red-400 shrink-0" />,
    })
  }

  if (stats.relationship_count === 0 && stats.entity_count > 1) {
    gaps.push({
      title: 'No relationships mapped',
      description: `${stats.entity_count} entities but no connections between them.`,
      suggestion: 'Use the Entity Graph to map relationships.',
      severity: 'medium',
      icon: <Network className="h-3.5 w-3.5 text-amber-400 shrink-0" />,
    })
  }

  if (stats.framework_count === 0) {
    gaps.push({
      title: 'No analysis frameworks applied',
      description: 'No structured analysis has been performed.',
      suggestion: 'Apply SWOT, ACH, or other framework to structure findings.',
      severity: 'medium',
      icon: <Brain className="h-3.5 w-3.5 text-amber-400 shrink-0" />,
    })
  }

  const openRfis = rfis.filter(r => r.status === 'open')
  if (openRfis.length > 0) {
    gaps.push({
      title: `${openRfis.length} unanswered question${openRfis.length !== 1 ? 's' : ''}`,
      description: openRfis.slice(0, 2).map(r => r.question).join('; '),
      severity: openRfis.length > 3 ? 'high' : 'medium',
      icon: <HelpCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />,
    })
  }

  return gaps
}

// ── Component ────────────────────────────────────────────────────

export default function CopGapAnalysis({ sessionId }: CopGapAnalysisProps) {
  const [gaps, setGaps] = useState<Gap[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAndAnalyze() {
      setLoading(true)
      try {
        const [statsRes, rfisRes] = await Promise.all([
          fetch(`/api/cop/${sessionId}/stats`, { headers: getHeaders() }),
          fetch(`/api/cop/${sessionId}/rfis`, { headers: getHeaders() }),
        ])

        if (cancelled) return

        const statsData = statsRes.ok ? await statsRes.json() : { stats: {} }
        const rfisData = rfisRes.ok ? await rfisRes.json() : { rfis: [] }

        const stats = statsData.stats ?? statsData ?? {}
        const rfis: any[] = rfisData.rfis ?? rfisData ?? []

        if (!cancelled) {
          setGaps(analyzeGaps(stats, rfis))
        }
      } catch {
        // Silently handle fetch errors — panel shows empty state
        if (!cancelled) setGaps([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAndAnalyze()
    return () => { cancelled = true }
  }, [sessionId])

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Gap Analysis</h3>

      {loading ? (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          <span className="text-xs text-gray-500">Analyzing gaps...</span>
        </div>
      ) : gaps.length === 0 ? (
        <div className="text-center py-4">
          <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No significant gaps identified</p>
        </div>
      ) : (
        gaps.map((gap, i) => (
          <div key={i} className="rounded border border-gray-700 bg-gray-800/30 px-3 py-2 space-y-1">
            <div className="flex items-center gap-2">
              {gap.icon}
              <span className="text-xs font-medium text-gray-200">{gap.title}</span>
              <Badge
                className={`text-[9px] px-1.5 py-0 leading-4 ${SEVERITY_CLASSES[gap.severity]}`}
              >
                {gap.severity}
              </Badge>
            </div>
            <p className="text-[10px] text-gray-400 pl-6">{gap.description}</p>
            {gap.suggestion && (
              <p className="text-[10px] text-blue-400 pl-6">Suggested: {gap.suggestion}</p>
            )}
          </div>
        ))
      )}
    </div>
  )
}
