/**
 * Wheel Geometry Utilities
 *
 * Generates SVG arc paths and label positions for the Behaviour Change Wheel
 * concentric ring diagram. Three rings: COM-B (inner hub), Intervention (middle),
 * Policy (outer).
 *
 * SVG viewBox: 500x500, center at (250, 250).
 * Angles: 0 degrees = 12 o'clock (top), increasing clockwise.
 */

import type {
  ComBComponent,
  InterventionFunction,
  PolicyCategory,
} from '@/types/behavior-change-wheel'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WheelSegment<T> {
  id: T
  label: string
  startAngle: number
  endAngle: number
  color: string
  activeColor: string
}

export interface Point {
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WHEEL_CENTER_X = 250
export const WHEEL_CENTER_Y = 250

export const RING_RADII = {
  comb: { inner: 70, outer: 120 },
  intervention: { inner: 130, outer: 170 },
  policy: { inner: 180, outer: 230 },
  center: 68,
} as const

/** Visual gap between adjacent segments, in degrees (applied as half on each side). */
const SEGMENT_GAP_DEG = 1

// ---------------------------------------------------------------------------
// Angle helpers
// ---------------------------------------------------------------------------

/**
 * Convert degrees to radians. Our coordinate system places 0 degrees at the
 * top (12 o'clock) and increases clockwise. In standard math, 0 rad is at
 * 3 o'clock and increases counter-clockwise. To reconcile:
 *   mathAngle = 90 - wheelDegrees   (then convert to radians)
 * But since SVG's y-axis is inverted (down is positive), clockwise in screen
 * space corresponds to the standard math direction when we negate the y
 * component. The simplest mapping:
 *   screenX = cx + r * sin(deg)
 *   screenY = cy - r * cos(deg)
 */
function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Return the SVG point on a circle at the given wheel-angle (0=top, CW). */
function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
): Point {
  const rad = degToRad(angleDeg)
  return {
    x: cx + radius * Math.sin(rad),
    y: cy - radius * Math.cos(rad),
  }
}

// ---------------------------------------------------------------------------
// Arc path generation
// ---------------------------------------------------------------------------

/**
 * Generate an SVG `d` attribute for a donut (annular) segment.
 *
 * The path traces:
 *   1. Move to inner-start
 *   2. Line to outer-start
 *   3. Arc along outer edge to outer-end
 *   4. Line to inner-end
 *   5. Arc along inner edge back to inner-start (reverse direction)
 *   6. Close path
 *
 * @param cx          Centre x
 * @param cy          Centre y
 * @param innerRadius Inner ring radius
 * @param outerRadius Outer ring radius
 * @param startAngle  Start angle in degrees (0 = top, clockwise)
 * @param endAngle    End angle in degrees
 */
