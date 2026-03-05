# Common Operating Picture (COP) — Design Document

**Date**: 2026-03-05
**Status**: Approved
**Author**: Claude (brainstorming session with user)

## Problem Statement

ResearchToolsPy has 17 analytical frameworks, a comprehensive entity system (actors, events, places, behaviors, sources), intelligence synthesis, and deception detection — but no **geospatial visualization**. All entity data has coordinate fields but nothing renders on a map. Analysts can't see the spatial picture.

Meanwhile, real-world COP tools (Palantir, ArcGIS, ATAK) are either proprietary, expensive, or siloed. S2 Underground publishes CIP/COP products on ArcGIS but they're read-only community maps. WorldMonitor.app is the closest open-source equivalent but lacks the analytical framework integration this platform has.

**The opportunity**: Build purpose-built, spun-up-on-demand Common Operating Pictures that leverage all 17 frameworks, the entity system, intelligence synthesis, and deception detection — with ATAK/CoT export for field interoperability. Think Palantir but open source and more useful.

## References

- **S2 Underground CIP**: ArcGIS item `204a59b01f4443cd96718796fd102c00` — community crowdsourced intelligence map with Survey123 reports
- **WorldMonitor.app**: `github.com/koala73/worldmonitor` — 45+ layer global intelligence dashboard (MapLibre + deck.gl, ACLED, GDELT, ADS-B, AIS)
- **REDSIGHT** (`/Users/sac/Git/redOSR`): Our own multi-source intelligence fusion platform (Rust + PostGIS + MapLibre, 10+ adapters)
- **ATAK/CoT**: Cursor on Target XML protocol for interop with TAK ecosystem
- **FreeTAKServer**: Open-source TAK server (Python, Eclipse PL)
- **node-CoT**: TypeScript CoT ↔ GeoJSON library (`github.com/dfpc-coe/node-CoT`)

## Key Decisions

1. **Build in researchtoolspy** — leverages all 17 frameworks, entity system, workspace isolation
2. **Wizard-driven creation** with templates as starting points — 3-4 questions then AI generates config
3. **Internal entities + ACLED + GDELT** for V1 data feeds
4. **ATAK/CoT export** in V1 — killer differentiator
5. **MapLibre GL JS** for map rendering (MIT, WebGL, performant)

## Architecture

### COP Session Model

COP sessions are first-class entities following the `framework_sessions` pattern — workspace-isolated, lifecycle-managed, shareable.

```
User clicks "New COP"
    ↓
Wizard asks 3-4 questions
    ↓
AI generates COP config from template
    ↓
COP session created in D1
    ↓
Map renders with configured layers
    ↓
User customizes, adds markers, links frameworks
    ↓
Export to ATAK via CoT feed
```

### Templates

| Template | Purpose | Default Layers | Time Window | Typical Use |
|----------|---------|---------------|-------------|-------------|
| **Quick Brief** | Answer 1-3 questions about an area | Places, Events, Actors | 1h snapshot | "Who's active in this zone?" |
| **Event Monitor** | Track a developing situation | All entity + ACLED + GDELT | 48h rolling | Protests, natural disaster, conflict |
| **Area Study** | Deep analytical picture of a region | All entity + Analysis overlays | Static/unbounded | Country study, threat assessment |
| **Crisis Response** | Full operational picture | All layers + Tactical markers | Ongoing | Active incident management |
| **Custom** | User picks everything | User choice | User choice | Power users |

### Data Flow

```
                    ┌──────────────────────────┐
                    │    COP Session (D1)      │
                    │  bbox, time, layers,     │
                    │  frameworks, questions    │
                    └──────────┬───────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
    ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Entity APIs │  │ External APIs│  │ Analysis APIs│
    │ places      │  │ ACLED proxy  │  │ deception    │
    │ events      │  │ GDELT proxy  │  │ frameworks   │
    │ actors      │  │ (KV cached)  │  │ synthesis    │
    │ markers     │  └──────┬───────┘  └──────┬───────┘
    └──────┬──────┘         │                  │
           │                │                  │
           ▼                ▼                  ▼
    ┌─────────────────────────────────────────────┐
    │          GeoJSON FeatureCollections          │
    │  (all layers normalized to same format)     │
    └──────────────────┬──────────────────────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
    ┌─────────────┐    ┌──────────────┐
    │ MapLibre GL │    │ CoT Export   │
    │ (browser)   │    │ (XML feed)   │
    │ web COP     │    │ → ATAK/TAK   │
    └─────────────┘    └──────────────┘
```

## Schema

### cop_sessions

