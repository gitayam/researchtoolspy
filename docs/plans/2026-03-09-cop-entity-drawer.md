# COP Entity Drawer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a unified slide-out drawer to the COP workspace providing inline CRUD for actors, events, places, sources, and behaviors with relationship linking, confidence display, and evidence linking — all using existing APIs.

**Architecture:** Right-side drawer component (~440px) with tabbed entity navigation. Each tab renders entity cards with inline expand, create form, and relationship management. No new backend endpoints — all operations use existing `/api/actors`, `/api/events`, `/api/places`, `/api/sources`, `/api/behaviors`, `/api/relationships` endpoints.

**Tech Stack:** React, Tailwind CSS (dark/light dual-mode), Lucide icons, existing shadcn components (Tabs, ScrollArea, Command, Dialog, Badge, Button, Select, Popover), existing entity types from `src/types/entities.ts`.

**Design doc:** `docs/plans/2026-03-09-cop-entity-drawer-design.md`

---

## Task 1: ConfidenceDots — Reusable Confidence Indicator

**Files:**
- Create: `src/components/cop/entities/ConfidenceDots.tsx`

**Step 1: Create the component**

```tsx
// src/components/cop/entities/ConfidenceDots.tsx
import { cn } from '@/lib/utils'

const CONFIDENCE_LEVELS = [
  { value: 'CONFIRMED', dots: 5, color: 'text-green-500', label: 'Confirmed' },
  { value: 'PROBABLE',  dots: 4, color: 'text-blue-500',  label: 'Probable' },
  { value: 'POSSIBLE',  dots: 3, color: 'text-amber-500', label: 'Possible' },
  { value: 'SUSPECTED', dots: 2, color: 'text-orange-500', label: 'Suspected' },
  { value: 'DOUBTFUL',  dots: 1, color: 'text-red-500',   label: 'Doubtful' },
] as const

export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number]['value']

interface ConfidenceDotsProps {
  level: string
  className?: string
  showLabel?: boolean
}

export default function ConfidenceDots({ level, className, showLabel = true }: ConfidenceDotsProps) {
  const config = CONFIDENCE_LEVELS.find(c => c.value === level) ?? CONFIDENCE_LEVELS[2]

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={cn(
              'inline-block w-1.5 h-1.5 rounded-full',
              i < config.dots ? config.color.replace('text-', 'bg-') : 'bg-gray-300 dark:bg-gray-600',
            )}
          />
        ))}
      </div>
      {showLabel && (
        <span className={cn('text-[10px] font-medium uppercase tracking-wider', config.color)}>
          {config.label}
        </span>
      )}
    </div>
  )
}

export { CONFIDENCE_LEVELS }
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -3`
Expected: `built in` with no errors

**Step 3: Commit**

```bash
git add src/components/cop/entities/ConfidenceDots.tsx
git commit -m "feat(cop): add ConfidenceDots reusable confidence indicator"
```

---

## Task 2: EntityCard — Generic Entity Card Component

**Files:**
- Create: `src/components/cop/entities/EntityCard.tsx`

**Context:** This card renders any entity type. It shows name, type badge, confidence, relationship count, evidence count. Click expands to show details. Each entity type has slightly different fields.

**Reference files:**
- `src/types/entities.ts` — Actor, Source, Event, Place, Behavior types
- `src/components/cop/CopPersonaPanel.tsx:1-42` — card pattern to follow

**Step 1: Create the component**

The card must handle 5 entity types. Use a union type and switch rendering for type-specific fields:

