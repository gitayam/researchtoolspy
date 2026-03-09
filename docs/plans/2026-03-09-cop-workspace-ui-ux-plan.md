# COP Workspace UI/UX Redesign Plan

> **Goal:** Make the COP workspace more visible, consistent, and intuitive across desktop (1440px+) and mobile (375px).
>
> **Stack:** React 18 + Tailwind CSS v4 + shadcn/ui + Lucide icons + MapLibre GL
>
> **Design System:** Dark-first intelligence dashboard with Financial Dashboard palette

---

## Current State Analysis

### What Works Well
- Two-mode layout (Progress/Monitor) is a strong concept
- CopPanelExpander gives consistent collapsible behavior
- Keyboard shortcuts (Cmd+K, Cmd+M, Cmd+1/2) are power-user friendly
- Task board has full Kanban with status transitions
- Blocker strip alerts are effective

### Pain Points (Observed)
| Issue | Impact | Where |
|-------|--------|-------|
| **Vertical scroll fatigue** | HIGH | Progress mode has 8+ full-width panels stacked vertically — user loses context scrolling between panels |
| **Mobile panels too cramped** | HIGH | 2-col grids collapse to 1-col, but panels remain tall (480px) — lots of scrolling with little visible at once |
| **No persistent sidebar** | MEDIUM | All navigation is via scroll — no quick-jump between panels |
| **Map is buried** | MEDIUM | Map is at the bottom of Progress layout, behind a "Show Map Panel" click — should be more prominent for geospatial investigations |
| **Inconsistent panel heights** | LOW | collapsedHeight varies (200px–500px) with no visual rhythm |
| **No panel state persistence** | MEDIUM | Expanded/collapsed state resets on page reload |
| **Monitor mode too sparse** | MEDIUM | Only Evidence Feed + Map + Questions — no task board or entity counts |

---

## Design System

### Color Palette (Intelligence Dark)

```
Background:     #020617  (slate-950)     — OLED-friendly deep black
Surface:        #0F172A  (slate-900)     — Panel backgrounds
Surface-raised: #1E293B  (slate-800)     — Cards, hover states
Border:         #334155  (slate-700)     — Panel dividers
Text-primary:   #F8FAFC  (slate-50)      — High readability
Text-muted:     #94A3B8  (slate-400)     — Labels, timestamps
Accent-blue:    #3B82F6  (blue-500)      — Evidence, links, RFIs
Accent-emerald: #22C55E  (green-500)     — Confirmed, done, healthy
Accent-amber:   #F59E0B  (amber-500)     — Warnings, RFIs, in-progress
Accent-red:     #EF4444  (red-500)       — Blockers, critical
Accent-purple:  #8B5CF6  (violet-500)    — Entities, actors, relationships
```

### Light Mode Overrides
```
Background:     #FFFFFF
Surface:        #F8FAFC  (slate-50)
Surface-raised: #F1F5F9  (slate-100)
Border:         #E2E8F0  (slate-200)
Text-primary:   #0F172A  (slate-900)
Text-muted:     #64748B  (slate-500)
```

### Typography
- **Headings:** System font stack (Inter if loaded, otherwise system-ui)
- **Body/Data:** `font-mono` for tabular data (counts, timestamps, IDs)
- **Minimum body:** 14px desktop, 16px mobile (accessibility)
- **Panel titles:** 12px uppercase tracking-wider semibold (current pattern — keep)

### Spacing Scale
- **Panel gap:** `gap-3` (12px) desktop, `gap-2` (8px) mobile
- **Panel padding:** `px-3 py-2` compact panels, `px-4 py-3` main content
- **Consistent collapsed heights:** 200px (compact), 320px (standard), 480px (tall)

---

## Layout Architecture

### Desktop (1024px+): Two-Column Persistent Layout

Replace the current single-column vertical scroll with a **sticky left sidebar + scrollable main area**:

```
┌─────────────────────────────────────────────────────────────────┐
│ Header: [← Back] [Session Name] [Live ●] [Progress|Monitor] [⌘K] [Share] [Invite] │
├─────────────────────────────────────────────────────────────────┤
│ Status Strip: [Mission Brief...] [Evidence:10] [Entities:46] [RFIs:3] [Blockers:1] │
├─────────────────────────────────────────────────────────────────┤
│ Blocker Strip (if blockers exist)                               │
├──────────────┬──────────────────────────────────────────────────┤
│ LEFT SIDEBAR │ MAIN CONTENT (scrollable)                        │
│ (280px fixed)│                                                  │
│              │ ┌──────────────────────────────────────────────┐  │
│ [Capture Bar]│ │ Map (always visible, 400px)                  │  │
│              │ │ + Layer toggles overlay                      │  │
│ ── Nav ──── │ └──────────────────────────────────────────────┘  │
│ 📊 Entities │                                                  │
│ 👥 Actors   │ ┌───────────────┬──────────────────────────────┐  │
│ 🗺️ Map      │ │ Questions/RFI │ Analysis & Hypotheses        │  │
│ ❓ RFIs     │ │ (with gap     │ (with evidence links)        │  │
│ 🧠 Analysis │ │  analysis)    │                              │  │
│ 📋 Tasks    │ └───────────────┴──────────────────────────────┘  │
│ 📄 Evidence │                                                  │
│ 📈 Activity │ ┌──────────────────────────────────────────────┐  │
│              │ │ Task Board (Kanban columns)                  │  │
│ ── Stats ── │ └──────────────────────────────────────────────┘  │
│ Open: 3     │                                                  │
│ Blocked: 1  │ ┌──────────────────────────────────────────────┐  │
│ Done: 6     │ │ Evidence & Intel Feed                        │  │
│ Evidence: 10│ └──────────────────────────────────────────────┘  │
│              │                                                  │
│              │ ┌──────────────────────────────────────────────┐  │
│              │ │ Activity Log (compact)                       │  │
│              │ └──────────────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────────┘
```

