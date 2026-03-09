# COP Workspace: High-Velocity OSINT Workflow Plan

## Objective

Transform the Common Operating Picture (COP) into a highly reactive, collaborative workspace tailored for fast-paced OSINT investigations (e.g., live geoguessing, tracking distributed persona farms).

**Primary UX goal:** Minimize context switching and maximize the speed at which a new investigator can jump in, understand the objective, and contribute actionable intelligence — all above the fold, within 60 seconds of joining.

**Design philosophy:** Dark-mode-first operational dashboard. Every interaction should feel like a military COP or Bloomberg terminal — dense, keyboard-navigable, zero wasted space.

---

## Phase 1: Global Quick Capture & Blocker Alerts

**Problem:** Users scroll past 3-4 panel rows to reach the Evidence Feed or RFI tab before they can contribute. New joiners have no idea what's blocking the team.

### 1A. Command-Palette Quick Capture (`Cmd/Ctrl + K`)

A global command palette (not a sticky bar — it overlays and disappears) that:

| Input detected | Action | Target |
|---|---|---|
| URL (http/https) | Submits to Evidence Feed | `POST /api/evidence` with `workspace_id` |
| `@handle` pattern | Creates Persona suggestion | Opens Persona linking flow |
| `?` prefix | Creates RFI | `POST /api/cop/:id/rfis` |
| `!` prefix | Creates Hypothesis | `POST /api/cop/:id/hypotheses` |
| Free text | Creates evidence note | `POST /api/evidence` as text note |

**UX details:**
- Triggered by `Cmd/Ctrl + K` or clicking a persistent "+" FAB (bottom-right, 48x48 touch target)
- Auto-focus on open, dismiss on `Escape` or outside click
- Show recent 3 submissions as ghost text for quick re-entry
- Animate in with 200ms `transform: translateY(-8px)` + opacity fade
- Skeleton loader while submitting, then toast confirmation (auto-dismiss 3s)

**Keyboard shortcuts (always active):**
| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Open Quick Capture |
| `Cmd/Ctrl + M` | Toggle map panel |
| `Cmd/Ctrl + 1/2` | Switch Progress/Monitor mode |
| `Escape` | Close any open modal/palette |

### 1B. Blocker Alert Strip

**Current state:** `CopStatusStrip` shows KPI badges + mission brief. Blockers are buried inside the RFI panel which requires expanding.

**Change:** Add a blocker alert row between `CopStatusStrip` and the panel grid. Only renders when blockers exist (no empty state).

**Implementation:**
- Add `is_blocker: INTEGER DEFAULT 0` column to `cop_rfis` table (not a new status — a flag orthogonal to the existing `open/answered/accepted/closed` lifecycle)
- `CopStatusStrip` queries blockers via existing stats endpoint (add `blocker_count` to `CopWorkspaceStats`)
- Render as a `bg-red-950/60 border border-red-500/30` banner with pulsing dot, truncated question text, and "Resolve" CTA
- Max 2 blockers shown inline; "+N more" overflow links to RFI panel
- `prefers-reduced-motion`: disable pulse, use static red dot

**Why `is_blocker` flag instead of new status:**
The RFI lifecycle (`open -> answered -> accepted -> closed`) is a progression. "Blocker" is an urgency dimension — an RFI can be `open + blocker` or `answered + blocker` (still blocking until accepted). A separate boolean keeps the state machine clean.

### Affected files

| File | Change | Effort |
|---|---|---|
| `src/components/cop/CopGlobalCapture.tsx` | **New** — Command palette overlay | M |
| `src/components/cop/CopBlockerStrip.tsx` | **New** — Blocker alert banner | S |
| `src/components/cop/CopStatusStrip.tsx` | Add blocker count to stats display | S |
| `src/pages/CopWorkspacePage.tsx` | Mount CopGlobalCapture + CopBlockerStrip, register keyboard shortcuts | S |
| `functions/api/cop/[id]/rfis.ts` | Add `is_blocker` to INSERT/UPDATE, return in GET | S |
| `functions/api/cop/[id]/stats.ts` | Add `blocker_count` to stats query | S |
| `schema/migrations/056-add-rfi-blocker-flag.sql` | `ALTER TABLE cop_rfis ADD COLUMN is_blocker INTEGER DEFAULT 0` | S |

---

## Phase 2: Persona & Actor Matrix

**Problem:** Investigators uncover multiple aliases/handles (e.g., @lanaraae, @rubiasophiee) across platforms but lack a centralized way to track the "Persona Farm" network — who links to whom, which accounts are active vs suspended, and which platform they're on.

### 2A. CopPersonaPanel

A new `CopPanelExpander` panel (follows existing render-prop pattern) placed in Row 1 alongside Entity Relationships:

