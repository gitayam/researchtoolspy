import { useState, useEffect, useCallback } from 'react'
import type { ComBComponent, DeficitLevel } from '@/types/behavior-change-wheel'
import type { ComBComponentAssessment } from '@/types/comb-analysis'
import { Button } from '@/components/ui/button'

const COMB_METADATA: Record<ComBComponent, { icon: string; name: string; description: string; color: string }> = {
  physical_capability: {
    icon: '\u{1F4AA}',
    name: 'Physical Capability',
    description: 'Physical skills, strength, and stamina needed to perform the behavior.',
    color: '#f97316',
  },
  psychological_capability: {
    icon: '\u{1F9E0}',
    name: 'Psychological Capability',
    description: 'Knowledge, cognitive and interpersonal skills, memory, and behavioral regulation.',
    color: '#f59e0b',
  },
  physical_opportunity: {
    icon: '\u{1F30D}',
    name: 'Physical Opportunity',
    description: 'Opportunity afforded by the environment — time, resources, locations, accessibility.',
    color: '#14b8a6',
  },
  social_opportunity: {
    icon: '\u{1F465}',
    name: 'Social Opportunity',
    description: 'Interpersonal influences, social cues, cultural norms, and group dynamics.',
    color: '#06b6d4',
  },
  reflective_motivation: {
    icon: '\u{1F3AF}',
    name: 'Reflective Motivation',
    description: 'Plans, evaluations, intentions, beliefs about identity, and conscious decisions.',
    color: '#6366f1',
  },
  automatic_motivation: {
    icon: '\u26A1',
    name: 'Automatic Motivation',
    description: 'Emotional reactions, desires, impulses, inhibitions, and habitual patterns.',
    color: '#a855f7',
  },
}

const DEFICIT_OPTIONS: { value: DeficitLevel; label: string; icon: string; activeClass: string }[] = [
  {
    value: 'adequate',
    label: 'Adequate',
    icon: '\u2713',
    activeClass: 'border-green-500 bg-green-500/10 text-green-500',
  },
  {
    value: 'deficit',
    label: 'Deficit',
    icon: '\u26A0',
    activeClass: 'border-amber-500 bg-amber-500/10 text-amber-500',
  },
  {
    value: 'major_barrier',
    label: 'Major Barrier',
    icon: '\u2716',
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

  // Reset local state when the active component changes
  useEffect(() => {
    if (component && assessment) {
      setDeficitLevel(assessment.deficit_level)
      setEvidenceNotes(assessment.evidence_notes)
      setSupportingEvidence(assessment.supporting_evidence?.join('\n') ?? '')
    } else {
      setDeficitLevel('adequate')
      setEvidenceNotes('')
      setSupportingEvidence('')
    }
  }, [component, assessment])

  // Escape key closes the panel
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    },
    [isOpen, onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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
    }

    onAssessmentChange(component, updated)
    onNext()
  }

  const meta = component ? COMB_METADATA[component] : null

  return (
    <div
      role="dialog"
      aria-label={meta ? `${meta.name} Assessment` : 'COM-B Assessment'}
      className={`relative flex-shrink-0 border-l border-[#2d3348] bg-[#1a1d27] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isOpen ? 'w-[420px]' : 'w-0 overflow-hidden'
      }`}
    >
      {component && meta && (
        <div className="flex h-full w-[420px] flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#2d3348] px-5 py-4">
            <h2 className="text-base font-semibold text-white">{meta.name}</h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#94a3b8] transition-colors hover:bg-[#2d3348] hover:text-white"
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
            <div className="mb-6">
              <span className="text-[32px] leading-none">{meta.icon}</span>
              <h3 className="mt-2 text-[20px] font-bold text-white">{meta.name}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[#94a3b8]">{meta.description}</p>
            </div>

            {/* Deficit Assessment */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-[#cbd5e1]">Deficit Assessment</label>
              <div className="grid grid-cols-3 gap-2">
                {DEFICIT_OPTIONS.map((option) => {
                  const isActive = deficitLevel === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDeficitLevel(option.value)}
                      className={`rounded-lg border px-2 py-2.5 text-center text-xs font-medium transition-all ${
                        isActive ? option.activeClass : 'border-[#2d3348] text-[#94a3b8] hover:border-[#475569]'
                      }`}
                    >
                      <span className="mr-1">{option.icon}</span>
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Evidence Notes */}
            <div className="mb-5">
              <label htmlFor="evidence-notes" className="mb-2 block text-sm font-medium text-[#cbd5e1]">
                Evidence Notes
              </label>
              <textarea
                id="evidence-notes"
                value={evidenceNotes}
                onChange={(e) => setEvidenceNotes(e.target.value)}
                placeholder="Why did you assess this component at this level? What evidence supports your assessment?"
                rows={5}
                className="w-full resize-none rounded-lg border border-[#2d3348] bg-[#0f1117] px-3 py-2.5 text-sm text-white placeholder-[#475569] transition-colors focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Supporting Evidence */}
            <div className="mb-6">
              <label htmlFor="supporting-evidence" className="mb-2 block text-sm font-medium text-[#cbd5e1]">
                Supporting Evidence
              </label>
              <textarea
                id="supporting-evidence"
                value={supportingEvidence}
                onChange={(e) => setSupportingEvidence(e.target.value)}
                placeholder="Links or references to supporting evidence (one per line)"
                rows={3}
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
