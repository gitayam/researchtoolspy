/**
 * BehaviourChangeWheel
 *
 * Main orchestrator for the interactive Behaviour Change Wheel UI.
 * Combines the SVG wheel with slide-out assessment/intervention panels.
 *
 * Flow: COM-B assessment → Intervention selection → Policy recommendations
 *
 * Based on Michie, S., van Stralen, M. M., & West, R. (2011).
 */

import { useState, useMemo, useCallback } from 'react'
import type { ComBComponent, ComBDeficits, DeficitLevel, InterventionFunction, PolicyCategory } from '@/types/behavior-change-wheel'
import type { ComBComponentAssessment } from '@/types/comb-analysis'
import {
  COM_B_INTERVENTION_MAP,
  INTERVENTION_POLICY_MAP,
  generateInterventionRecommendations,
} from '@/utils/behaviour-change-wheel'
import { WheelSVG } from './WheelSVG'
import { WheelAssessmentPanel } from './WheelAssessmentPanel'
import { WheelInterventionPanel } from './WheelInterventionPanel'
import { COMB_SEGMENTS } from './wheel-geometry'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BehaviourChangeWheelProps {
  deficits: ComBDeficits
  assessments?: Record<string, { evidence_notes: string; supporting_evidence: string[] }>
  selectedInterventions?: InterventionFunction[]
  onDeficitChange?: (component: ComBComponent, level: DeficitLevel) => void
  onAssessmentChange?: (component: ComBComponent, assessment: ComBComponentAssessment) => void
  onInterventionSelect?: (interventions: InterventionFunction[]) => void
  readOnly?: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMB_ORDER: ComBComponent[] = [
  'physical_capability',
  'psychological_capability',
  'physical_opportunity',
  'social_opportunity',
  'reflective_motivation',
  'automatic_motivation',
]

const COMB_DISPLAY_NAMES: Record<ComBComponent, string> = {
  physical_capability: 'Physical Capability',
  psychological_capability: 'Psychological Capability',
  physical_opportunity: 'Physical Opportunity',
  social_opportunity: 'Social Opportunity',
  reflective_motivation: 'Reflective Motivation',
  automatic_motivation: 'Automatic Motivation',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BehaviourChangeWheel({
  deficits,
  assessments = {},
  selectedInterventions = [],
  onDeficitChange,
  onAssessmentChange,
  onInterventionSelect,
  readOnly = false,
}: BehaviourChangeWheelProps) {
  // Panel state
  const [activeComBComponent, setActiveComBComponent] = useState<ComBComponent | null>(null)
  const [activeIntervention, setActiveIntervention] = useState<InterventionFunction | null>(null)
  const [panelMode, setPanelMode] = useState<'comb' | 'intervention' | null>(null)

  // Track which components have been assessed (have non-default state)
  const assessedComponents = useMemo(() => {
    const set = new Set<ComBComponent>()
    for (const comp of COMB_ORDER) {
      // Consider assessed if there's an explicit assessment or deficit is not 'adequate'
      if (assessments[comp] || deficits[comp] !== 'adequate') {
        set.add(comp)
      }
    }
    return set
  }, [deficits, assessments])

  // Compute which intervention functions are recommended based on current deficits
  const activeInterventionIds = useMemo(() => {
    const set = new Set<InterventionFunction>()
    const recs = generateInterventionRecommendations(deficits)
    for (const rec of recs) {
      for (const intervention of rec.interventions) {
        set.add(intervention.name)
      }
    }
    return set
  }, [deficits])

  // Compute which policy categories are active based on selected interventions
  const activePolicyIds = useMemo(() => {
    const set = new Set<PolicyCategory>()
    for (const intervention of selectedInterventions) {
      const policies = INTERVENTION_POLICY_MAP[intervention]
      if (policies) {
        for (const policy of policies) {
          set.add(policy)
        }
      }
    }
    return set
  }, [selectedInterventions])

  // Compute which COM-B components trigger a given intervention
  const getTriggering = useCallback(
    (intervention: InterventionFunction): string[] => {
      const triggers: string[] = []
      for (const comp of COMB_ORDER) {
        if (deficits[comp] !== 'adequate') {
          const mapped = COM_B_INTERVENTION_MAP[comp]
          if (mapped.includes(intervention)) {
            triggers.push(COMB_DISPLAY_NAMES[comp])
          }
        }
      }
      return triggers
    },
    [deficits],
  )

  // Build the assessment object for the active component
  const activeAssessment = useMemo((): ComBComponentAssessment | null => {
    if (!activeComBComponent) return null
    const saved = assessments[activeComBComponent]
    return {
      component: activeComBComponent,
      deficit_level: deficits[activeComBComponent],
      evidence_notes: saved?.evidence_notes ?? '',
      supporting_evidence: saved?.supporting_evidence,
    }
  }, [activeComBComponent, deficits, assessments])

  // Handlers
  const handleComBClick = useCallback(
    (component: ComBComponent) => {
      if (readOnly) return
      setActiveComBComponent(component)
      setActiveIntervention(null)
      setPanelMode('comb')
    },
    [readOnly],
  )

  const handleInterventionClick = useCallback(
    (intervention: InterventionFunction) => {
      setActiveIntervention(intervention)
      setActiveComBComponent(null)
      setPanelMode('intervention')
    },
    [],
  )

  const handlePolicyClick = useCallback((_policy: PolicyCategory) => {
    // Policies are informational — no panel for now
  }, [])

  const handleClosePanel = useCallback(() => {
    setPanelMode(null)
    setActiveComBComponent(null)
    setActiveIntervention(null)
  }, [])

  const handleAssessmentChange = useCallback(
    (component: ComBComponent, assessment: ComBComponentAssessment) => {
      onDeficitChange?.(component, assessment.deficit_level)
      onAssessmentChange?.(component, assessment)
    },
    [onDeficitChange, onAssessmentChange],
  )

  const handleNextComponent = useCallback(() => {
    if (!activeComBComponent) return
    const idx = COMB_ORDER.indexOf(activeComBComponent)
    if (idx < COMB_ORDER.length - 1) {
      setActiveComBComponent(COMB_ORDER[idx + 1])
    } else {
      // All done — close panel
      handleClosePanel()
    }
  }, [activeComBComponent, handleClosePanel])

  const handleInterventionToggle = useCallback(
    (intervention: InterventionFunction) => {
      if (readOnly || !onInterventionSelect) return
      const updated = selectedInterventions.includes(intervention)
        ? selectedInterventions.filter((i) => i !== intervention)
        : [...selectedInterventions, intervention]
      onInterventionSelect(updated)
    },
    [readOnly, selectedInterventions, onInterventionSelect],
  )

  const currentComponentIndex = activeComBComponent
    ? COMB_ORDER.indexOf(activeComBComponent)
    : 0

  // Subtitle text
  const allAssessed = assessedComponents.size >= 6
  const hasDeficits = activeInterventionIds.size > 0
  let subtitle = 'Click a COM-B segment to begin assessment'
  if (readOnly) {
    subtitle = 'Behaviour Change Wheel assessment (Michie et al., 2011)'
  } else if (allAssessed && !hasDeficits) {
    subtitle = 'All COM-B components adequate — no interventions needed'
  } else if (allAssessed && selectedInterventions.length > 0) {
    subtitle = `${selectedInterventions.length} intervention${selectedInterventions.length !== 1 ? 's' : ''} selected — review policy categories`
  } else if (allAssessed) {
    subtitle = 'COM-B assessment complete — select intervention functions'
  }

  return (
    <div className="flex h-full w-full" style={{ minHeight: '500px' }}>
      {/* Wheel area */}
      <div
        className="flex flex-1 flex-col items-center justify-center px-6 py-4 transition-all duration-400"
        style={{ flex: panelMode ? 0.6 : 1 }}
      >
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#94a3b8]">
          Behaviour Change Wheel
        </h2>
        <p className="mb-4 text-xs text-[#64748b]">{subtitle}</p>

        <div className="w-full" style={{ maxWidth: 'min(520px, 85vw)' }}>
          <WheelSVG
            deficits={deficits}
            assessedComponents={assessedComponents}
            activeComponent={activeComBComponent}
            activeInterventionIds={activeInterventionIds}
            selectedInterventions={selectedInterventions}
            activePolicyIds={activePolicyIds}
            onComBClick={handleComBClick}
            onInterventionClick={handleInterventionClick}
            onPolicyClick={handlePolicyClick}
          />
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-[#64748b]">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#334155]" />
            Unassessed
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            Adequate
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
            Deficit
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
            Major Barrier
          </div>
        </div>
      </div>

      {/* Side panels — only one visible at a time */}
      {panelMode === 'comb' && (
        <WheelAssessmentPanel
          isOpen={panelMode === 'comb'}
          component={activeComBComponent}
          assessment={activeAssessment}
          onAssessmentChange={handleAssessmentChange}
          onClose={handleClosePanel}
          onNext={handleNextComponent}
          currentIndex={currentComponentIndex}
          totalComponents={6}
        />
      )}

      {panelMode === 'intervention' && (
        <WheelInterventionPanel
          isOpen={panelMode === 'intervention'}
          intervention={activeIntervention}
          selectedInterventions={selectedInterventions}
          onInterventionToggle={handleInterventionToggle}
          onClose={handleClosePanel}
          triggeringComponents={activeIntervention ? getTriggering(activeIntervention) : []}
        />
      )}
    </div>
  )
}