**Data model — `cop_personas` table:**
```sql
CREATE TABLE cop_personas (
  id            TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL REFERENCES cop_sessions(id),
  display_name  TEXT NOT NULL,
  platform      TEXT NOT NULL,  -- 'twitter', 'telegram', 'reddit', 'onlyfans', 'instagram', 'tiktok', 'other'
  handle        TEXT,           -- @username without the @
  profile_url   TEXT,
  status        TEXT DEFAULT 'active',  -- 'active', 'suspended', 'deleted', 'unknown'
  linked_actor_id TEXT,         -- FK to actors table (nullable)
  notes         TEXT,
  created_by    INTEGER NOT NULL,
  workspace_id  TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE cop_persona_links (
  id            TEXT PRIMARY KEY,
  persona_a_id  TEXT NOT NULL REFERENCES cop_personas(id),
  persona_b_id  TEXT NOT NULL REFERENCES cop_personas(id),
  link_type     TEXT DEFAULT 'alias',  -- 'alias', 'operator', 'affiliated', 'unknown'
  confidence    INTEGER DEFAULT 50,    -- 0-100
  evidence_id   TEXT,                  -- FK to evidence proving the link
  created_by    INTEGER NOT NULL,
  created_at    TEXT DEFAULT (datetime('now'))
);
```

**Panel UI:**
- Compact card grid (not a table) — each card shows: platform icon (SVG from Simple Icons set), handle, status badge, link count
- Platform icons: use consistent 16x16 SVG icons, not emojis
- Status badges: `active` = green-500, `suspended` = amber-500, `deleted` = red-500, `unknown` = gray-500
- Click card to expand inline: shows notes, linked actor, evidence links
- "Link Personas" action: select 2+ cards, click "Link" to create a `cop_persona_links` edge
- `cursor-pointer` on all cards, `transition-colors duration-200` on hover

### 2B. Auto-Extraction Pipeline

When new evidence is submitted (URL or text) to the Evidence Feed:

1. Frontend regex scans for social handles: `/@[\w.]{1,30}/g` and platform-specific URL patterns (`twitter.com/`, `t.me/`, `reddit.com/u/`)
2. If matches found, show a non-blocking toast: "Detected @handle on Twitter. Link to persona?" with [Create New] / [Link Existing] / [Dismiss] actions
3. Toast auto-dismisses after 8s if no action (longer than standard 3s because it requires a decision)
4. On "Create New", pre-fill the persona form with extracted handle + platform

**No server-side regex** — keep extraction client-side to avoid false positives polluting the database. User confirms before anything is written.

### Affected files

| File | Change | Effort |
|---|---|---|
| `src/components/cop/CopPersonaPanel.tsx` | **New** — Persona card grid + link management | L |
| `src/components/cop/CopPersonaLinkDialog.tsx` | **New** — Dialog for linking personas | S |
| `src/components/cop/CopEvidenceFeed.tsx` | Add handle auto-extraction regex + toast prompt | M |
| `src/pages/CopWorkspacePage.tsx` | Mount CopPersonaPanel in ProgressLayout Row 1 | S |
| `functions/api/cop/[id]/personas.ts` | **New** — CRUD for personas + links | M |
| `schema/migrations/057-add-cop-personas.sql` | Create `cop_personas` + `cop_persona_links` tables | S |
| `src/types/cop.ts` | Add `CopPersona`, `CopPersonaLink` interfaces | S |

---

## Phase 3: Visual Artifacts & Clue Tracking

**Problem:** Critical visual clues (power outlets, window handles, bus logos) get buried in a generic chronological feed alongside URLs and text notes. In a geoguessing scenario, these visual artifacts are the primary evidence — they deserve first-class treatment.

### 3A. Artifact Tagging System

Extend the `evidence_items` table (or add a `cop_evidence_tags` junction table):

```sql
CREATE TABLE cop_evidence_tags (
  id            TEXT PRIMARY KEY,
  evidence_id   TEXT NOT NULL,
  tag_category  TEXT NOT NULL,  -- taxonomy category
  tag_value     TEXT NOT NULL,  -- specific tag
  confidence    INTEGER DEFAULT 100,  -- 0-100, allows LLM-suggested tags with lower confidence
  created_by    INTEGER NOT NULL,
  created_at    TEXT DEFAULT (datetime('now'))
);
```

**Predefined OSINT clue taxonomy:**