export function generateArcPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  // Apply the visual gap — shrink each side by half the gap
  const gapHalf = SEGMENT_GAP_DEG / 2
  const adjStart = startAngle + gapHalf
  const adjEnd = endAngle - gapHalf

  const outerStart = polarToCartesian(cx, cy, outerRadius, adjStart)
  const outerEnd = polarToCartesian(cx, cy, outerRadius, adjEnd)
  const innerEnd = polarToCartesian(cx, cy, innerRadius, adjEnd)
  const innerStart = polarToCartesian(cx, cy, innerRadius, adjStart)

  const sweep = adjEnd - adjStart
  const largeArc = sweep > 180 ? 1 : 0

  // Outer arc goes clockwise (sweep-flag = 1)
  // Inner arc goes counter-clockwise (sweep-flag = 0) to close the shape
  return [
    `M ${innerStart.x} ${innerStart.y}`,
    `L ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

// ---------------------------------------------------------------------------
// Label positioning
// ---------------------------------------------------------------------------

/**
 * Return the (x, y) position for a text label placed at a given radius and
 * angle on the wheel.
 *
 * Typically called with the midpoint angle of a segment and a radius halfway
 * between the ring's inner and outer edges.
 */
export function getLabelPosition(
  cx: number,
  cy: number,
  radius: number,
  angle: number,
): Point {
  return polarToCartesian(cx, cy, radius, angle)
}

// ---------------------------------------------------------------------------
// Segment definitions
// ---------------------------------------------------------------------------

function equalSegments<T extends string>(
  ids: readonly T[],
  labels: readonly string[],
  colors: readonly string[],
  activeColors: readonly string[],
): WheelSegment<T>[] {
  const count = ids.length
  const arc = 360 / count
  return ids.map((id, i) => ({
    id,
    label: labels[i],
    startAngle: i * arc,
    endAngle: (i + 1) * arc,
    color: colors[i % colors.length],
    activeColor: activeColors[i % activeColors.length],
  }))
}

// --- COM-B Ring (6 segments, 60 degrees each) ---

const COMB_IDS: readonly ComBComponent[] = [
  'physical_capability',
  'psychological_capability',
  'physical_opportunity',
  'social_opportunity',
  'reflective_motivation',
  'automatic_motivation',
] as const

const COMB_LABELS = [
  'Physical Capability',
  'Psychological Capability',
  'Physical Opportunity',
  'Social Opportunity',
  'Reflective Motivation',
  'Automatic Motivation',
] as const

const COMB_COLORS = [
  '#f97316', // orange
  '#f59e0b', // amber
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#a855f7', // purple
] as const

const COMB_ACTIVE_COLORS = [
  '#ea580c',
  '#d97706',
  '#0d9488',
  '#0891b2',
  '#4f46e5',
  '#9333ea',
] as const

export const COMB_SEGMENTS: WheelSegment<ComBComponent>[] = equalSegments(
  COMB_IDS,
  COMB_LABELS,
  COMB_COLORS,
  COMB_ACTIVE_COLORS,
)

// --- Intervention Ring (9 segments, 40 degrees each) ---

const INTERVENTION_IDS: readonly InterventionFunction[] = [
  'education',
  'persuasion',
  'incentivisation',
  'coercion',
  'training',
  'restriction',
  'environmental_restructuring',
  'modelling',
  'enablement',
] as const

const INTERVENTION_LABELS = [
  'Education',
  'Persuasion',
  'Incentivisation',
  'Coercion',
  'Training',
  'Restriction',
  'Environmental Restructuring',
  'Modelling',
  'Enablement',
] as const

const INTERVENTION_COLORS_CYCLE = [
  '#6366f1',
  '#7c3aed',
  '#8b5cf6',
] as const

const INTERVENTION_ACTIVE_COLORS_CYCLE = [
  '#4f46e5',
  '#6d28d9',
  '#7c3aed',
] as const

export const INTERVENTION_SEGMENTS: WheelSegment<InterventionFunction>[] =
  equalSegments(
    INTERVENTION_IDS,
    INTERVENTION_LABELS,
    [...INTERVENTION_COLORS_CYCLE, ...INTERVENTION_COLORS_CYCLE, ...INTERVENTION_COLORS_CYCLE],
    [...INTERVENTION_ACTIVE_COLORS_CYCLE, ...INTERVENTION_ACTIVE_COLORS_CYCLE, ...INTERVENTION_ACTIVE_COLORS_CYCLE],
  )

// --- Policy Ring (7 segments, ~51.43 degrees each) ---

const POLICY_IDS: readonly PolicyCategory[] = [
  'communication_marketing',
  'guidelines',
  'fiscal_measures',
  'regulation',
  'legislation',
  'environmental_social_planning',
  'service_provision',
] as const

const POLICY_LABELS = [
  'Comms/Marketing',
  'Guidelines',
  'Fiscal',
  'Regulation',
  'Legislation',
  'Env/Social Planning',
  'Service Provision',
] as const

const POLICY_COLORS_CYCLE = [
  '#0ea5e9',
  '#0891b2',
  '#06b6d4',
] as const

const POLICY_ACTIVE_COLORS_CYCLE = [
  '#0284c7',
  '#0e7490',
  '#0891b2',
] as const

export const POLICY_SEGMENTS: WheelSegment<PolicyCategory>[] = equalSegments(
  POLICY_IDS,
  POLICY_LABELS,
  [...POLICY_COLORS_CYCLE, ...POLICY_COLORS_CYCLE, ...POLICY_COLORS_CYCLE],
  [...POLICY_ACTIVE_COLORS_CYCLE, ...POLICY_ACTIVE_COLORS_CYCLE, ...POLICY_ACTIVE_COLORS_CYCLE],
)
