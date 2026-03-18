import { useState, useEffect, useCallback } from 'react'
import type { ComBComponent, DeficitLevel } from '@/types/behavior-change-wheel'
import type { ComBComponentAssessment } from '@/types/comb-analysis'
import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-react'
import { Dumbbell, Brain, Globe, Users, Target, Zap, Check, AlertTriangle, X } from 'lucide-react'

const COMB_METADATA: Record<ComBComponent, { icon: LucideIcon; name: string; description: string; color: string }> = {
  physical_capability: {
    icon: Dumbbell,
    name: 'Physical Capability',
    description: 'Physical skills, strength, and stamina needed to perform the behavior.',
    color: '#f97316',
  },
  psychological_capability: {
    icon: Brain,
    name: 'Psychological Capability',
    description: 'Knowledge, cognitive and interpersonal skills, memory, and behavioral regulation.',
    color: '#f59e0b',
  },
  physical_opportunity: {
    icon: Globe,
    name: 'Physical Opportunity',
    description: 'Opportunity afforded by the environment — time, resources, locations, accessibility.',
    color: '#14b8a6',
  },
  social_opportunity: {
    icon: Users,
    name: 'Social Opportunity',
    description: 'Interpersonal influences, social cues, cultural norms, and group dynamics.',
    color: '#06b6d4',
  },
  reflective_motivation: {
    icon: Target,
    name: 'Reflective Motivation',
    description: 'Plans, evaluations, intentions, beliefs about identity, and conscious decisions.',
    color: '#6366f1',
  },
  automatic_motivation: {
    icon: Zap,
    name: 'Automatic Motivation',
    description: 'Emotional reactions, desires, impulses, inhibitions, and habitual patterns.',
    color: '#a855f7',
  },
}

const DEFICIT_OPTIONS: { value: DeficitLevel; label: string; icon: LucideIcon; activeClass: string }[] = [
  {
    value: 'adequate',
    label: 'Adequate',
    icon: Check,
    activeClass: 'border-green-500 bg-green-500/10 text-green-500',
  },
  {
    value: 'deficit',
    label: 'Deficit',
    icon: AlertTriangle,
    activeClass: 'border-amber-500 bg-amber-500/10 text-amber-500',
  },
  {
    value: 'major_barrier',
    label: 'Major Barrier',
    icon: X,
    activeClass: 'border-red-500 bg-red-500/10 text-red-500',
  },
]

interface WheelAssessmentPanelProps {
  isOpen: boolean
  component: ComBComponent | null
  assessment: ComBComponentAssessment | null
  onAssessmentChange: (component: ComBComponent, assessment: ComBComponentAssessment) => void
  onClose: () => void
  onNext: () => void
  currentIndex: number
  totalComponents: number
}

