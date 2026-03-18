# Behaviour Change Wheel — Interactive SVG UI

**Date:** 2026-03-18
**Status:** Approved

## Summary

Replace the flat card-based COM-B assessment UI with an interactive concentric SVG wheel faithful to Prof. Susan Michie's Behaviour Change Wheel (BCW). Three rings: COM-B hub (6 segments), intervention functions (9 segments), policy categories (7 segments). Click-to-open side panel for data entry. Progressive reveal — outer rings start ghosted and "wake up" as deficits are identified.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Visual approach | Full wheel-driven UX (Option C) | Most faithful to Michie's methodology |
| Interaction model | Click-to-open side panel (Option B) | Rich data capture per segment, familiar panel UX |
| Ring reveal | Progressive reveal / soft (Option B) | Shows full structure upfront, segments wake up as deficits map to interventions |

## Component Architecture

```
BehaviourChangeWheel (main orchestrator)
├── WheelSVG (three-ring SVG, ~500x500 viewBox)
│   ├── ComBRing (6 segments, always active)
│   ├── InterventionRing (9 segments, progressive reveal)
│   └── PolicyRing (7 segments, progressive reveal)
├── AssessmentPanel (slide-out side panel, 420px)
│   ├── DeficitSelector (adequate/deficit/barrier)
│   ├── EvidenceNotes (textarea for evidence_notes)
│   ├── SupportingEvidence (textarea for supporting_evidence)
│   └── ProgressDots (1-of-6 COM-B indicator)
└── InterventionPanel (for intervention ring clicks)
    ├── InterventionDetail (evidence base, examples, considerations)
    └── SelectToggle (adds to selectedInterventions)
```

## Data Integration

- **Input/Output type:** `COMBAnalysis` from `src/types/comb-analysis.ts`
- **Deficit mapping:** `ComBDeficits` from `src/types/behavior-change-wheel.ts`
- **BCW logic:** All existing functions from `src/utils/behaviour-change-wheel.ts` (unchanged)
  - `generateInterventionRecommendations(deficits)` — maps deficits to intervention segments
  - `generatePolicyRecommendations(interventions)` — maps interventions to policy segments
  - `assessBehaviorChangeFeasibility(deficits)` — feasibility assessment
- **No backend changes required** — pure UI replacement

## Visual Specification

### Layout
- Full-width flex container: wheel area (flex: 1) + side panel (420px, slides in)
- Wheel area shrinks when panel opens (flex: 0.6)
- Wheel SVG: 500x500 viewBox, responsive via `width: min(520px, 60vw)`

### Color System
- **COM-B segments (unassessed):** `#334155` (slate-700)
- **Adequate:** `#22c55e` (green-500)
- **Deficit:** `#f59e0b` (amber-500)
- **Major Barrier:** `#ef4444` (red-500)
- **Intervention ring:** `#6366f1` / `#7c3aed` / `#8b5cf6` (indigo/violet alternating)
- **Policy ring:** `#0ea5e9` / `#0891b2` / `#06b6d4` (sky/cyan alternating)
- **Ghosted opacity:** 0.12, **Awakened:** 1.0 with drop-shadow glow
- **Center hub:** `#1a1d27` background, `#2d3348` border

### Animations
- Ring reveal: `opacity 0.6s ease` transition from ghosted to awakened
- Active segment: `pulse-ring` keyframe animation (brightness oscillation)
- Panel slide: `width 0.4s cubic-bezier(0.4, 0, 0.2, 1)`
- Segment hover: `brightness(1.2)` filter

### Side Panel
- Dark theme: `#1a1d27` background, `#2d3348` borders
- Deficit selector: three toggle buttons (green/amber/red)
- Evidence notes: dark textarea with indigo focus border
- Progress dots at bottom: green=done, indigo+glow=active, slate=pending
- Save & Continue button advances to next COM-B component

## Interaction Flow

1. **Initial state:** COM-B hub fully visible, intervention + policy rings ghosted (12% opacity)
2. **Click COM-B segment:** Side panel slides open with assessment form, segment pulses
3. **Set deficit level:** Segment color updates immediately on the wheel
4. **If deficit/barrier:** Relevant intervention segments begin glowing (wake up)
5. **Save & Continue:** Advances to next COM-B component, progress dot updates
6. **After all 6 assessed:** Subtitle updates, intervention ring fully interactive
7. **Click intervention segment:** Panel shows evidence base, examples, select toggle
8. **Select interventions:** Relevant policy segments wake up
9. **Click policy segment:** Panel shows policy details and examples

## Props Interface

```typescript
interface BehaviourChangeWheelProps {
  deficits: ComBDeficits
  assessments?: Record<ComBComponent, ComBComponentAssessment>
  selectedInterventions?: InterventionFunction[]
  onDeficitChange?: (component: ComBComponent, level: DeficitLevel) => void
  onAssessmentChange?: (component: ComBComponent, assessment: ComBComponentAssessment) => void
  onInterventionSelect?: (interventions: InterventionFunction[]) => void
  readOnly?: boolean
}
```

## Files to Create/Modify

### New files
1. `src/components/frameworks/BehaviourChangeWheel.tsx` — main orchestrator component
2. `src/components/frameworks/WheelSVG.tsx` — SVG ring rendering with segment geometry
3. `src/components/frameworks/WheelAssessmentPanel.tsx` — side panel for COM-B assessment
4. `src/components/frameworks/WheelInterventionPanel.tsx` — side panel for intervention details
5. `src/components/frameworks/wheel-geometry.ts` — arc path calculations for concentric rings

### Modified files
6. `src/components/frameworks/BCWRecommendations.tsx` — integrate wheel as primary visualization
7. Parent component that renders BCWRecommendations (wire up new props)

## Accessibility

- All segments have `role="button"` and `aria-label` with component name + current status
- Keyboard navigation: Tab through segments, Enter/Space to activate
- Side panel traps focus when open, Escape to close
- Color is not the only indicator — deficit badges show text labels (✓/⚠/✖)
- Legend always visible below wheel

## Mobile Considerations

- Below 768px: wheel renders at reduced size, panel becomes full-width overlay
- Touch targets: minimum 44px hit area per segment
- Pinch-to-zoom on the wheel SVG for detail work