```tsx
// src/components/cop/entities/EntityCard.tsx
//
// Key structure:
// - Props: entity (union of Actor|Event|Place|Source|Behavior), entityType string,
//          onExpand, onPinToMap, onEdit, onLinkEvidence, relCount, evidenceCount
// - Collapsed: name + type badge + confidence dots + counts row + action buttons
// - Expanded: type-specific detail fields + relationships section + evidence section
//
// Type-specific rendering:
//   Actor:    aliases, category, role, affiliation, MOM summary
//   Event:    date_start/end, significance badge, location name
//   Place:    coordinates, country/region, strategic_importance, controlled_by
//   Source:   source_type, reliability letter grade, MOSES summary
//   Behavior: frequency, sophistication, effectiveness, observation window
//
// Dark/light mode: follow established pattern
//   Card: bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700
//   Text: text-gray-900 dark:text-gray-200 (primary), text-gray-600 dark:text-gray-400 (secondary)
//   Hover: hover:bg-gray-100 dark:hover:bg-gray-800/50 cursor-pointer transition-colors duration-200
//
// Action buttons (shown on card, not just expanded):
//   MapPin — pin entity to map (places: direct, others: via LOCATED_AT)
//   Link2 — open relationship creator
//   FileText — link evidence
//   Edit2 — edit entity (opens inline form)
//
// Use Lucide icons: User, Building2, Shield, Globe, MapPin, Calendar, Radio,
//   Eye, Zap, Link2, FileText, Edit2, ChevronDown, ChevronRight
// Use Badge from @/components/ui/badge
// Use ConfidenceDots from ./ConfidenceDots
```

Full implementation: ~200 lines. Read `CopPersonaPanel.tsx` for card pattern, then adapt for all 5 types.

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -3`

**Step 3: Commit**

```bash
git add src/components/cop/entities/EntityCard.tsx
git commit -m "feat(cop): add EntityCard with type-specific rendering for all 5 entity types"
```

---

## Task 3: EntityCreateForm — Polymorphic Entity Creation Form

**Files:**
- Create: `src/components/cop/entities/EntityCreateForm.tsx`

**Context:** A single form component that renders different fields based on entity type. Uses existing shadcn components (Input, Select, Textarea, Button).

**Reference files:**
- `src/components/cop/CopPersonaPanel.tsx:100-180` — inline form pattern
- `src/types/entities.ts` — ActorType, SourceType, EventType, PlaceType, BehaviorType enums

**Step 1: Create the component**

```tsx
// src/components/cop/entities/EntityCreateForm.tsx
//
// Props:
//   entityType: 'actors' | 'events' | 'places' | 'sources' | 'behaviors'
//   sessionId: string (COP session ID, used as workspace_id)
//   onCreated: (entity: any) => void
//   onCancel: () => void
//   prefill?: Partial<any> — for pre-filling from Quick Capture or Persona promotion
//
// Shared fields (all types): name, description
//
// Type-specific fields:
//   actors:    type (PERSON/ORGANIZATION/UNIT/GROUP/OTHER), category, role, affiliation, aliases
//   events:    event_type, date_start, date_end, significance, confidence, location_id (Place selector)
//   places:    place_type, coordinates.lat, coordinates.lng, country, region, strategic_importance
//   sources:   type (HUMINT/SIGINT/OSINT/etc.), source_type, controlled_by (Actor selector)
//   behaviors: behavior_type, frequency, sophistication, indicators (comma-sep)
//
// Confidence selector: dropdown with CONFIRMED/PROBABLE/POSSIBLE/SUSPECTED/DOUBTFUL (events only)
// Significance selector: CRITICAL/HIGH/MEDIUM/LOW (events + places.strategic_importance)
//
// Submit: POST to /api/{entityType} with workspace_id = sessionId
// Headers: getHeaders() pattern from CopPersonaPanel
//
// Dark/light: inputs use bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700
//             pattern established in dark/light mode review
```

Full implementation: ~300 lines. A `switch` on `entityType` renders different field sets.

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -3`

**Step 3: Commit**

```bash
git add src/components/cop/entities/EntityCreateForm.tsx
git commit -m "feat(cop): add EntityCreateForm with polymorphic fields per entity type"
```

---

## Task 4: EntityRelationships — Relationship List + Inline Creator

**Files:**
- Create: `src/components/cop/entities/EntityRelationships.tsx`

**Context:** Shows relationships for an entity and allows creating new ones inline.

