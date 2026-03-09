# COP Entity Drawer — Design Document

## Objective

Add a unified slide-out drawer to the COP workspace that provides inline CRUD for all entity types (actors, events, places, sources, behaviors) with relationship linking and confidence levels. Leverages all existing APIs — no new backend endpoints needed.

## Architecture: Unified Entity Drawer (Approach A)

A single right-side drawer (~440px, full viewport height below header) that handles all 5 entity types through tabbed navigation. Overlays the workspace without disrupting the panel grid.

---

## Trigger Points

| Trigger | Context | Behavior |
|---|---|---|
| `Cmd/Ctrl + E` | Global keyboard shortcut | Opens drawer, focused on search |
| Quick Capture prefix `+actor`, `+event`, `+place`, `+source`, `+behavior` | Quick Capture palette | Opens drawer with entity type pre-selected, name pre-filled |
| "Link Entity" button on evidence cards | Evidence Feed | Opens drawer with evidence pre-linked |
| Right-click map marker → "Create Entity Here" | CopMap | Opens drawer with Places tab, coordinates pre-filled |
| "Promote to Actor" on persona card | CopPersonaPanel | Opens drawer with Actors tab, persona data pre-filled |
| "Entities" button in header toolbar | Header bar | Opens drawer showing all entities, badge shows total count |

---

## Drawer Layout

```
┌──────────────────────────────────────┐
│ [x close]  Entity Drawer    [+ Add] │
│ ┌──────────────────────────────────┐ │
│ │ Search entities...               │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [Actors 12] [Events 5] [Places 8]   │
│ [Sources 3] [Behaviors 2]           │
│ (tab pills with counts)             │
│                                      │
│ ┌── Entity Card ──────────────────┐  │
│ │ Gen. Sergei Surovikin           │  │
│ │ PERSON · Military               │  │
│ │ ●●●●○ PROBABLE                  │  │
│ │ 3 rels · 2 evidence             │  │
│ │ [Pin to Map] [Link] [Edit]      │  │
│ └─────────────────────────────────┘  │
│                                      │
│ ┌── Entity Card (expanded) ───────┐  │
│ │ Wagner Group                    │  │
│ │ ORGANIZATION · Military         │  │
│ │ ●●●●● CONFIRMED                │  │
│ │                                 │  │
│ │ Aliases: PMC Wagner, Prigozhin  │  │
│ │ Affiliation: Russian Federation │  │
│ │ Role: Private Military Company  │  │
│ │                                 │  │
│ │ ── Relationships (4) ────────── │  │
│ │ CONTROLS → Surovikin (PROBABLE) │  │
│ │ LOCATED_AT → Rostov (CONFIRMED) │  │
│ │ [+ Add Relationship]            │  │
│ │                                 │  │
│ │ ── Evidence (2) ────────────── │  │
│ │ "Wagner convoy spotted..." HIGH │  │
│ │ "Satellite imagery..." MEDIUM   │  │
│ │ [+ Link Evidence]              │  │
│ └─────────────────────────────────┘  │
│                                      │
│ ┌── Inline Create Form ───────────┐  │
│ │ Name: [_______________]         │  │
│ │ Type: [PERSON ▼]                │  │
│ │ Category: [Military ▼]          │  │
│ │ Affiliation: [___________]      │  │
│ │ Confidence: [●●●○○] POSSIBLE   │  │
│ │ Link evidence: [select ▼]       │  │
│ │ [Save] [Cancel]                 │  │
│ └─────────────────────────────────┘  │
└──────────────────────────────────────┘
```

---

## Entity Type Tabs

Each tab shows a filtered card list with type-specific fields:

### Actors Tab
- Card: name, type badge (PERSON/ORGANIZATION/UNIT/GROUP), category, affiliation, confidence
- Create form: name, type, category, role, affiliation, aliases (comma-separated), description
- Expanded: deception profile summary (MOM scores if assessed), relationships, linked evidence

### Events Tab
- Card: name, event_type badge, date_start, significance badge, confidence
- Create form: name, event_type, date_start, date_end, significance, description, location (select from Places)
- Expanded: linked actors (with roles), linked evidence, timeline position

### Places Tab
- Card: name, place_type badge, country, strategic_importance, coordinates preview
- Create form: name, place_type, coordinates (lat/lng or click-on-map), country, region, address, strategic_importance
- Special: "Pick from Map" button enters map click mode (reuses pin placement pattern from Phase 4)
- Expanded: controlled_by actor, events at location, linked evidence

### Sources Tab
- Card: name, source_type badge (HUMINT/SIGINT/OSINT/etc.), reliability letter grade
- Create form: name, source_type, description, controlled_by (actor select)
- Expanded: MOSES assessment summary (if assessed), linked evidence count

### Behaviors Tab
- Card: name, behavior_type badge, frequency, sophistication
- Create form: name, behavior_type, description, indicators (JSON array), frequency, sophistication
- Expanded: actors exhibiting behavior, effectiveness rating, observation window

---

## Confidence & Assessment Display