**Key changes:**
1. **Sidebar nav** with panel jump-links (click "RFIs" → scroll to RFI panel)
2. **Sidebar stats** show live counts without needing to find the status strip
3. **Map always visible** at top of main content (not buried at bottom)
4. **Capture bar in sidebar** — always accessible without scrolling

### Desktop (1440px+): Three-Column Layout

On wide screens, split the main area into two columns:

```
┌──────────┬────────────────────┬───────────────────────┐
│ Sidebar  │ PRIMARY COLUMN     │ SECONDARY COLUMN      │
│ (240px)  │ (flex-1)           │ (400px)               │
│          │                    │                       │
│ Nav +    │ Map (350px)        │ Evidence Feed          │
│ Stats    │ Entity Graph       │ (always-on intake)     │
│          │ Questions/RFIs     │                       │
│          │ Analysis           │ Activity Log           │
│          │ Task Board         │                       │
│          │ Actors             │                       │
└──────────┴────────────────────┴───────────────────────┘
```

This keeps the Evidence Feed visible at all times while working on analysis panels.

### Tablet (768px–1023px): Collapsed Sidebar

- Sidebar collapses to icon-only rail (48px)
- Click icon to jump to panel
- Main content fills remaining width
- 2-col grid for Questions + Analysis row

### Mobile (375px–767px): Single Column + Bottom Nav

```
┌─────────────────────────────┐
│ Header (compact)            │
│ Status Strip (horizontal scroll) │
├─────────────────────────────┤
│                             │
│ [Active Panel Content]      │
│ (one panel at a time)       │
│                             │
│                             │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ Capture Bar (sticky)    │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ [🗺️] [📄] [❓] [📋] [👥] │ ← Bottom tab bar
└─────────────────────────────┘
```

**Key mobile changes:**
1. **Bottom tab bar** replaces vertical scroll — 5 tabs: Map, Evidence, RFIs, Tasks, Actors
2. **One panel at a time** — eliminates scroll fatigue
3. **Sticky capture bar** above bottom nav — always accessible
4. **Swipe between panels** — gesture-driven navigation
5. **Status strip** becomes horizontally scrollable pill row

---

## Panel Improvements

### 1. Unified Panel Chrome

All panels should share identical visual structure:

```tsx
// Consistent panel wrapper
<div className="rounded-lg border border-slate-200 dark:border-slate-700
     bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
  {/* Panel header — always visible */}
  <div className="flex items-center justify-between px-3 py-2
       border-b border-slate-100 dark:border-slate-800
       bg-slate-50/50 dark:bg-slate-800/50">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-{accent}" />
      <h3 className="text-xs font-semibold uppercase tracking-wider
           text-slate-700 dark:text-slate-300">
        {title}
      </h3>
      {badge && <Badge>{badge}</Badge>}
    </div>
    <div className="flex items-center gap-1">
      {/* Action buttons: Add, Filter, Expand */}
    </div>
  </div>
  {/* Panel content */}
  <div className="overflow-y-auto" style={{ maxHeight }}>
    {children}
  </div>
</div>
```

### 2. Panel Header Consistency Rules

| Element | Current | Proposed |
|---------|---------|----------|
| Title case | Mixed (some ALL CAPS, some Title) | ALL CAPS 12px tracking-wider |
| Icon position | Left of title | Left of title (keep) |
| Action button | Varies (some "New RFI", some "Propose") | Consistent `+` icon + tooltip |
| Badge | Different colors per panel | Accent color matching panel icon |
| Expand button | ChevronDown/Right | Unified maximize/minimize icon |

### 3. Map Panel Upgrades

**Current:** Optional, buried at bottom
**Proposed:** Always visible in desktop layout

- **Mini-map mode** (200px height) when collapsed — shows marker clusters only
- **Full map mode** (400px+) when expanded — shows layer controls, popups, pin placement
- **Floating layer toggles** — overlay on map instead of separate panel
- **Marker count badge** on map panel header

### 4. Evidence Feed Improvements