**Reference files:**
- `src/types/entities.ts:280-330` — Relationship type, RelationshipType enum
- `functions/api/relationships.ts` — API pattern for CRUD

**Step 1: Create the component**

```tsx
// src/components/cop/entities/EntityRelationships.tsx
//
// Props:
//   entityId: string
//   entityType: string
//   sessionId: string (workspace_id)
//   onRelationshipCreated?: () => void
//
// Data fetch: GET /api/relationships?entity_id={entityId}&workspace_id={sessionId}
//
// Display: List of relationship cards, each showing:
//   - Direction arrow (→ outgoing, ← incoming)
//   - Relationship type badge (CONTROLS, REPORTS_TO, ALLIED_WITH, etc.)
//   - Target entity name
//   - Confidence dots
//
// Inline create form (toggle with "+ Add Relationship"):
//   Target entity: EntitySearch component (cross-type search)
//   Relationship type: Select dropdown
//   Confidence: Select dropdown (CONFIRMED/PROBABLE/POSSIBLE/SUSPECTED)
//   Direction: Toggle (outgoing/incoming)
//
// Submit: POST /api/relationships with:
//   source_entity_id, source_entity_type, target_entity_id, target_entity_type,
//   relationship_type, confidence, workspace_id
//
// Relationship type filtering:
//   If target is Place → show LOCATED_AT
//   If target is Actor → show CONTROLS, REPORTS_TO, ALLIED_WITH, ADVERSARY_OF, MEMBER_OF
//   If target is Event → show PARTICIPATED_IN
//   etc. (filter based on source/target types)
```