| Category | Tags |
|---|---|
| `architecture` | Building style, Window type, Roof type, Door style, Construction material |
| `infrastructure` | Power outlet type, Street light, Road marking, Traffic sign, Utility pole |
| `flora_fauna` | Tree species, Vegetation type, Crop type, Animal species |
| `logos_brands` | Vehicle brand, Store chain, Telecom provider, Bus company, Fuel station |
| `language_text` | Script type, Language detected, Sign text, License plate format |
| `geography` | Terrain type, Coastline, Mountain range, Water body, Soil color |
| `transport` | Vehicle type, Road surface, Rail type, Port infrastructure |
| `people_culture` | Clothing style, Religious symbol, Flag, Currency |

Tag selection UI: filterable dropdown grouped by category, with type-ahead search. Allow custom free-text tags that don't fit taxonomy.

### 3B. Gallery View Toggle

Add a view toggle to `CopEvidenceFeed` header:

- **Feed view** (default): Current chronological list
- **Gallery view**: CSS grid of image thumbnails (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2`)
  - Each thumbnail shows the image with overlaid tag pills (bottom-left, semi-transparent background)
  - Click opens a lightbox with full image, all tags, linked map pin, and linked personas
  - Only shows evidence items that have attached images or `visual_clue` tags
  - Empty state: "No visual evidence yet. Drop an image URL into Quick Capture."

**Lightbox UX:**
- `Escape` to close, arrow keys to navigate between artifacts
- Zoom with scroll wheel or pinch
- Side panel shows: tags, linked personas, linked map pin with mini-map preview
- "Pin to Map" action directly in lightbox (bridges to Phase 4)

### Affected files

| File | Change | Effort |
|---|---|---|
| `src/components/cop/CopEvidenceFeed.tsx` | Add gallery toggle, view mode state, gallery grid render | L |
| `src/components/cop/CopArtifactLightbox.tsx` | **New** — Full-screen image viewer with tag/map panel | M |
| `src/components/cop/CopTagSelector.tsx` | **New** — Taxonomy-aware tag picker with search | M |
| `functions/api/cop/[id]/evidence-tags.ts` | **New** — CRUD for evidence tags | S |
| `schema/migrations/058-add-evidence-tags.sql` | Create `cop_evidence_tags` table + taxonomy seed | S |
| `src/types/cop.ts` | Add `CopEvidenceTag`, `CLUE_TAXONOMY` constant | S |

---

## Phase 4: Direct Geospatial Linking

**Problem:** A user hypothesizes "Bariloche, Argentina" based on a bus logo. Currently: expand Map panel > click to drop pin > manually label it > go back and try to remember which evidence it relates to. This is 6+ clicks across 2 panels.

### 4A. 1-Click Pin to Map

Add a `MapPin` icon button to every evidence card and hypothesis card in the feed:

**Flow:**
1. User clicks MapPin icon on evidence/hypothesis card
2. If map panel is hidden, auto-show it with a slide-in animation
3. Map enters "pin placement" mode with a crosshair cursor
4. User clicks location on map (or types location in search box overlay)
5. Marker created with `source_type: 'EVIDENCE'` or `source_type: 'HYPOTHESIS'`, `source_id` linking back to the item

**Existing schema support:** The `cop_markers` table already has `source_type` (MANUAL/ENTITY/ACLED/GDELT/FRAMEWORK) and `source_id`. We just add two new source_type values: `'EVIDENCE'` and `'HYPOTHESIS'`.

**UX polish:**
- Toast confirmation: "Pinned to map at 41.1S, 71.3W" with [View on Map] action
- Evidence/hypothesis cards that have a linked pin show a small green MapPin indicator
- Clicking the indicator pans the map to that pin

### 4B. Auto-Geocoding Prompt

When the content intelligence pipeline (`/api/content-intelligence/analyze-url`) returns location data:

1. Check if `analysis.locations` array is non-empty
2. Show an inline prompt below the evidence card: "Location detected: **Bariloche, Argentina** (-41.1, -71.3). [Pin to Map] [Dismiss]"
3. "Pin to Map" creates the marker immediately using the geocoded coordinates (no manual click needed)
4. Prompt auto-dismisses after 30s or on any user action

**Geocoding source:** Leverage existing LLM analysis from `analyze-url` endpoint — no new geocoding API needed. The LLM already extracts location entities.

### 4C. Map Marker Backlinks

When viewing a marker on the map (click marker popup):
- Show linked evidence/hypothesis as a card preview in the popup
- Include tags and persona links if they exist
- "Open in Feed" action scrolls the Evidence Feed to that item

### Affected files

| File | Change | Effort |
|---|---|---|
| `src/components/cop/CopEvidenceFeed.tsx` | Add "Pin to Map" button + geocoding prompt on cards | M |
| `src/components/cop/CopHypothesisTab.tsx` | Add "Pin to Map" button on hypothesis cards | S |
| `src/components/cop/CopMap.tsx` | Add pin-placement mode, marker backlink popups | M |
| `src/pages/CopWorkspacePage.tsx` | Wire pin-placement state between feed and map | S |
| `functions/api/cop/[id]/markers.ts` | Add `EVIDENCE` and `HYPOTHESIS` to `source_type` enum | S |
| `src/types/cop.ts` | Extend `CopMarker.source_type` union | S |

---

## Cross-Cutting Concerns

### Accessibility
- All new panels meet WCAG 2.1 AA (4.5:1 contrast ratio on dark backgrounds)
- Every icon button has `aria-label` (no icon-only buttons without labels)
- Command palette is fully keyboard-navigable (arrow keys to select, Enter to submit)
- Gallery lightbox traps focus while open, restores on close
- `prefers-reduced-motion`: disable all slide/pulse animations, use instant transitions

### Performance
- Command palette: lazy-loaded (`React.lazy`) — not in initial bundle
- Gallery view: intersection observer for lazy-loading thumbnails
- Persona panel: virtualized list if >50 personas (unlikely but safe)
- All new API endpoints return within 100ms (simple D1 queries, no LLM calls)

### Responsive Breakpoints
| Breakpoint | Behavior |
|---|---|
| `< 640px` (mobile) | Command palette full-width, gallery 2-col, persona cards stack vertically |
| `640-1024px` (tablet) | Gallery 3-col, persona cards 2-col |
| `> 1024px` (desktop) | Full layout as designed |

### State Management
- No new global state library — continue using lifted state in `CopWorkspacePage` + prop drilling
- Pin-placement mode: boolean state in workspace page, passed to both feed and map
- Gallery/feed view toggle: local state in `CopEvidenceFeed`

---

## Implementation Priority & Dependencies

```
Phase 1A (Quick Capture)     ──────────────────── standalone
Phase 1B (Blocker Alerts)    ──────────────────── standalone
Phase 2A (Persona Panel)     ──────────────────── standalone
Phase 2B (Auto-Extract)      ──── depends on 2A
Phase 3A (Artifact Tags)     ──────────────────── standalone
Phase 3B (Gallery View)      ──── depends on 3A
Phase 4A (Pin to Map)        ──────────────────── standalone
Phase 4B (Auto-Geocode)      ──── depends on 4A
Phase 4C (Marker Backlinks)  ──── depends on 4A
```

**Recommended build order:** 1A > 1B > 4A > 2A > 3A > 2B > 3B > 4B > 4C

Rationale: Quick Capture has the highest UX impact per effort. Pin to Map unlocks the geo workflow early. Persona and artifact features are additive and can ship independently.

### Implementation Status (updated 2026-03-09)

| Phase | Status | Notes |
|-------|--------|-------|
| 1A Quick Capture | DONE | Sticky bar + Cmd+K, routes by input type |
| 1B Blocker Strip | DONE | Alert banner, "Go to Blocker" nav, auto-clear on answered |
| 2A Persona Panel | DONE | CRUD, card grid, platform icons, status badges |
| 2B Auto-Extract | PARTIAL | Regex exists, toast linking not fully wired |
| 3A Artifact Tags | DONE | Migration 063, evidence-tags API, CopTagSelector component |
| 3B Gallery View | DONE | Feed/gallery toggle, lightbox with navigation |
| 4A Pin to Map | DONE | 1-click from evidence/hypothesis, crosshair cursor |
| 4B Auto-Geocode | TODO | Wire analyze-url location data → inline prompt |
| 4C Marker Backlinks | TODO | Map popup → evidence/hypothesis card preview |

---

## Migration Plan

All migrations are additive (new columns with defaults, new tables). No destructive changes.

```
056-add-rfi-blocker-flag.sql      -- ALTER TABLE cop_rfis ADD COLUMN is_blocker INTEGER DEFAULT 0
057-add-cop-personas.sql           -- CREATE TABLE cop_personas, cop_persona_links
058-add-evidence-tags.sql          -- CREATE TABLE cop_evidence_tags + seed taxonomy
```

No changes to existing `cop_markers` schema — `source_type` is already TEXT and accepts any value.

---

## Success Criteria

| Metric | Target | How to verify |
|---|---|---|
| Time to first contribution | < 60s from page load | New user reads brief, sees blocker, drops URL via `Cmd+K` — no scrolling |
| Clicks to pin visual clue to map | < 3 clicks | Tag image in feed > click Pin > click map location |
| Persona farm tracking | All aliases in one panel | Create 5+ personas across 3 platforms, link as aliases, verify graph |
| Gallery discoverability | 1 click from feed | Toggle Gallery view, verify only image evidence shows |
| Keyboard-only workflow | Full task completion | Complete Quick Capture > RFI > Pin to Map using only keyboard |
| Mobile usability | All features accessible | Test on 375px viewport — no horizontal scroll, FAB reachable |