### Confidence Dots Pattern
Used consistently across all entity cards:

```
●●●●● CONFIRMED   (5/5, green-500)
●●●●○ PROBABLE    (4/5, blue-500)
●●●○○ POSSIBLE    (3/5, amber-500)
●●○○○ SUSPECTED   (2/5, orange-500)
●○○○○ DOUBTFUL    (1/5, red-500)
```

### Evidence Confidence on Linked Items
```
HIGH     — green badge
MEDIUM   — amber badge
LOW      — red badge
CONFIRMED — blue badge with checkmark
```

### Assessment Scores (read-only in drawer)
- MOM (actors): 3 bars showing motive/opportunity/means 0-5
- MOSES (sources): reliability letter + vulnerability score
- Link "View Full Assessment" navigates to dedicated assessment page

---

## Relationship Inline Creation

From any expanded entity card, "Add Relationship" opens an inline form:

```
Target entity: [search/select ▼]  (searches across all entity types)
Relationship:  [CONTROLS ▼]       (filtered to valid types for source→target)
Confidence:    [PROBABLE ▼]
Direction:     [→ outgoing]  [← incoming]
Evidence:      [optional link ▼]
[Save] [Cancel]
```

Valid relationship types are filtered based on source/target entity types (e.g., LOCATED_AT only valid when target is a Place).

---

## Promote Persona to Actor

When user clicks "Promote to Actor" on a CopPersonaPanel card:

1. Drawer opens with Actors tab, create form pre-filled:
   - `name` = persona `display_name`
   - `type` = PERSON
   - `aliases` = [persona `handle`]
   - `description` = persona `notes`
2. User can edit/enhance before saving
3. On save: creates Actor via `POST /api/actors`, then updates persona `linked_actor_id`
4. Persona card now shows "Linked to Actor" badge

---

## Data Flow

All operations use existing APIs. No new backend endpoints needed.

| Action | API | Method |
|---|---|---|
| List entities | `GET /api/{type}?workspace_id=:wsId` | GET |
| Search entities | `GET /api/{type}?search=:query&workspace_id=:wsId` | GET |
| Create entity | `POST /api/{type}` with workspace_id | POST |
| Update entity | `PUT /api/{type}/:id` | PUT |
| Delete entity | `DELETE /api/{type}/:id` | DELETE |
| List relationships | `GET /api/relationships?entity_id=:id&workspace_id=:wsId` | GET |
| Create relationship | `POST /api/relationships` | POST |
| Pin to map | `POST /api/cop/:sessionId/markers` | POST |
| Link persona to actor | `PUT /api/cop/:sessionId/personas` (update linked_actor_id) | POST |

The drawer passes `workspace_id` matching the COP session's workspace, so all entities are scoped to the current investigation.

---

## Scope Boundaries

### In Scope
- CRUD for all 5 entity types
- Inline relationship creation with confidence
- Evidence linking (select from existing evidence)
- Pin to map (places directly, others via LOCATED_AT)
- Promote persona to actor
- Search/filter within each tab
- Confidence dot display
- Assessment score summary (read-only)

### Out of Scope
- Full framework assessment creation (MOM/POP/MOSES/EVE) — link to dedicated pages
- Bulk entity import
- Relationship graph visualization (existing CopMiniGraph handles this)
- Entity merge/dedup
- Library publishing from drawer

---

## New Files

| File | Purpose |
|---|---|
| `src/components/cop/CopEntityDrawer.tsx` | Main drawer shell: tabs, search, entity list |
| `src/components/cop/entities/EntityCard.tsx` | Generic entity card with type-specific rendering |
| `src/components/cop/entities/EntityCreateForm.tsx` | Polymorphic create form (fields change per type) |
| `src/components/cop/entities/EntityRelationships.tsx` | Relationship list + inline add form |
| `src/components/cop/entities/EntityEvidenceLinks.tsx` | Evidence link list + link selector |
| `src/components/cop/entities/ConfidenceDots.tsx` | Reusable confidence level indicator |
| `src/components/cop/entities/EntitySearch.tsx` | Cross-type entity search for relationship targets |

## Modified Files

| File | Change |
|---|---|
| `src/pages/CopWorkspacePage.tsx` | Mount drawer, add Cmd+E shortcut, wire triggers |
| `src/components/cop/CopGlobalCapture.tsx` | Add `+actor`/`+event`/etc. prefix detection |
| `src/components/cop/CopEvidenceFeed.tsx` | Add "Link Entity" button on cards |
| `src/components/cop/CopPersonaPanel.tsx` | Add "Promote to Actor" action |
| `src/components/cop/CopMap.tsx` | Add right-click context menu → "Create Entity Here" |

---

## Success Criteria

| Metric | Target |
|---|---|
| Create entity from workspace | < 3 clicks from any trigger point |
| Link entity to evidence | < 2 clicks from evidence card |
| Create relationship between entities | < 4 clicks from expanded entity card |
| Promote persona to actor | 1 click + review + save |
| Pin place to map | 1 click from place card |
| Entity search | Results in < 500ms, supports partial name match |