export function WheelAssessmentPanel({
  isOpen,
  component,
  assessment,
  onAssessmentChange,
  onClose,
  onNext,
  currentIndex,
  totalComponents,
}: WheelAssessmentPanelProps) {
  const [deficitLevel, setDeficitLevel] = useState<DeficitLevel>('adequate')
  const [evidenceNotes, setEvidenceNotes] = useState('')
  const [supportingEvidence, setSupportingEvidence] = useState('')
  const [facilitators, setFacilitators] = useState<string[]>([])
  const [barriers, setBarriers] = useState<string[]>([])
  const [newFacilitator, setNewFacilitator] = useState('')
  const [newBarrier, setNewBarrier] = useState('')

  // Reset local state when the active component changes
  useEffect(() => {
    if (component && assessment) {
      setDeficitLevel(assessment.deficit_level)
      setEvidenceNotes(assessment.evidence_notes)
      setSupportingEvidence(assessment.supporting_evidence?.join('\n') ?? '')
      setFacilitators(assessment.facilitators ?? [])
      setBarriers(assessment.barriers ?? [])
    } else {
      setDeficitLevel('adequate')
      setEvidenceNotes('')
      setSupportingEvidence('')
      setFacilitators([])
      setBarriers([])
    }
    setNewFacilitator('')
    setNewBarrier('')
  }, [component, assessment])

  // Escape key closes the panel
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    },
    [isOpen, onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const addFacilitator = () => {
    const val = newFacilitator.trim()
    if (val) {
      setFacilitators((prev) => [...prev, val])
      setNewFacilitator('')
    }
  }

  const addBarrier = () => {
    const val = newBarrier.trim()
    if (val) {
      setBarriers((prev) => [...prev, val])
      setNewBarrier('')
    }
  }

  const removeFacilitator = (idx: number) => {
    setFacilitators((prev) => prev.filter((_, i) => i !== idx))
  }

  const removeBarrier = (idx: number) => {
    setBarriers((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSaveAndContinue = () => {
    if (!component) return

    const evidenceLines = supportingEvidence
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const updated: ComBComponentAssessment = {
      component,
      deficit_level: deficitLevel,
      evidence_notes: evidenceNotes,
      supporting_evidence: evidenceLines.length > 0 ? evidenceLines : undefined,
      facilitators: facilitators.length > 0 ? facilitators : undefined,
      barriers: barriers.length > 0 ? barriers : undefined,
    }

    onAssessmentChange(component, updated)
    onNext()
  }

  // Compute visual balance
  const totalFactors = facilitators.length + barriers.length
  const balancePercent = totalFactors > 0 ? Math.round((facilitators.length / totalFactors) * 100) : 50

  const meta = component ? COMB_METADATA[component] : null
  const MetaIcon = meta?.icon ?? null

  return (
    <div
      role="dialog"
      aria-label={meta ? `${meta.name} Assessment` : 'COM-B Assessment'}
      className={`relative flex-shrink-0 border-l border-[#2d3348] bg-[#1a1d27] motion-safe:transition-all motion-safe:duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isOpen ? 'w-full sm:w-[420px]' : 'w-0 overflow-hidden'
      }`}
    >
      {!component && isOpen && (
        <div className="flex h-full w-full sm:w-[420px] items-center justify-center text-sm text-[#64748b]">
          Select a COM-B segment
        </div>
      )}
      {component && meta && (
        <div className="flex h-full w-full sm:w-[420px] flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#2d3348] px-5 py-4">
            <h2 className="text-base font-semibold text-white">{meta.name}</h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#94a3b8] transition-colors hover:bg-[#2d3348] hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1a1d27]"
              aria-label="Close panel"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Body (scrollable) */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {/* Component info */}
            <div className="mb-5">
              {MetaIcon && <MetaIcon className="h-8 w-8" style={{ color: meta.color }} />}
              <h3 className="mt-2 text-[20px] font-bold text-white">{meta.name}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[#94a3b8]">{meta.description}</p>
            </div>

            {/* Facilitators (Strengths) */}
            <div className="mb-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-[#cbd5e1]">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-green-500/20 text-xs text-green-400">+</span>
                Facilitators
                <span className="text-xs text-[#64748b]">— strengths that support this component</span>
              </label>
              <div className="flex gap-2">
                <input
                  value={newFacilitator}
                  onChange={(e) => setNewFacilitator(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFacilitator() } }}
                  placeholder="e.g., Strong existing knowledge base"
                  className="flex-1 rounded-lg border border-[#2d3348] bg-[#0f1117] px-3 py-2 text-sm text-white placeholder-[#475569] transition-colors focus:border-green-500 focus:outline-none"
                />
                <button
                  onClick={addFacilitator}
                  className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/20"
                >
                  Add
                </button>
              </div>
              {facilitators.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {facilitators.map((f, i) => (
                    <li key={i} className="group flex items-start gap-2 rounded-md bg-green-500/5 px-3 py-1.5 text-sm text-green-300">
                      <span className="mt-0.5 text-green-500">+</span>
                      <span className="flex-1">{f}</span>
                      <button
                        onClick={() => removeFacilitator(i)}
                        className="mt-0.5 p-3 -m-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#475569] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-red-400 hover:text-red-400"
                        aria-label="Remove facilitator"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 3l6 6M9 3l-6 6" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Barriers (Weaknesses) */}
            <div className="mb-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-[#cbd5e1]">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-red-500/20 text-xs text-red-400">-</span>
                Barriers
                <span className="text-xs text-[#64748b]">— weaknesses that hinder this component</span>
              </label>
              <div className="flex gap-2">
                <input
                  value={newBarrier}
                  onChange={(e) => setNewBarrier(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBarrier() } }}
                  placeholder="e.g., Limited access to training materials"
                  className="flex-1 rounded-lg border border-[#2d3348] bg-[#0f1117] px-3 py-2 text-sm text-white placeholder-[#475569] transition-colors focus:border-red-500 focus:outline-none"
                />
                <button
                  onClick={addBarrier}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
                >
                  Add
                </button>
              </div>
              {barriers.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {barriers.map((b, i) => (
                    <li key={i} className="group flex items-start gap-2 rounded-md bg-red-500/5 px-3 py-1.5 text-sm text-red-300">
                      <span className="mt-0.5 text-red-500">-</span>
                      <span className="flex-1">{b}</span>
                      <button
                        onClick={() => removeBarrier(i)}
                        className="mt-0.5 p-3 -m-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#475569] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-red-400 hover:text-red-400"
                        aria-label="Remove barrier"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 3l6 6M9 3l-6 6" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Balance Indicator */}
            {totalFactors > 0 && (
              <div className="mb-5 rounded-lg border border-[#2d3348] bg-[#0f1117] p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-[#64748b]">
                  <span>Facilitators ({facilitators.length})</span>
                  <span>Barriers ({barriers.length})</span>
                </div>
                <div
                  className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#1e2130]"
                  role="meter"
                  aria-valuenow={balancePercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Facilitator-barrier balance: ${balancePercent}% facilitators, ${100 - balancePercent}% barriers`}
                >
                  <div
                    className="rounded-l-full bg-green-500 transition-all duration-300"
                    style={{ width: `${balancePercent}%` }}
                  />
                  <div
                    className="rounded-r-full bg-red-500 transition-all duration-300"
                    style={{ width: `${100 - balancePercent}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-xs text-[#94a3b8]">
                  {balancePercent > 65
                    ? 'Balance suggests adequate capability'
                    : balancePercent < 35
                      ? 'Balance suggests significant barriers'
                      : 'Mixed — weigh the evidence below'}
                </p>
              </div>
            )}

            {/* Overall Deficit Judgment */}
            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-[#cbd5e1]">
                Overall Judgment
                <span className="ml-1 text-xs text-[#64748b]">— your weighted assessment</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {DEFICIT_OPTIONS.map((option) => {
                  const isActive = deficitLevel === option.value
                  const Icon = option.icon
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDeficitLevel(option.value)}
                      className={`rounded-lg border px-2 py-2.5 text-center text-xs font-medium transition-all ${
                        isActive ? option.activeClass : 'border-[#2d3348] text-[#94a3b8] hover:border-[#475569]'
                      }`}
                    >
                      <Icon className="mr-1 inline h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Evidence Notes */}
            <div className="mb-5">
              <label htmlFor="evidence-notes" className="mb-2 block text-sm font-medium text-[#cbd5e1]">
                Reasoning
                <span className="ml-1 text-xs text-[#64748b]">— why this judgment given the balance?</span>
              </label>
              <textarea
                id="evidence-notes"
                value={evidenceNotes}
                onChange={(e) => setEvidenceNotes(e.target.value)}
                placeholder="Despite some facilitators, the barriers are more critical because..."
                rows={3}
                className="w-full resize-none rounded-lg border border-[#2d3348] bg-[#0f1117] px-3 py-2.5 text-sm text-white placeholder-[#475569] transition-colors focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Supporting Evidence */}
            <div className="mb-6">
              <label htmlFor="supporting-evidence" className="mb-2 block text-sm font-medium text-[#cbd5e1]">
                References
              </label>
              <textarea
                id="supporting-evidence"
                value={supportingEvidence}
                onChange={(e) => setSupportingEvidence(e.target.value)}
                placeholder="Links or references (one per line)"
                rows={2}
                className="w-full resize-none rounded-lg border border-[#2d3348] bg-[#0f1117] px-3 py-2.5 text-sm text-white placeholder-[#475569] transition-colors focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Save & Continue */}
            <Button
              onClick={handleSaveAndContinue}
              className="w-full bg-indigo-500 text-white hover:bg-indigo-600"
            >
              Save & Continue &rarr;
            </Button>
          </div>

          {/* Progress bar (fixed at bottom) */}
          <div className="border-t border-[#2d3348] px-5 py-4">
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: totalComponents }, (_, i) => {
                let dotClass = 'bg-[#334155]' // pending
                if (i < currentIndex) dotClass = 'bg-green-500' // done
                if (i === currentIndex) dotClass = 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]' // active

                return (
                  <div
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full transition-all ${dotClass}`}
                  />
                )
              })}
            </div>
            <p className="mt-2 text-center text-xs text-[#94a3b8]">
              {currentIndex + 1} of {totalComponents} COM-B components
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