Full implementation: ~250 lines.

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -3`

**Step 3: Commit**

```bash
git add src/components/cop/entities/EntityRelationships.tsx
git commit -m "feat(cop): add EntityRelationships with inline relationship creator"
```

---

## Task 5: EntityEvidenceLinks — Evidence Linking Panel

**Files:**
- Create: `src/components/cop/entities/EntityEvidenceLinks.tsx`

**Context:** Shows evidence linked to an entity and allows linking existing evidence.

**Reference files:**
- `src/components/evidence/EvidenceSelector.tsx` — existing evidence selector pattern
- `functions/api/evidence.ts` — evidence API

**Step 1: Create the component**

```tsx
// src/components/cop/entities/EntityEvidenceLinks.tsx
//
// Props:
//   entityId: string
//   entityType: string
//   sessionId: string
//
// Data: Fetch relationships where target_entity_id = entityId AND relationship_type IN
//       ('CORROBORATES', 'CONTRADICTS', 'PROVIDED_BY')
//       OR use junction tables (evidence_actors, event_evidence, source_evidence)
//
// Simpler approach: use /api/relationships?entity_id={entityId}&workspace_id={sessionId}
//   and filter for evidence-type relationships
//
// Display: List of evidence items with:
//   - Title (truncated)
//   - Type badge (observation, document, statement, etc.)
//   - Confidence badge (HIGH=green, MEDIUM=amber, LOW=red, CONFIRMED=blue)
//   - Relationship type (CORROBORATES vs CONTRADICTS)
//
// Link action: Select from existing evidence in workspace
//   GET /api/evidence?workspace_id={sessionId}
//   Then POST /api/relationships to create the link
```

Full implementation: ~180 lines.

**Step 2: Verify build and commit**

```bash
git add src/components/cop/entities/EntityEvidenceLinks.tsx
git commit -m "feat(cop): add EntityEvidenceLinks for evidence-entity linking"
```

---

## Task 6: EntitySearch — Cross-Type Entity Search

**Files:**
- Create: `src/components/cop/entities/EntitySearch.tsx`

**Context:** A search component that searches across all entity types simultaneously for the relationship target selector.

**Reference files:**
- `src/components/shared/EntitySelector.tsx` — existing entity selector pattern
- `src/components/ui/command.tsx` — shadcn Command component (cmdk)

**Step 1: Create the component**

```tsx
// src/components/cop/entities/EntitySearch.tsx
//
// Uses shadcn Command (cmdk) for search-as-you-type
//
// Props:
//   sessionId: string
//   onSelect: (entityId: string, entityType: string, entityName: string) => void
//   excludeId?: string — exclude current entity from results
//   filterTypes?: string[] — optionally filter to specific entity types
//   placeholder?: string
//
// On search input change (debounced 300ms):
//   Parallel fetch to 5 endpoints:
//     GET /api/actors?workspace_id={sessionId}&search={query}&limit=5
//     GET /api/events?workspace_id={sessionId}&search={query}&limit=5
//     GET /api/places?workspace_id={sessionId}&search={query}&limit=5
//     GET /api/sources?workspace_id={sessionId}&search={query}&limit=5
//     GET /api/behaviors?workspace_id={sessionId}&search={query}&limit=5
//
// Results grouped by type with CommandGroup:
//   Actors (3 results)
//     > Gen. Surovikin — PERSON · Military
//     > Wagner Group — ORGANIZATION
//   Places (2 results)
//     > Rostov-on-Don — CITY · Russia
//
// Use existing Command/CommandInput/CommandList/CommandGroup/CommandItem
// from src/components/ui/command.tsx
```

Full implementation: ~150 lines.

**Step 2: Verify build and commit**

```bash
git add src/components/cop/entities/EntitySearch.tsx
git commit -m "feat(cop): add EntitySearch cross-type search component"
```

---

## Task 7: CopEntityDrawer — Main Drawer Shell

**Files:**
- Create: `src/components/cop/CopEntityDrawer.tsx`

**Context:** The main drawer component that orchestrates tabs, search, entity lists, and forms.

**Reference files:**
- `src/components/ui/scroll-area.tsx` — for scrollable content
- `src/components/ui/tabs.tsx` — for entity type tabs
- `src/components/cop/CopGlobalCapture.tsx` — overlay/modal pattern

**Step 1: Create the component**

```tsx
// src/components/cop/CopEntityDrawer.tsx
//
// Props:
//   sessionId: string
//   open: boolean
//   onOpenChange: (open: boolean) => void
//   initialTab?: 'actors' | 'events' | 'places' | 'sources' | 'behaviors'
//   prefill?: { entityType: string; data: Partial<any> }
//   onPinToMap?: (lat: number, lon: number, label: string) => void
//
// Layout:
//   Fixed right panel: w-[440px] h-full, slide-in from right (translate-x animation)
//   Backdrop: bg-black/20 (lighter than command palette — workspace stays visible)
//
// Structure:
//   Header: "Entity Drawer" title + close button + search input
//   Tab bar: [Actors N] [Events N] [Places N] [Sources N] [Behaviors N]
//     - Each tab shows count fetched from respective API
//     - Active tab: bg-gray-200 dark:bg-gray-700
//   Content (ScrollArea):
//     - Entity cards list (EntityCard components)
//     - [+ Add {Type}] button at bottom
//     - Inline create form (EntityCreateForm, shown when adding)
//
// Data fetching:
//   On mount + tab change, fetch entities for active tab:
//     GET /api/{activeTab}?workspace_id={sessionId}
//   Cache results per tab to avoid re-fetching on tab switch
//
// Keyboard:
//   Escape → close drawer
//   Tab → navigate between cards
//
// Transitions:
//   Slide in: transform translateX(100%) → translateX(0), 200ms ease-out
//   Backdrop: opacity 0 → 0.2, 200ms
//
// Dark/light mode:
//   Panel: bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700
//   Shadow: shadow-2xl
```

Full implementation: ~350 lines.

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -3`

**Step 3: Commit**

```bash
git add src/components/cop/CopEntityDrawer.tsx
git commit -m "feat(cop): add CopEntityDrawer shell with tabs, search, and entity list"
```

---

## Task 8: Wire Drawer into CopWorkspacePage

**Files:**
- Modify: `src/pages/CopWorkspacePage.tsx`

**Context:** Mount the drawer, add keyboard shortcut, wire trigger points.

**Step 1: Add state and imports**

In `CopWorkspacePage.tsx`, add:

