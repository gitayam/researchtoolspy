/**
 * WheelInterventionPanel
 *
 * Slide-out side panel for viewing and selecting intervention functions
 * within the Behaviour Change Wheel UI. Opens when an intervention ring
 * segment is clicked, displaying detailed information about the intervention
 * including its definition, evidence base, examples, triggering COM-B
 * components, and applicable policy categories.
 */

import { useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { InterventionFunction, PolicyCategory } from '@/types/behavior-change-wheel'
import {
  INTERVENTION_DESCRIPTIONS,
  INTERVENTION_POLICY_MAP,
} from '@/utils/behaviour-change-wheel'

const POLICY_LABELS: Record<PolicyCategory, string> = {
  communication_marketing: 'Comms/Marketing',
  guidelines: 'Guidelines',
  fiscal_measures: 'Fiscal Measures',
  regulation: 'Regulation',
  legislation: 'Legislation',
  environmental_social_planning: 'Env/Social Planning',
  service_provision: 'Service Provision',
}

/**
 * Color mapping for COM-B component badges.
 * Each COM-B component gets a distinct color for visual identification.
 */
const COM_B_COLORS: Record<string, string> = {
  'Physical Capability': 'bg-blue-600/30 text-blue-300 border-blue-500/40',
  'Psychological Capability': 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40',
  'Physical Opportunity': 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40',
  'Social Opportunity': 'bg-green-600/30 text-green-300 border-green-500/40',
  'Reflective Motivation': 'bg-orange-600/30 text-orange-300 border-orange-500/40',
  'Automatic Motivation': 'bg-red-600/30 text-red-300 border-red-500/40',
}

export interface WheelInterventionPanelProps {
  isOpen: boolean
  intervention: InterventionFunction | null
  selectedInterventions: InterventionFunction[]
  onInterventionToggle: (intervention: InterventionFunction) => void
  onClose: () => void
  triggeringComponents: string[]
}

export function WheelInterventionPanel({
  isOpen,
  intervention,
  selectedInterventions,
  onInterventionToggle,
  onClose,
  triggeringComponents,
}: WheelInterventionPanelProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    },
    [isOpen, onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  const detail = intervention ? INTERVENTION_DESCRIPTIONS[intervention] : null
  const policies = intervention ? INTERVENTION_POLICY_MAP[intervention] : []
  const isSelected = intervention ? selectedInterventions.includes(intervention) : false

  return (
    <div
      role="dialog"
      aria-label={detail ? `${detail.name} intervention details` : 'Intervention details'}
      className={`
        h-full border-l border-[#2d3348] bg-[#1a1d27]
        motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-in-out
        ${isOpen ? 'w-full sm:w-[420px]' : 'w-0 overflow-hidden'}
      `}
    >
      {detail && intervention && (
        <div className="flex h-full w-full sm:w-[420px] flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#2d3348] px-5 py-4">
            <h2 className="text-lg font-semibold text-white">{detail.name}</h2>
            <button
              onClick={onClose}
              className="rounded p-2.5 text-[#94a3b8] transition-colors hover:bg-[#2d3348] hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1a1d27]"
              aria-label="Close panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-5">
              {/* Definition */}
              <div>
                <h3 className="text-[20px] font-bold text-white">{detail.name}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-[#94a3b8]">
                  {detail.definition}
                </p>
              </div>

              {/* Triggered by */}
              {triggeringComponents.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                    Triggered by
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {triggeringComponents.map((component) => (
                      <Badge
                        key={component}
                        variant="outline"
                        className={`text-xs ${COM_B_COLORS[component] ?? 'bg-slate-600/30 text-slate-300 border-slate-500/40'}`}
                      >
                        {component}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Select / Deselect */}
              <div>
                {isSelected ? (
                  <Button
                    onClick={() => onInterventionToggle(intervention)}
                    className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    &#10003; Selected
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => onInterventionToggle(intervention)}
                    className="w-full border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/20"
                  >
                    Select This Intervention
                  </Button>
                )}
              </div>

              {/* Evidence Base */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  Evidence Base
                </h4>
                <div className="rounded-lg bg-[#0f1117] p-3">
                  <p className="text-[13px] leading-relaxed text-[#94a3b8]">
                    {detail.evidenceBase}
                  </p>
                </div>
              </div>

              {/* Examples */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  Examples
                </h4>
                <ul className="space-y-1.5 pl-4">
                  {detail.examples.map((example, idx) => (
                    <li
                      key={idx}
                      className="list-disc text-[13px] leading-relaxed text-[#94a3b8]"
                    >
                      {example}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Applicable Policies */}
              {policies.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                    Applicable Policies
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {policies.map((policy) => (
                      <Badge
                        key={policy}
                        variant="outline"
                        className="border-[#3d4560] bg-[#252837] text-xs text-[#c4b5fd]"
                      >
                        {POLICY_LABELS[policy]}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
