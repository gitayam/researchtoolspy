import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Brain,
  Plus,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  AlertCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Target,
  MapPin,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────

interface HypothesisEvidence {
  id: string
  evidence_id: string
  title: string
  type: 'supporting' | 'contradicting'
  created_at: string
}

interface Hypothesis {
  id: string
  statement: string
  status: 'active' | 'proven' | 'disproven' | 'archived'
  confidence: number // 0-100
  evidence: HypothesisEvidence[]
  created_at: string
  updated_at: string
}
interface CopHypothesisTabProps {
  sessionId: string
  onPinToMap?: (id: string, statement: string) => void
}

// ── Component ────────────────────────────────────────────────────

export default function CopHypothesisTab({ sessionId, onPinToMap }: CopHypothesisTabProps) {
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([])

  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  
  // New Hypothesis Form
  const [showForm, setShowForm] = useState(false)
  const [newStatement, setNewStatement] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ── Fetch Hypotheses ──────────────────────────────────────────

  const fetchHypotheses = useCallback(async () => {
    try {
      // For now, using a mock/placeholder endpoint or state until backend catch up
      // In a real implementation, this would hit /api/cop/${sessionId}/hypotheses
      const res = await fetch(`/api/cop/${sessionId}/hypotheses`)
      if (!res.ok) {
         // Fallback to empty if not implemented yet
         setHypotheses([])
         return
      }
      const data = await res.json()
      setHypotheses(data.hypotheses ?? [])
    } catch {
      // Silent failure
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchHypotheses()
  }, [fetchHypotheses])

  // ── Create Hypothesis ──────────────────────────────────────────

  const handleCreate = async () => {
    if (!newStatement.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/hypotheses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement: newStatement.trim() }),
      })
      if (res.ok) {
        setNewStatement('')
        setShowForm(false)
        await fetchHypotheses()
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-200 uppercase tracking-wider">Hypotheses</h2>
          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">ACH</Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm(!showForm)}
          className="h-6 text-[10px] px-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Plus className="h-3 w-3 mr-0.5" />
          Propose
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {showForm && (
          <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-2 space-y-2">
            <textarea
              value={newStatement}
              onChange={e => setNewStatement(e.target.value)}
              placeholder="e.g., The threat actors are operating out of Argentina based on power outlet types."
              rows={3}
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2">
               <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="h-6 text-[10px]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={submitting || !newStatement.trim()}
                className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Propose'}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
          </div>
        ) : hypotheses.length > 0 ? (
          hypotheses.map(h => (
            <div key={h.id} className="relative rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 overflow-hidden">
               <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}
                  className="w-full flex items-start gap-2 px-2.5 py-2 pr-10 text-left hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {expandedId === h.id ? (
                    <ChevronDown className="h-3 w-3 text-gray-500 mt-0.5 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-gray-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs text-gray-900 dark:text-gray-200 leading-relaxed font-medium">{h.statement}</p>
                    <div className="flex items-center gap-2">
                       <div className="flex items-center gap-1">
                          <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
                          <span className="text-[10px] text-emerald-400">
                             {h.evidence.filter(e => e.type === 'supporting').length}
                          </span>
                       </div>
                       <div className="flex items-center gap-1">
                          <TrendingDown className="h-2.5 w-2.5 text-red-500" />
                          <span className="text-[10px] text-red-400">
                             {h.evidence.filter(e => e.type === 'contradicting').length}
                          </span>
                       </div>
                       <div className="flex-1" />
                       <span className="text-[10px] text-gray-500">
                          {h.status.toUpperCase()}
                       </span>
                    </div>
                  </div>
               </button>

               {/* Pin to Map action */}
               {onPinToMap && (
                 <button
                   type="button"
                   onClick={(e) => {
                     e.stopPropagation()
                     onPinToMap(h.id, h.statement)
                   }}
                   className="absolute top-2 right-2 p-1 rounded text-gray-500 hover:text-green-400 transition-colors cursor-pointer"
                   title="Pin to map"
                 >
                   <MapPin className="h-3.5 w-3.5" />
                 </button>
               )}

               {expandedId === h.id && (

                 <div className="px-2.5 pb-2 border-t border-gray-200 dark:border-gray-700 pt-2 space-y-2">
                    {/* Evidence List */}
                    <div className="space-y-1">
                       <h3 className="text-[10px] font-semibold text-gray-500 uppercase">Supporting Evidence</h3>
                       {h.evidence.filter(e => e.type === 'supporting').length > 0 ? (
                          h.evidence.filter(e => e.type === 'supporting').map(e => (
                             <div key={e.id} className="flex items-center gap-2 text-[11px] text-gray-700 dark:text-gray-300 pl-2 border-l border-emerald-500/50">
                                <Target className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                                <span className="truncate">{e.title}</span>
                             </div>
                          ))
                       ) : (
                          <p className="text-[10px] text-gray-600 italic pl-2">No supporting evidence linked.</p>
                       )}
                    </div>
                    <div className="space-y-1">
                       <h3 className="text-[10px] font-semibold text-gray-500 uppercase">Contradicting Evidence</h3>
                       {h.evidence.filter(e => e.type === 'contradicting').length > 0 ? (
                          h.evidence.filter(e => e.type === 'contradicting').map(e => (
                             <div key={e.id} className="flex items-center gap-2 text-[11px] text-gray-700 dark:text-gray-300 pl-2 border-l border-red-500/50">
                                <AlertCircle className="h-2.5 w-2.5 text-red-500 shrink-0" />
                                <span className="truncate">{e.title}</span>
                             </div>
                          ))
                       ) : (
                          <p className="text-[10px] text-gray-600 italic pl-2">No contradicting evidence linked.</p>
                       )}
                    </div>
                 </div>
               )}
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <Brain className="h-6 w-6 text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No hypotheses proposed yet.</p>
            <p className="text-[10px] text-gray-600 mt-1">
              Propose a hypothesis to start Analysis of Competing Hypotheses (ACH).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