```tsx
// Imports
import CopEntityDrawer from '@/components/cop/CopEntityDrawer'

// State (in CopWorkspacePage component body)
const [entityDrawerOpen, setEntityDrawerOpen] = useState(false)
const [entityDrawerTab, setEntityDrawerTab] = useState<string | undefined>()
const [entityDrawerPrefill, setEntityDrawerPrefill] = useState<any>(undefined)
```

**Step 2: Add Cmd+E keyboard shortcut**

In the existing keyboard shortcut useEffect, add:

```tsx
// Cmd/Ctrl + E → open entity drawer
if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
  e.preventDefault()
  setEntityDrawerOpen(prev => !prev)
}
```

**Step 3: Add "Entities" button to header action bar**

After the existing Share/CoT buttons:

```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => setEntityDrawerOpen(true)}
  title="Entity Drawer (Cmd+E)"
>
  <Database className="h-4 w-4" />
</Button>
```

**Step 4: Mount CopEntityDrawer**

After the CopGlobalCapture component:

```tsx
<CopEntityDrawer
  sessionId={id!}
  open={entityDrawerOpen}
  onOpenChange={setEntityDrawerOpen}
  initialTab={entityDrawerTab}
  prefill={entityDrawerPrefill}
  onPinToMap={(lat, lon, label) => {
    // Reuse existing pin placement logic
    setShowMap(true)
    // Create marker directly for places
    handleCreateMarker(lat, lon, label, 'ENTITY')
  }}
/>
```

**Step 5: Verify build and commit**

```bash
git add src/pages/CopWorkspacePage.tsx
git commit -m "feat(cop): wire CopEntityDrawer with Cmd+E shortcut and header button"
```

---

## Task 9: Wire Quick Capture Entity Prefixes

**Files:**
- Modify: `src/components/cop/CopGlobalCapture.tsx`

**Context:** Add `+actor`, `+event`, `+place`, `+source`, `+behavior` prefix detection.

**Step 1: Add entity prefix detection**

In the input type detection logic (the function that classifies URL vs RFI vs hypothesis), add:

```tsx
// Entity prefixes: +actor, +event, +place, +source, +behavior
const entityMatch = trimmed.match(/^\+(actor|event|place|source|behavior)\s+(.+)/i)
if (entityMatch) {
  return {
    type: 'entity',
    entityType: entityMatch[1].toLowerCase() + 's', // pluralize
    prefill: { name: entityMatch[2] },
  }
}
```

**Step 2: Add new prop and handler**

Add prop: `onOpenEntityDrawer?: (tab: string, prefill: any) => void`

When entity type detected and user submits, call `onOpenEntityDrawer` instead of posting to API.

**Step 3: Wire in CopWorkspacePage**

Pass the handler from workspace page:

```tsx
<CopGlobalCapture
  ...existing props...
  onOpenEntityDrawer={(tab, prefill) => {
    setEntityDrawerTab(tab)
    setEntityDrawerPrefill(prefill)
    setEntityDrawerOpen(true)
    setCaptureOpen(false) // close command palette
  }}
/>
```

**Step 4: Verify build and commit**

```bash
git add src/components/cop/CopGlobalCapture.tsx src/pages/CopWorkspacePage.tsx
git commit -m "feat(cop): add +entity prefix detection in Quick Capture"
```

---

## Task 10: Wire Evidence Feed "Link Entity" Button

**Files:**
- Modify: `src/components/cop/CopEvidenceFeed.tsx`

**Step 1: Add "Link Entity" button on evidence cards**

Next to the existing MapPin button, add:

```tsx
<button
  onClick={() => onLinkEntity?.(item)}
  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
  title="Link to entity"
  aria-label="Link evidence to entity"
>
  <Link2 className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
</button>
```

**Step 2: Add prop**

```tsx
onLinkEntity?: (item: FeedItem) => void
```

**Step 3: Wire in CopWorkspacePage**