```sql
CREATE TABLE cop_sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    template_type TEXT NOT NULL,        -- 'quick_brief', 'event_monitor', 'area_study', 'crisis_response', 'custom'
    status TEXT DEFAULT 'ACTIVE',       -- DRAFT, ACTIVE, ARCHIVED

    -- Spatial bounds (area of interest)
    bbox_min_lat REAL,
    bbox_min_lon REAL,
    bbox_max_lat REAL,
    bbox_max_lon REAL,
    center_lat REAL,
    center_lon REAL,
    zoom_level INTEGER DEFAULT 6,

    -- Temporal bounds
    time_window_start TEXT,             -- ISO 8601
    time_window_end TEXT,               -- NULL = ongoing/rolling
    rolling_hours INTEGER,              -- e.g., 48 for "last 48h"

    -- Configuration (JSON)
    active_layers TEXT DEFAULT '[]',    -- layer IDs enabled
    layer_config TEXT DEFAULT '{}',     -- per-layer overrides (opacity, color, filters)
    linked_frameworks TEXT DEFAULT '[]',-- framework_session IDs
    key_questions TEXT DEFAULT '[]',    -- questions the COP should answer

    -- Ownership
    workspace_id TEXT DEFAULT '1',
    created_by INTEGER,
    is_public INTEGER DEFAULT 0,

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

### cop_markers

```sql
CREATE TABLE cop_markers (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL,
    uid TEXT NOT NULL,                  -- CoT UID (for ATAK export)
    cot_type TEXT DEFAULT 'a-u-G',     -- CoT type atom code
    callsign TEXT,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    hae REAL DEFAULT 0,

    -- Display
    label TEXT,
    description TEXT,
    icon TEXT,
    color TEXT,
    detail TEXT DEFAULT '{}',          -- CoT detail extension JSON

    -- Temporal
    event_time TEXT DEFAULT (datetime('now')),
    stale_time TEXT,

    -- Provenance
    source_type TEXT DEFAULT 'MANUAL', -- MANUAL, ENTITY, ACLED, GDELT, FRAMEWORK
    source_id TEXT,

    workspace_id TEXT DEFAULT '1',
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX idx_cop_markers_session ON cop_markers(cop_session_id);
CREATE INDEX idx_cop_markers_bbox ON cop_markers(lat, lon);
```

## Layer Catalog

### Layer Definition Type

```typescript
interface CopLayer {
  id: string
  name: string
  description: string
  category: 'entities' | 'external' | 'analysis' | 'tactical'
  icon: string                        // Lucide icon name

  source: {
    type: 'api' | 'geojson-url' | 'static'
    endpoint: string
    refreshSeconds?: number
    params?: Record<string, string>
  }

  render: {
    type: 'point' | 'cluster' | 'heatmap' | 'line' | 'polygon' | 'choropleth'
    color: string
    iconMapping?: Record<string, string>
    clusterRadius?: number
    minZoom?: number
    maxZoom?: number
  }

  defaultFor: string[]                // template types that include this layer
  filterable: boolean
  filterFields?: string[]
}
```

### V1 Layers (10 layers, 4 categories)

| Category | Layer ID | Source | Render | Refresh | Default Templates |
|----------|----------|--------|--------|---------|-------------------|
| Entities | `places` | D1 places | Clustered points by place_type | Manual | All |
| Entities | `events` | D1 events | Points colored by significance | Manual | All |
| Entities | `actors` | D1 actors + LOCATED_AT | Points by actor_type | Manual | All except quick_brief |
| Entities | `relationships` | D1 relationships | Lines between entities | Manual | area_study, crisis_response |
| External | `acled` | ACLED API (proxied, KV cached 1h) | Clustered by event_type | 1h | event_monitor, crisis_response |
| External | `gdelt` | GDELT GeoJSON (proxied, KV cached 15m) | Heatmap | 15min | event_monitor |
| Analysis | `deception-risk` | Intelligence synthesis API | Heatmap overlay | Manual | area_study |
| Analysis | `framework-overlay` | Linked framework data | Choropleth/pins | Manual | area_study |
| Tactical | `cop-markers` | cop_markers table | CoT-styled points | 30s | crisis_response |
| Tactical | `user-drawings` | Client-side (not persisted V1) | Lines, polygons, text | N/A | crisis_response |

### API Endpoints

All return GeoJSON `FeatureCollection`. All accept `?bbox=minLon,minLat,maxLon,maxLat`.

```
-- COP Session CRUD
POST   /api/cop/sessions              Create COP session
GET    /api/cop/sessions              List COP sessions for workspace
GET    /api/cop/sessions/:id          Get COP session
PUT    /api/cop/sessions/:id          Update COP session config
DELETE /api/cop/sessions/:id          Archive COP session

-- Layer Data (GeoJSON)
GET    /api/cop/:id/layers/places     Places in bbox
GET    /api/cop/:id/layers/events     Events in bbox + time window
GET    /api/cop/:id/layers/actors     Actors with coordinates in bbox
GET    /api/cop/:id/layers/relationships  Relationship lines
GET    /api/cop/:id/layers/markers    Tactical markers
GET    /api/cop/:id/layers/acled      ACLED events (proxied)
GET    /api/cop/:id/layers/gdelt      GDELT events (proxied)
GET    /api/cop/:id/layers/analysis   Framework/deception overlays

-- Tactical Markers CRUD
POST   /api/cop/:id/markers           Add marker
PUT    /api/cop/:id/markers/:markerId Update marker
DELETE /api/cop/:id/markers/:markerId Remove marker

-- CoT Export
GET    /api/cop/:id/cot               Full CoT XML feed for ATAK
GET    /api/cop/:id/cot/:layerId      CoT feed for specific layer

-- Wizard
POST   /api/cop/wizard                AI generates COP config from wizard answers
```

## UI Layout

### COP Page (`/dashboard/cop/:id`)

```
┌──────────────────────────────────────────────────────────────┐
│ ◀ Back │ COP: "Iran Event Monitor"  │ Share │ Export │ ATAK │
├────────┬─────────────────────────────────────────────────────┤
│ LAYERS │                                                     │
│        │                                                     │
│ ▼ Your │           M A P L I B R E   G L                    │
│  Data  │                                                     │
│ ☑Places│        [map fills remaining space]                  │
│ ☑Events│                                                     │
│ ☑Actors│           • entity pins                             │
│ ☐Rels  │           ─ relationship lines                      │
│        │           ◆ tactical markers                        │
│ ▼World │           ░ heatmap overlays                        │
│  Events│                                                     │
│ ☑ACLED │                                                     │
│ ☑GDELT │                                                     │
│        │                                                     │
│ ▼Anal- │                                                     │
│  ysis  │                                                     │
│ ☐Decep │                                                     │
│ ☐Frame │                                                     │
│        │                                                     │
│ ▼Tact- │  ┌──────────────────────────────────┐               │
│  ical  │  │ Key Questions          KPIs strip│               │
│ ☑Marks │  │ • Who's active here?   Actors: 12│               │
│ ☐Draw  │  │ • Deception risk?      Events: 47│               │
│        │  │ • Force posture?       Risk: MED  │               │
├────────┤  └──────────────────────────────────┘               │
│TIMELINE│                                                     │
│ ◀──●──▶│ [time scrubber for temporal filtering]              │
└────────┴─────────────────────────────────────────────────────┘
```

### COP List Page (`/dashboard/cop`)

Shows all COP sessions with:
- Status badges (ACTIVE, DRAFT, ARCHIVED)
- Template type icon
- Area of interest thumbnail (static map preview)
- Last updated time
- Quick actions (Open, Archive, Share, Export CoT)
- "New COP" button → wizard

### Wizard Flow

```
Step 1: Purpose
  ○ Monitor an event (→ event_monitor template)
  ○ Study an area (→ area_study template)
  ○ Answer specific questions (→ quick_brief template)
  ○ Crisis/incident response (→ crisis_response template)
  ○ Custom (→ custom template)

Step 2: Location
  [Search box: "Iran", "Donbas", coordinates...]
  [Or: Draw rectangle on mini-map]
  → Sets bbox + center + zoom

Step 3: Time Window
  (Varies by template)
  event_monitor: "How long to monitor?" [1h, 6h, 24h, 48h, 7d, ongoing]
  area_study: "Time range of interest?" [date picker or "all time"]
  quick_brief: Fixed at current snapshot
  crisis_response: "Ongoing" (default)

Step 4: Key Questions (optional)
  [Text input: "What groups are active here?"]
  [AI suggests additional questions based on area + template]
  [Can add multiple]

→ AI generates name, description, recommended layers, linked frameworks
→ User reviews and can modify before creating
```

## CoT/ATAK Export

### CoT XML Serializer

Maps COP entities to Cursor on Target XML:

| Entity Type | CoT Type | Mapping |
|-------------|----------|---------|
| Place (FACILITY) | `b-i-X-i` (infrastructure) | place.coordinates → point |
| Place (INSTALLATION) | `b-i-X-i` | place.coordinates → point |
| Place (CITY) | `a-n-G` (neutral ground) | place.coordinates → point |
| Event (OPERATION) | `b-r-f-h-c` (incident) | event.coordinates → point |
| Event (INCIDENT) | `b-r-f-h-c` | event.coordinates → point |
| Actor (PERSON) | `a-u-G-U` (unknown ground unit) | LOCATED_AT coords → point |
| Actor (ORGANIZATION) | `a-u-G-U-C` | LOCATED_AT coords → point |
| cop_marker | marker.cot_type | marker.lat/lon → point |
| ACLED event | `b-r-f-h-c` | acled lat/lon → point |

### CoT Feed Endpoint

```
GET /api/cop/:id/cot
Accept: application/xml
→ Returns CoT XML with all entities in COP bbox as <event> elements

GET /api/cop/:id/cot?format=datapackage
→ Returns .zip data package (CoT XML + icons) for ATAK import
```

ATAK users configure a TAK Server data feed pointing at the endpoint, or manually import the data package.

### Stale Time Logic

- Entity-sourced markers: stale = COP rolling_hours or 24h default
- ACLED events: stale = 1h after last refresh
- GDELT events: stale = 15min after last refresh
- Manual markers: stale = user-configured or 5min default

## Component Structure

```
src/pages/
  CopListPage.tsx              - COP session list
  CopPage.tsx                  - Active COP view

src/components/cop/
  CopWizard.tsx                - 4-step creation wizard
  CopMap.tsx                   - MapLibre GL wrapper
  CopLayerPanel.tsx            - Left sidebar layer toggles
  CopLayerCatalog.ts           - Layer registry (the 10 layer definitions)
  CopTimelineBar.tsx           - Bottom time scrubber
  CopKpiStrip.tsx              - Key questions + KPIs overlay
  CopMarkerEditor.tsx          - Add/edit tactical marker dialog
  CopExportMenu.tsx            - Export options (CoT, PDF, GeoJSON)
  CopSessionCard.tsx           - Session card for list page

src/types/
  cop.ts                       - CopSession, CopMarker, CopLayer types

functions/api/cop/
  sessions.ts                  - CRUD for cop_sessions
  sessions/[id].ts             - Single session operations
  [id]/layers/places.ts        - Places GeoJSON endpoint
  [id]/layers/events.ts        - Events GeoJSON endpoint
  [id]/layers/actors.ts        - Actors GeoJSON endpoint
  [id]/layers/relationships.ts - Relationships GeoJSON
  [id]/layers/markers.ts       - Tactical markers GeoJSON
  [id]/layers/acled.ts         - ACLED proxy + cache
  [id]/layers/gdelt.ts         - GDELT proxy + cache
  [id]/layers/analysis.ts      - Framework/deception overlay
  [id]/markers.ts              - Marker CRUD
  [id]/markers/[markerId].ts   - Single marker operations
  [id]/cot.ts                  - CoT XML export
  wizard.ts                    - AI wizard endpoint
  cot-serializer.ts            - CoT XML serialization utility

schema/migrations/
  057-add-cop-tables.sql       - cop_sessions + cop_markers tables
```

## Implementation Phases

### Phase 1: Foundation (~3 days)
- D1 migration for cop_sessions + cop_markers
- TypeScript types (cop.ts)
- COP session CRUD API
- Layer catalog definition
- MapLibre GL integration (npm install + basic CopMap component)

### Phase 2: Entity Layers (~2 days)
- GeoJSON endpoints for places, events, actors, relationships
- Layer panel with toggles
- Bbox filtering
- Clustering for point layers

### Phase 3: External Feeds (~2 days)
- ACLED API proxy with KV caching
- GDELT GeoJSON proxy with KV caching
- Layer refresh logic

### Phase 4: Wizard + Templates (~2 days)
- CopWizard component (4 steps)
- AI endpoint for config generation
- Template definitions
- COP list page

### Phase 5: Analysis Overlays (~1 day)
- Deception risk heatmap layer
- Framework data overlay
- KPI strip integration

### Phase 6: Tactical + CoT Export (~2 days)
- Marker CRUD (add/edit/delete on map)
- CoT XML serializer
- CoT feed endpoint
- Timeline bar

### Phase 7: Polish (~1 day)
- Export menu (CoT, GeoJSON, PDF)
- Session sharing (is_public + share links)
- Responsive layout
- Error handling + loading states

**Total estimated: ~13 days**

## Dependencies (npm)

```
maplibre-gl          - Map rendering (MIT, ~600KB)
@maplibre/maplibre-gl-geocoder - Search/geocoding (optional)
supercluster         - Point clustering
@turf/turf           - Geospatial calculations (bbox, distance)
```

## Future (V2+)

- Bridge to REDSIGHT for live ADS-B/AIS/RF feeds
- CoT import (receive from ATAK)
- MIL-STD-2525 symbology rendering
- Real-time collaboration (Durable Objects WebSocket)
- Temporal replay (animate COP state over time)
- Drawing tools (persistent polygons, annotations)
- Report generation from COP state
- Mobile-responsive COP view
- PMTiles self-hosted basemap (no external tile dependency)
