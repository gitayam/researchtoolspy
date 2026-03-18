/**
 * WheelSVG
 *
 * Renders the three-ring Behaviour Change Wheel as an interactive SVG.
 * - COM-B hub (6 segments, always visible)
 * - Intervention ring (9 segments, progressive reveal)
 * - Policy ring (7 segments, progressive reveal)
 *
 * Based on Michie, S., van Stralen, M. M., & West, R. (2011).
 */

import { useMemo } from 'react'
import type { ComBComponent, ComBDeficits, DeficitLevel, InterventionFunction, PolicyCategory } from '@/types/behavior-change-wheel'
import {
  generateArcPath,
  getLabelPosition,
  WHEEL_CENTER_X,
  WHEEL_CENTER_Y,
  RING_RADII,
  COMB_SEGMENTS,
  INTERVENTION_SEGMENTS,
  POLICY_SEGMENTS,
} from './wheel-geometry'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WheelSVGProps {
  deficits: ComBDeficits
  assessedComponents: Set<ComBComponent>
  activeComponent: ComBComponent | null
  activeInterventionIds: Set<InterventionFunction>
  selectedInterventions: InterventionFunction[]
  activePolicyIds: Set<PolicyCategory>
  onComBClick: (component: ComBComponent) => void
  onInterventionClick: (intervention: InterventionFunction) => void
  onPolicyClick: (policy: PolicyCategory) => void
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const DEFICIT_COLORS: Record<DeficitLevel, string> = {
  adequate: '#22c55e',
  deficit: '#f59e0b',
  major_barrier: '#ef4444',
}

const UNASSESSED_COLOR = '#334155'

function getComBSegmentFill(
  component: ComBComponent,
  deficits: ComBDeficits,
  assessed: Set<ComBComponent>,
): string {
  if (!assessed.has(component)) return UNASSESSED_COLOR
  return DEFICIT_COLORS[deficits[component]]
}

// ---------------------------------------------------------------------------
// Label wrapping
// ---------------------------------------------------------------------------

function splitLabel(label: string): string[] {
  if (label.length <= 12) return [label]
  const words = label.split(/[\s/]+/)
  if (words.length <= 1) return [label]
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WheelSVG({
  deficits,
  assessedComponents,
  activeComponent,
  activeInterventionIds,
  selectedInterventions,
  activePolicyIds,
  onComBClick,
  onInterventionClick,
  onPolicyClick,
}: WheelSVGProps) {
  const cx = WHEEL_CENTER_X
  const cy = WHEEL_CENTER_Y

  // Pre-compute arc paths for all segments
  const combPaths = useMemo(
    () =>
      COMB_SEGMENTS.map((seg) => ({
        ...seg,
        d: generateArcPath(cx, cy, RING_RADII.comb.inner, RING_RADII.comb.outer, seg.startAngle, seg.endAngle),
        labelPos: getLabelPosition(cx, cy, (RING_RADII.comb.inner + RING_RADII.comb.outer) / 2, (seg.startAngle + seg.endAngle) / 2),
      })),
    [cx, cy],
  )

  const interventionPaths = useMemo(
    () =>
      INTERVENTION_SEGMENTS.map((seg) => ({
        ...seg,
        d: generateArcPath(cx, cy, RING_RADII.intervention.inner, RING_RADII.intervention.outer, seg.startAngle, seg.endAngle),
        labelPos: getLabelPosition(cx, cy, (RING_RADII.intervention.inner + RING_RADII.intervention.outer) / 2, (seg.startAngle + seg.endAngle) / 2),
      })),
    [cx, cy],
  )

  const policyPaths = useMemo(
    () =>
      POLICY_SEGMENTS.map((seg) => ({
        ...seg,
        d: generateArcPath(cx, cy, RING_RADII.policy.inner, RING_RADII.policy.outer, seg.startAngle, seg.endAngle),
        labelPos: getLabelPosition(cx, cy, (RING_RADII.policy.inner + RING_RADII.policy.outer) / 2, (seg.startAngle + seg.endAngle) / 2),
      })),
    [cx, cy],
  )

  // Determine ring activation states
  const hasAnyDeficit = activeInterventionIds.size > 0
  const hasAnySelectedIntervention = selectedInterventions.length > 0

  // Check if all components are assessed and adequate (no interventions needed)
  const allAssessed = assessedComponents.size >= 6
  const allAdequate = allAssessed && Object.values(deficits).every((d) => d === 'adequate')

  return (
    <svg
      viewBox="0 0 500 500"
      className="h-full w-full"
      role="img"
      aria-label="Behaviour Change Wheel diagram"
    >
      {/* Policy Ring (outer) */}
      <g
        role="group"
        aria-label="Policy Categories"
        style={{
          opacity: hasAnySelectedIntervention ? 1 : 0.12,
          transition: 'opacity 0.6s ease',
        }}
      >
        {policyPaths.map((seg) => {
          const isActive = activePolicyIds.has(seg.id)
          const lines = splitLabel(seg.label)
          return (
            <g key={seg.id} className="cursor-pointer" onClick={() => onPolicyClick(seg.id)}>
              <path
                d={seg.d}
                fill={isActive ? seg.activeColor : seg.color}
                style={{
                  opacity: hasAnySelectedIntervention ? (isActive ? 1 : 0.3) : 1,
                  transition: 'opacity 0.4s ease, fill 0.3s ease',
                  filter: isActive ? 'drop-shadow(0 0 6px rgba(14,165,233,0.4))' : 'none',
                }}
                role="button"
                tabIndex={0}
                aria-label={`${seg.label} policy`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPolicyClick(seg.id) } }}
              >
                <title>{seg.label}</title>
              </path>
              {lines.map((line, i) => (
                <text
                  key={i}
                  x={seg.labelPos.x}
                  y={seg.labelPos.y + (i - (lines.length - 1) / 2) * 11}
                  textAnchor="middle"
                  fill="white"
                  fontSize="8"
                  fontWeight="600"
                  pointerEvents="none"
                  style={{ opacity: hasAnySelectedIntervention ? 1 : 0.5 }}
                >
                  {line}
                </text>
              ))}
            </g>
          )
        })}
      </g>

      {/* Intervention Ring (middle) */}
      <g
        role="group"
        aria-label="Intervention Functions"
        style={{
          opacity: hasAnyDeficit ? 1 : 0.12,
          transition: 'opacity 0.6s ease',
        }}
      >
        {interventionPaths.map((seg) => {
          const isRecommended = activeInterventionIds.has(seg.id)
          const isSelected = selectedInterventions.includes(seg.id)
          const lines = splitLabel(seg.label)
          return (
            <g key={seg.id} className="cursor-pointer" onClick={() => onInterventionClick(seg.id)}>
              <path
                d={seg.d}
                fill={isSelected ? '#818cf8' : isRecommended ? seg.activeColor : seg.color}
                style={{
                  opacity: hasAnyDeficit ? (isRecommended || isSelected ? 1 : 0.3) : 1,
                  transition: 'opacity 0.4s ease, fill 0.3s ease',
                  filter: isSelected
                    ? 'drop-shadow(0 0 10px rgba(99,102,241,0.5))'
                    : isRecommended
                      ? 'drop-shadow(0 0 6px rgba(99,102,241,0.3))'
                      : 'none',
                }}
                role="button"
                tabIndex={0}
                aria-label={`${seg.label} intervention${isSelected ? ' (selected)' : ''}`}
                aria-pressed={isSelected}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInterventionClick(seg.id) } }}
              >
                <title>{seg.label}</title>
              </path>
              {lines.map((line, i) => (
                <text
                  key={i}
                  x={seg.labelPos.x}
                  y={seg.labelPos.y + (i - (lines.length - 1) / 2) * 10}
                  textAnchor="middle"
                  fill="white"
                  fontSize="8"
                  fontWeight="600"
                  pointerEvents="none"
                  style={{ opacity: hasAnyDeficit ? 1 : 0.5 }}
                >
                  {line}
                </text>
              ))}
            </g>
          )
        })}
      </g>

      {/* COM-B Ring (inner hub) — always visible */}
      <g role="group" aria-label="COM-B Components">
        {combPaths.map((seg) => {
          const isActive = activeComponent === seg.id
          const fill = getComBSegmentFill(seg.id, deficits, assessedComponents)
          const lines = splitLabel(seg.label)
          return (
            <g key={seg.id} className="cursor-pointer" onClick={() => onComBClick(seg.id)}>
              <path
                d={seg.d}
                fill={fill}
                style={{
                  transition: 'fill 0.3s ease, filter 0.3s ease',
                  filter: isActive ? 'brightness(1.3)' : 'none',
                }}
                role="button"
                tabIndex={0}
                aria-label={`${seg.label}: ${assessedComponents.has(seg.id) ? deficits[seg.id].replace('_', ' ') : 'not assessed'}`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onComBClick(seg.id) } }}
              >
                <title>{seg.label}</title>
              </path>
              {lines.map((line, i) => (
                <text
                  key={i}
                  x={seg.labelPos.x}
                  y={seg.labelPos.y + (i - (lines.length - 1) / 2) * 10}
                  textAnchor="middle"
                  fill="white"
                  fontSize="9"
                  fontWeight="600"
                  pointerEvents="none"
                >
                  {line}
                </text>
              ))}
            </g>
          )
        })}
      </g>

      {/* Center hub */}
      <circle cx={cx} cy={cy} r={RING_RADII.center} fill="#1a1d27" stroke="#2d3348" strokeWidth="2" />
      {allAdequate ? (
        <>
          <text x={cx} y={cy - 8} textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="700">
            All Adequate
          </text>
          <text x={cx} y={cy + 6} textAnchor="middle" fill="#64748b" fontSize="8">
            No interventions
          </text>
          <text x={cx} y={cy + 18} textAnchor="middle" fill="#64748b" fontSize="8">
            required
          </text>
        </>
      ) : (
        <>
          <text x={cx} y={cy - 12} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700">
            COM-B
          </text>
          <text x={cx} y={cy + 2} textAnchor="middle" fill="#64748b" fontSize="8">
            Capability
          </text>
          <text x={cx} y={cy + 13} textAnchor="middle" fill="#64748b" fontSize="8">
            Opportunity
          </text>
          <text x={cx} y={cy + 24} textAnchor="middle" fill="#64748b" fontSize="8">
            Motivation
          </text>
        </>
      )}

      {/* Pulse animation style for active COM-B segment */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes pulse-segment {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.4); }
          }
        }
      `}</style>
    </svg>
  )
}