```tsx
<CopEvidenceFeed
  ...existing props...
  onLinkEntity={(item) => {
    setEntityDrawerPrefill({ linkedEvidence: item })
    setEntityDrawerOpen(true)
  }}
/>
```

**Step 4: Verify build and commit**

```bash
git add src/components/cop/CopEvidenceFeed.tsx src/pages/CopWorkspacePage.tsx
git commit -m "feat(cop): add Link Entity button on evidence cards"
```

---

## Task 11: Wire Persona "Promote to Actor" Action

**Files:**
- Modify: `src/components/cop/CopPersonaPanel.tsx`

**Step 1: Add "Promote to Actor" button on persona cards**

In the expanded persona card section, add:

```tsx
{!persona.linked_actor_id && (
  <button
    onClick={() => onPromoteToActor?.(persona)}
    className="text-xs text-blue-500 hover:text-blue-400 cursor-pointer transition-colors"
  >
    Promote to Actor
  </button>
)}
{persona.linked_actor_id && (
  <Badge variant="outline" className="text-[10px] text-green-600 dark:text-green-400 border-green-300 dark:border-green-700">
    Linked to Actor
  </Badge>
)}
```

**Step 2: Add prop**

```tsx
onPromoteToActor?: (persona: CopPersona) => void
```

**Step 3: Wire in CopWorkspacePage**

```tsx
<CopPersonaPanel
  ...existing props...
  onPromoteToActor={(persona) => {
    setEntityDrawerTab('actors')
    setEntityDrawerPrefill({
      entityType: 'actors',
      data: {
        name: persona.display_name,
        type: 'PERSON',
        aliases: persona.handle ? [persona.handle] : [],
        description: persona.notes || '',
      },
      personaId: persona.id, // to update linked_actor_id after creation
    })
    setEntityDrawerOpen(true)
  }}
/>
```

**Step 4: Verify build and commit**

```bash
git add src/components/cop/CopPersonaPanel.tsx src/pages/CopWorkspacePage.tsx
git commit -m "feat(cop): add Promote to Actor action on persona cards"
```

---

## Task 12: Dark/Light Mode Pass + Final Build

**Files:**
- All new files in `src/components/cop/entities/`

**Step 1: Review all new components for dual-mode compliance**

Check every new file follows:
- Backgrounds: `bg-white dark:bg-gray-900`
- Cards: `bg-gray-50 dark:bg-gray-800/30`
- Borders: `border-gray-200 dark:border-gray-700`
- Text: `text-gray-900 dark:text-gray-200` / `text-gray-600 dark:text-gray-400`
- Inputs: `bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700`
- Hover: `hover:bg-gray-100 dark:hover:bg-gray-800/50`
- All clickable elements have `cursor-pointer`
- All icon buttons have `aria-label`
- Transitions: `transition-colors duration-200`

**Step 2: Final build verification**

Run: `npm run build 2>&1 | tail -5`
Expected: `built in` with no errors

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(cop): complete COP Entity Drawer with full entity CRUD, relationships, and evidence linking"
```

---

## Summary

| Task | Component | Lines (est.) | Dependencies |
|---|---|---|---|
| 1 | ConfidenceDots | 50 | — |
| 2 | EntityCard | 200 | Task 1 |
| 3 | EntityCreateForm | 300 | — |
| 4 | EntityRelationships | 250 | Task 6 |
| 5 | EntityEvidenceLinks | 180 | — |
| 6 | EntitySearch | 150 | — |
| 7 | CopEntityDrawer | 350 | Tasks 1-6 |
| 8 | Wire into Workspace | 50 | Task 7 |
| 9 | Quick Capture prefixes | 30 | Task 8 |
| 10 | Evidence Feed link button | 20 | Task 8 |
| 11 | Persona promote action | 30 | Task 8 |
| 12 | Dark/light pass + build | — | All |
| **Total** | | **~1,610** | |

**Build order:** Tasks 1, 3, 5, 6 can run in parallel (no deps). Then 2, 4 (need 1, 6). Then 7 (needs all sub-components). Then 8-11 (wiring). Then 12 (polish).