- **Split view:** URL analysis on left, results on right (desktop)
- **Thumbnail grid** option alongside feed view
- **Quick filters:** Pill buttons for evidence type (digital, observation, document)
- **Confidence indicators:** Color-coded left border on each evidence card

### 5. Task Board Enhancements

- **Column headers** with count badges: `TODO (4)` `IN PROGRESS (4)` `DONE (6)`
- **Drag-to-reorder** within columns (nice-to-have)
- **Quick-complete button** — single click to mark done without expanding

---

## Interaction Patterns

### Navigation

| Action | Desktop | Mobile |
|--------|---------|--------|
| Jump to panel | Sidebar click | Bottom tab bar |
| Collapse panel | Click panel header | Swipe down |
| Expand panel | Click panel header | Tap "expand" icon |
| Quick capture | Cmd+K or sidebar bar | Tap floating capture button |
| Toggle map | Cmd+M | Map tab in bottom nav |
| Switch mode | Cmd+1/2 or header toggle | Header toggle |

### Transitions

- Panel expand/collapse: `transition-all duration-200 ease-out`
- Mode switch: `transition-opacity duration-150`
- Sidebar hover: `transition-colors duration-150`
- Map zoom: MapLibre default easing
- Bottom tab switch: `transition-transform duration-200`

### Touch Targets (Mobile)

All interactive elements minimum **44x44px** touch target:
- Bottom tab icons: 48x48px
- Panel action buttons: 44x44px
- RFI/task list items: full-width tap area
- Map markers: 44px diameter minimum

---

## Responsive Breakpoints

| Breakpoint | Layout | Columns | Sidebar |
|------------|--------|---------|---------|
| `< 640px` (sm) | Single column, bottom tabs | 1 | Hidden (bottom nav) |
| `640–767px` | Single column, bottom tabs | 1 | Hidden (bottom nav) |
| `768–1023px` (md/lg) | Main + icon rail | 1-2 | Icon rail (48px) |
| `1024–1439px` (lg/xl) | Sidebar + main | 2 | Full sidebar (240px) |
| `1440px+` (2xl) | Sidebar + main + feed | 3 | Full sidebar (240px) |

---

## Implementation Phases

### Phase 1: Panel Consistency (Small — 1-2 sessions) ✅ DONE
- ✅ Unify all panel headers to shared visual pattern (CopPanelExpander)
- ✅ Standardize collapsed heights (200/320/480 via compact/standard/tall)
- ✅ Add `data-panel` attributes to all panels via `id` prop
- ✅ Persist panel expanded/collapsed state in localStorage

### Phase 2: Desktop Sidebar (Medium — 2-3 sessions)
- Add collapsible sidebar with panel jump-links
- Move capture bar to sidebar
- Add live stat counts in sidebar footer
- Sidebar collapses to icon rail on tablet

### Phase 3: Map Promotion (Small — 1 session) ✅ DONE
- ✅ Move map to top of main content area (Row 0.5, after Entities)
- ✅ Add mini-map collapsed mode (200px via `compact` height)
- Float layer toggles as overlay on map (deferred — layer panel shows on expand)
- ✅ Always show map in Progress mode (`showMap` defaults to `true`, removed "Show Map Panel" button)

### Phase 4: Mobile Bottom Navigation (Medium — 2-3 sessions)
- Add bottom tab bar for mobile viewports
- One-panel-at-a-time view with tab switching
- Sticky capture bar above bottom nav
- Swipe gesture support between panels

### Phase 5: Three-Column Wide Layout (Small — 1 session)
- On 1440px+, split main area into two columns
- Evidence Feed in persistent right column
- Activity Log below Evidence Feed

### Phase 6: Polish (Small — 1 session)
- Reduced motion support (`prefers-reduced-motion`)
- Panel state persistence (localStorage)
- Keyboard navigation through sidebar
- Focus management on panel switch
- ARIA landmarks for screen readers

---

## Accessibility Checklist

- [ ] All panels have `role="region"` with `aria-label`
- [ ] Sidebar nav uses `role="navigation"` with `aria-label="Panel navigation"`
- [ ] Bottom tabs use `role="tablist"` with `role="tab"` on each
- [ ] Focus visible on all interactive elements (2px ring)
- [ ] Color is never the only indicator (icons + labels always)
- [ ] Map has text alternative (marker list in panel)
- [ ] 4.5:1 contrast ratio on all text
- [ ] `prefers-reduced-motion` disables animations
- [ ] Touch targets 44px minimum on mobile

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Panels visible without scrolling (desktop) | 2-3 | 4-5 (with sidebar) |
| Taps to reach any panel (mobile) | 3-5 scrolls | 1 tap (bottom nav) |
| Map visibility | Hidden by default | Always visible |
| Panel state persistence | None | localStorage |
| Mode switching | 1 click | 1 click (keep) + keyboard |
| Capture bar accessibility | Scroll to top | Always visible (sidebar/sticky) |
