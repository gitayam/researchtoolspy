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
import { getCopHeaders } from '@/lib/cop-auth'

// ── Auth ─────────────────────────────────────────────────────────


// ── Confidence helpers ───────────────────────────────────────────

const CONFIDENCE_LEVELS = [
  { value: 10, label: 'Very Low' },
  { value: 30, label: 'Low' },
  { value: 50, label: 'Medium' },
  { value: 70, label: 'High' },
  { value: 90, label: 'Very High' },
]

function confidenceColor(c: number): string {
  if (c >= 80) return 'text-green-600 dark:text-green-400'
  if (c >= 60) return 'text-blue-600 dark:text-blue-400'
  if (c >= 40) return 'text-amber-600 dark:text-amber-400'
  if (c >= 20) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

function confidenceBg(c: number): string {
  if (c >= 80) return 'bg-green-500'
  if (c >= 60) return 'bg-blue-500'
  if (c >= 40) return 'bg-amber-500'
  if (c >= 20) return 'bg-orange-500'
  return 'bg-red-500'
}

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
      const res = await fetch(`/api/cop/${sessionId}/hypotheses`, { headers: getCopHeaders() })
      if (!res.ok) {
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

  // New Hypothesis Form - confidence
  const [newConfidence, setNewConfidence] = useState(50)

  // Evidence linking
  const [linkingHypId, setLinkingHypId] = useState<string | null>(null)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkType, setLinkType] = useState<'supporting' | 'contradicting'>('supporting')
  const [linkSubmitting, setLinkSubmitting] = useState(false)

  // ── Create Hypothesis ──────────────────────────────────────────

  const handleCreate = async () => {
    if (!newStatement.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/hypotheses`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ statement: newStatement.trim(), confidence: newConfidence }),
      })
      if (res.ok) {
        setNewStatement('')
        setNewConfidence(50)
        setShowForm(false)
        await fetchHypotheses()
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  // ── Update Status/Confidence ──────────────────────────────────

  const handleUpdateHypothesis = async (hypId: string, updates: { status?: string; confidence?: number }) => {
    try {
      await fetch(`/api/cop/${sessionId}/hypotheses`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({ id: hypId, ...updates }),
      })
      await fetchHypotheses()
    } catch {
      // ignore
    }
  }

  // ── Link Evidence ─────────────────────────────────────────────

  const handleLinkEvidence = async (hypId: string) => {
    if (!linkTitle.trim()) return
    setLinkSubmitting(true)
    try {
      await fetch(`/api/cop/${sessionId}/hypotheses`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ hypothesis_id: hypId, title: linkTitle.trim(), type: linkType }),
      })
      setLinkTitle('')
      setLinkType('supporting')
      setLinkingHypId(null)
      await fetchHypotheses()
    } catch {
      // ignore
    } finally {
      setLinkSubmitting(false)
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
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-gray-500 dark:text-gray-400 shrink-0">Confidence:</label>
              <input
                type="range"
                min={0}
                max={100}
                value={newConfidence}
                onChange={e => setNewConfidence(Number(e.target.value))}
                className="flex-1 h-1.5 accent-emerald-500"
              />
              <span className={cn('text-[10px] font-medium tabular-nums w-8 text-right', confidenceColor(newConfidence))}>
                {newConfidence}%
              </span>
            </div>
            <div className="flex justify-end gap-2">
               <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="h-6 text-[10px] cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={submitting || !newStatement.trim()}
                className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Propose'}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-gray-500" />
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
                       <span className={cn('text-[10px] font-medium tabular-nums', confidenceColor(h.confidence))}>
                          {h.confidence}%
                       </span>
                       <span className="text-[10px] text-gray-600 dark:text-gray-400">
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
                    {/* Confidence bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 shrink-0">Confidence:</span>
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', confidenceBg(h.confidence))} style={{ width: `${h.confidence}%` }} />
                      </div>
                      <span className={cn('text-[10px] font-bold tabular-nums', confidenceColor(h.confidence))}>{h.confidence}%</span>
                    </div>

                    {/* Status actions */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {(['active', 'proven', 'disproven', 'archived'] as const).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleUpdateHypothesis(h.id, { status: s })}
                          className={cn(
                            'text-[9px] px-1.5 py-0.5 rounded border cursor-pointer transition-colors',
                            h.status === s
                              ? s === 'proven' ? 'bg-green-100 dark:bg-green-900/30 border-green-400 text-green-700 dark:text-green-400'
                              : s === 'disproven' ? 'bg-red-100 dark:bg-red-900/30 border-red-400 text-red-700 dark:text-red-400'
                              : s === 'archived' ? 'bg-gray-100 dark:bg-gray-800 border-gray-400 text-gray-600 dark:text-gray-400'
                              : 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 text-blue-700 dark:text-blue-400'
                              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
                          )}
                        >
                          {s === 'proven' && <Check className="h-2.5 w-2.5 inline mr-0.5" />}
                          {s === 'disproven' && <X className="h-2.5 w-2.5 inline mr-0.5" />}
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                      <div className="flex-1" />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={h.confidence}
                        onChange={e => handleUpdateHypothesis(h.id, { confidence: Number(e.target.value) })}
                        className="w-20 h-1 accent-emerald-500"
                        title="Adjust confidence"
                      />
                    </div>

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
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 italic pl-2">No supporting evidence linked.</p>
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
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 italic pl-2">No contradicting evidence linked.</p>
                       )}
                    </div>

                    {/* Link Evidence Form */}
                    {linkingHypId === h.id ? (
                      <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-2 space-y-1.5">
                        <input
                          type="text"
                          value={linkTitle}
                          onChange={e => setLinkTitle(e.target.value)}
                          placeholder="Evidence description..."
                          className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <select
                            value={linkType}
                            onChange={e => setLinkType(e.target.value as any)}
                            className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="supporting">Supporting</option>
                            <option value="contradicting">Contradicting</option>
                          </select>
                          <div className="flex-1" />
                          <Button size="sm" variant="ghost" onClick={() => setLinkingHypId(null)} className="h-5 text-[9px] cursor-pointer">Cancel</Button>
                          <Button
                            size="sm"
                            onClick={() => handleLinkEvidence(h.id)}
                            disabled={linkSubmitting || !linkTitle.trim()}
                            className="h-5 text-[9px] bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                          >
                            {linkSubmitting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : 'Link'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setLinkingHypId(h.id)}
                        className="text-[10px] text-emerald-500 hover:text-emerald-400 cursor-pointer transition-colors"
                      >
                        + Link Evidence
                      </button>
                    )}
                 </div>
               )}
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <Brain className="h-6 w-6 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">No hypotheses proposed yet.</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">
              Propose a hypothesis to start Analysis of Competing Hypotheses (ACH).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
