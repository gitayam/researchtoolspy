# Common Operating Picture (COP) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a wizard-driven Common Operating Picture system with MapLibre maps, 10 data layers (entities + ACLED + GDELT + analysis), and ATAK/CoT export.

**Architecture:** COP sessions stored in D1 following the framework_sessions pattern. MapLibre GL JS renders GeoJSON layers fetched from Cloudflare Pages Function endpoints. Layer catalog registry makes adding feeds trivial. CoT XML serializer enables ATAK interop.

**Tech Stack:** React 19, MapLibre GL JS, Cloudflare Pages Functions (Hono pattern), D1, KV caching, CoT XML

**Design Doc:** `docs/plans/2026-03-05-common-operating-picture-design.md`

---

## Phase 1: Foundation (DB + Types + Dependencies)

### Task 1: Add D1 Migration for COP Tables

**Files:**
- Create: `schema/migrations/057-add-cop-tables.sql`

**Step 1: Write the migration**

```sql
-- Migration: Add Common Operating Picture tables
-- Date: 2026-03-05
-- Description: Creates cop_sessions for COP instances and cop_markers for tactical markers (CoT-compatible)

CREATE TABLE IF NOT EXISTS cop_sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    template_type TEXT NOT NULL DEFAULT 'custom',
    status TEXT DEFAULT 'ACTIVE',

    bbox_min_lat REAL,
    bbox_min_lon REAL,
    bbox_max_lat REAL,
    bbox_max_lon REAL,
    center_lat REAL,
    center_lon REAL,
    zoom_level INTEGER DEFAULT 6,

    time_window_start TEXT,
    time_window_end TEXT,
    rolling_hours INTEGER,

    active_layers TEXT DEFAULT '[]',
    layer_config TEXT DEFAULT '{}',
    linked_frameworks TEXT DEFAULT '[]',
    key_questions TEXT DEFAULT '[]',

    workspace_id TEXT NOT NULL DEFAULT '1',
    created_by INTEGER NOT NULL,
    is_public INTEGER DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_sessions_workspace ON cop_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cop_sessions_status ON cop_sessions(status);

CREATE TABLE IF NOT EXISTS cop_markers (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL,
    uid TEXT NOT NULL,
    cot_type TEXT DEFAULT 'a-u-G',
    callsign TEXT,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    hae REAL DEFAULT 0,

    label TEXT,
    description TEXT,
    icon TEXT,
    color TEXT,
    detail TEXT DEFAULT '{}',

    event_time TEXT DEFAULT (datetime('now')),
    stale_time TEXT,

    source_type TEXT DEFAULT 'MANUAL',
    source_id TEXT,

    workspace_id TEXT NOT NULL DEFAULT '1',
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_markers_session ON cop_markers(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_markers_bbox ON cop_markers(lat, lon);
CREATE INDEX IF NOT EXISTS idx_cop_markers_time ON cop_markers(event_time);
```

**Step 2: Apply migration locally**

Run: `npx wrangler d1 execute researchtoolspy-db --local --file=schema/migrations/057-add-cop-tables.sql`
Expected: Success

**Step 3: Commit**

```bash
git add schema/migrations/057-add-cop-tables.sql
git commit -m "feat(cop): add D1 migration for cop_sessions and cop_markers tables"
```

---

### Task 2: Create TypeScript Types

**Files:**
- Create: `src/types/cop.ts`

**Step 1: Write the types**

```typescript
// Common Operating Picture types

export const CopTemplateType = {
  QUICK_BRIEF: 'quick_brief',
  EVENT_MONITOR: 'event_monitor',
  AREA_STUDY: 'area_study',
  CRISIS_RESPONSE: 'crisis_response',
  CUSTOM: 'custom',
} as const

export type CopTemplateType = typeof CopTemplateType[keyof typeof CopTemplateType]

export const CopStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const

export type CopStatus = typeof CopStatus[keyof typeof CopStatus]

export const CopLayerCategory = {
  ENTITIES: 'entities',
  EXTERNAL: 'external',
  ANALYSIS: 'analysis',
  TACTICAL: 'tactical',
} as const

export type CopLayerCategory = typeof CopLayerCategory[keyof typeof CopLayerCategory]

export interface CopSession {
  id: string
  name: string
  description: string | null
  template_type: CopTemplateType
  status: CopStatus

  // Spatial
  bbox_min_lat: number | null
  bbox_min_lon: number | null
  bbox_max_lat: number | null
  bbox_max_lon: number | null
  center_lat: number | null
  center_lon: number | null
  zoom_level: number

  // Temporal
  time_window_start: string | null
  time_window_end: string | null
  rolling_hours: number | null

  // Config
  active_layers: string[]
  layer_config: Record<string, LayerOverride>
  linked_frameworks: string[]
  key_questions: string[]

  // Ownership
  workspace_id: string
  created_by: number
  is_public: number

  created_at: string
  updated_at: string
}

export interface LayerOverride {
  opacity?: number
  color?: string
  visible?: boolean
  filters?: Record<string, string>
}

export interface CopMarker {
  id: string
  cop_session_id: string
  uid: string
  cot_type: string
  callsign: string | null
  lat: number
  lon: number
  hae: number

  label: string | null
  description: string | null
  icon: string | null
  color: string | null
  detail: Record<string, unknown>

  event_time: string
  stale_time: string | null

  source_type: 'MANUAL' | 'ENTITY' | 'ACLED' | 'GDELT' | 'FRAMEWORK'
  source_id: string | null

  workspace_id: string
  created_by: number
  created_at: string
}

// Layer catalog types
export interface CopLayerDef {
  id: string
  name: string
  description: string
  category: CopLayerCategory
  icon: string

  source: {
    type: 'api' | 'geojson-url' | 'static'
    endpoint: string
    refreshSeconds?: number
    params?: Record<string, string>
  }

  render: {
    type: 'point' | 'cluster' | 'heatmap' | 'line' | 'polygon'
    color: string
    iconMapping?: Record<string, string>
    clusterRadius?: number
    minZoom?: number
    maxZoom?: number
  }

  defaultFor: CopTemplateType[]
  filterable: boolean
  filterFields?: string[]
}

// GeoJSON types for layer responses
export interface CopGeoJsonFeature {
  type: 'Feature'
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon'
    coordinates: number[] | number[][] | number[][][]
  }
  properties: Record<string, unknown>
}

export interface CopFeatureCollection {
  type: 'FeatureCollection'
  features: CopGeoJsonFeature[]
}

// Wizard types
export interface CopWizardInput {
  purpose: CopTemplateType
  location: {
    search?: string
    bbox?: { minLat: number; minLon: number; maxLat: number; maxLon: number }
    center?: { lat: number; lon: number }
    zoom?: number
  }
  timeWindow: {
    type: 'snapshot' | 'rolling' | 'fixed' | 'ongoing'
    rollingHours?: number
    start?: string
    end?: string
  }
  questions: string[]
}

export interface CopWizardOutput {
  name: string
  description: string
  recommended_layers: string[]
  suggested_frameworks: string[]
  additional_questions: string[]
}
```

**Step 2: Commit**

```bash
git add src/types/cop.ts
git commit -m "feat(cop): add TypeScript types for COP sessions, markers, layers, and wizard"
```

---

### Task 3: Install MapLibre GL JS

**Files:**
- Modify: `package.json`

**Step 1: Install dependencies**

Run: `npm install maplibre-gl @turf/bbox @turf/helpers`
Expected: Success, packages added to package.json

**Step 2: Verify bundle impact**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds. MapLibre adds ~180KB gzipped.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(cop): add maplibre-gl and turf dependencies for COP map"
```

---

## Phase 2: COP Session CRUD API

### Task 4: Create COP Session API Endpoints

**Files:**
- Create: `functions/api/cop/sessions.ts`

**Step 1: Write the sessions endpoint**

```typescript
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `cop-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  try {
    const workspaceId = request.headers.get('X-Workspace-ID') || url.searchParams.get('workspace_id') || '1'
    const status = url.searchParams.get('status') || 'ACTIVE'

    const results = await env.DB.prepare(`
      SELECT * FROM cop_sessions
      WHERE workspace_id = ? AND status = ?
      ORDER BY updated_at DESC
    `).bind(workspaceId, status).all()

    const sessions = (results.results || []).map((row: any) => ({
      ...row,
      active_layers: JSON.parse(row.active_layers || '[]'),
      layer_config: JSON.parse(row.layer_config || '{}'),
      linked_frameworks: JSON.parse(row.linked_frameworks || '[]'),
      key_questions: JSON.parse(row.key_questions || '[]'),
    }))

    return new Response(JSON.stringify({ sessions }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Sessions] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list COP sessions',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserIdOrDefault(request, env)
    const workspaceId = request.headers.get('X-Workspace-ID') || '1'
    const body = await request.json() as any

    if (!body.name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const id = generateId()
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO cop_sessions (
        id, name, description, template_type, status,
        bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon,
        center_lat, center_lon, zoom_level,
        time_window_start, time_window_end, rolling_hours,
        active_layers, layer_config, linked_frameworks, key_questions,
        workspace_id, created_by, is_public, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.name,
      body.description || null,
      body.template_type || 'custom',
      body.status || 'ACTIVE',
      body.bbox_min_lat ?? null,
      body.bbox_min_lon ?? null,
      body.bbox_max_lat ?? null,
      body.bbox_max_lon ?? null,
      body.center_lat ?? null,
      body.center_lon ?? null,
      body.zoom_level ?? 6,
      body.time_window_start || null,
      body.time_window_end || null,
      body.rolling_hours ?? null,
      JSON.stringify(body.active_layers || []),
      JSON.stringify(body.layer_config || {}),
      JSON.stringify(body.linked_frameworks || []),
      JSON.stringify(body.key_questions || []),
      workspaceId,
      userId,
      body.is_public ? 1 : 0,
      now,
      now,
    ).run()

    return new Response(JSON.stringify({ id, message: 'COP session created' }), {
      status: 201,
      headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Sessions] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create COP session',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 2: Create single-session endpoint**

Create: `functions/api/cop/sessions/[id].ts`

```typescript
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const id = params.id as string

  try {
    const row = await env.DB.prepare('SELECT * FROM cop_sessions WHERE id = ?').bind(id).first()
    if (!row) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const session = {
      ...row,
      active_layers: JSON.parse((row as any).active_layers || '[]'),
      layer_config: JSON.parse((row as any).layer_config || '{}'),
      linked_frameworks: JSON.parse((row as any).linked_frameworks || '[]'),
      key_questions: JSON.parse((row as any).key_questions || '[]'),
    }

    return new Response(JSON.stringify(session), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Session] Get error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get COP session' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const id = params.id as string

  try {
    const body = await request.json() as any
    const now = new Date().toISOString()

    const fields: string[] = []
    const values: any[] = []

    const updatable = [
      'name', 'description', 'template_type', 'status',
      'bbox_min_lat', 'bbox_min_lon', 'bbox_max_lat', 'bbox_max_lon',
      'center_lat', 'center_lon', 'zoom_level',
      'time_window_start', 'time_window_end', 'rolling_hours',
      'is_public',
    ]

    for (const field of updatable) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`)
        values.push(body[field])
      }
    }

    // JSON fields
    const jsonFields = ['active_layers', 'layer_config', 'linked_frameworks', 'key_questions']
    for (const field of jsonFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`)
        values.push(JSON.stringify(body[field]))
      }
    }

    if (fields.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400, headers: corsHeaders,
      })
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    await env.DB.prepare(
      `UPDATE cop_sessions SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run()

    return new Response(JSON.stringify({ message: 'COP session updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Session] Update error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update COP session' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const id = params.id as string

  try {
    await env.DB.prepare(
      "UPDATE cop_sessions SET status = 'ARCHIVED', updated_at = ? WHERE id = ?"
    ).bind(new Date().toISOString(), id).run()

    return new Response(JSON.stringify({ message: 'COP session archived' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Session] Delete error:', error)
    return new Response(JSON.stringify({ error: 'Failed to archive COP session' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 3: Commit**

```bash
git add functions/api/cop/sessions.ts functions/api/cop/sessions/\[id\].ts
git commit -m "feat(cop): add COP session CRUD API endpoints"
```

---

## Phase 3: Layer Catalog + Entity GeoJSON Endpoints

### Task 5: Create Layer Catalog Registry

**Files:**
- Create: `src/components/cop/CopLayerCatalog.ts`

**Step 1: Write the layer catalog**

```typescript
import type { CopLayerDef } from '@/types/cop'

export const COP_LAYERS: CopLayerDef[] = [
  // ── Entity Layers ────────────────────────────────────────
  {
    id: 'places',
    name: 'Places',
    description: 'Facilities, cities, installations, and strategic locations',
    category: 'entities',
    icon: 'MapPin',
    source: { type: 'api', endpoint: '/layers/places' },
    render: {
      type: 'cluster',
      color: '#3b82f6',
      clusterRadius: 50,
      iconMapping: {
        FACILITY: 'building',
        CITY: 'landmark',
        REGION: 'map',
        COUNTRY: 'flag',
        INSTALLATION: 'shield',
      },
    },
    defaultFor: ['quick_brief', 'event_monitor', 'area_study', 'crisis_response', 'custom'],
    filterable: true,
    filterFields: ['place_type', 'country', 'strategic_importance'],
  },
  {
    id: 'events',
    name: 'Events',
    description: 'Operations, incidents, meetings, and activities',
    category: 'entities',
    icon: 'Calendar',
    source: { type: 'api', endpoint: '/layers/events' },
    render: {
      type: 'cluster',
      color: '#ef4444',
      clusterRadius: 40,
      iconMapping: {
        OPERATION: 'swords',
        INCIDENT: 'alert-triangle',
        MEETING: 'users',
        ACTIVITY: 'activity',
      },
    },
    defaultFor: ['quick_brief', 'event_monitor', 'area_study', 'crisis_response', 'custom'],
    filterable: true,
    filterFields: ['event_type', 'significance', 'confidence'],
  },
  {
    id: 'actors',
    name: 'Actors',
    description: 'People, organizations, and groups with known locations',
    category: 'entities',
    icon: 'Users',
    source: { type: 'api', endpoint: '/layers/actors' },
    render: {
      type: 'point',
      color: '#8b5cf6',
      iconMapping: {
        PERSON: 'user',
        ORGANIZATION: 'building-2',
        GROUP: 'users',
        GOVERNMENT: 'landmark',
        UNIT: 'shield',
      },
    },
    defaultFor: ['event_monitor', 'area_study', 'crisis_response', 'custom'],
    filterable: true,
    filterFields: ['actor_type', 'category', 'affiliation'],
  },
  {
    id: 'relationships',
    name: 'Relationships',
    description: 'Lines connecting related entities',
    category: 'entities',
    icon: 'GitBranch',
    source: { type: 'api', endpoint: '/layers/relationships' },
    render: { type: 'line', color: '#6b7280' },
    defaultFor: ['area_study', 'crisis_response'],
    filterable: true,
    filterFields: ['relationship_type', 'confidence'],
  },

  // ── External Layers ──────────────────────────────────────
  {
    id: 'acled',
    name: 'ACLED Conflicts',
    description: 'Armed conflict events from ACLED (battles, protests, riots, violence)',
    category: 'external',
    icon: 'Flame',
    source: { type: 'api', endpoint: '/layers/acled', refreshSeconds: 3600 },
    render: {
      type: 'cluster',
      color: '#dc2626',
      clusterRadius: 60,
      iconMapping: {
        Battles: 'swords',
        'Violence against civilians': 'alert-circle',
        Protests: 'megaphone',
        Riots: 'flame',
        'Strategic developments': 'target',
        Explosions: 'zap',
      },
    },
    defaultFor: ['event_monitor', 'crisis_response'],
    filterable: true,
    filterFields: ['event_type', 'sub_event_type', 'actor1'],
  },
  {
    id: 'gdelt',
    name: 'GDELT News',
    description: 'Geolocated news events from GDELT',
    category: 'external',
    icon: 'Newspaper',
    source: { type: 'api', endpoint: '/layers/gdelt', refreshSeconds: 900 },
    render: { type: 'heatmap', color: '#f59e0b' },
    defaultFor: ['event_monitor'],
    filterable: false,
  },

  // ── Analysis Layers ──────────────────────────────────────
  {
    id: 'deception-risk',
    name: 'Deception Risk',
    description: 'Deception risk heatmap from intelligence synthesis',
    category: 'analysis',
    icon: 'Eye',
    source: { type: 'api', endpoint: '/layers/analysis?type=deception' },
    render: { type: 'heatmap', color: '#7c3aed' },
    defaultFor: ['area_study'],
    filterable: false,
  },
  {
    id: 'framework-overlay',
    name: 'Framework Analysis',
    description: 'Overlay data from linked analytical frameworks',
    category: 'analysis',
    icon: 'Brain',
    source: { type: 'api', endpoint: '/layers/analysis?type=framework' },
    render: { type: 'point', color: '#059669' },
    defaultFor: ['area_study'],
    filterable: false,
  },

  // ── Tactical Layers ──────────────────────────────────────
  {
    id: 'cop-markers',
    name: 'Tactical Markers',
    description: 'User-placed markers (CoT-compatible)',
    category: 'tactical',
    icon: 'Crosshair',
    source: { type: 'api', endpoint: '/layers/markers', refreshSeconds: 30 },
    render: { type: 'point', color: '#eab308' },
    defaultFor: ['crisis_response'],
    filterable: false,
  },
  {
    id: 'user-drawings',
    name: 'Drawings',
    description: 'Freehand lines, polygons, and annotations (client-side only)',
    category: 'tactical',
    icon: 'Pencil',
    source: { type: 'static', endpoint: '' },
    render: { type: 'polygon', color: '#f97316' },
    defaultFor: ['crisis_response'],
    filterable: false,
  },
]

export function getLayersForTemplate(templateType: string): CopLayerDef[] {
  return COP_LAYERS.filter(l => l.defaultFor.includes(templateType as any))
}

export function getLayerById(id: string): CopLayerDef | undefined {
  return COP_LAYERS.find(l => l.id === id)
}
```

**Step 2: Commit**

```bash
git add src/components/cop/CopLayerCatalog.ts
git commit -m "feat(cop): add layer catalog registry with 10 layer definitions"
```

---

### Task 6: Create Entity GeoJSON Endpoints

**Files:**
- Create: `functions/api/cop/[id]/layers/places.ts`
- Create: `functions/api/cop/[id]/layers/events.ts`
- Create: `functions/api/cop/[id]/layers/actors.ts`
- Create: `functions/api/cop/[id]/layers/relationships.ts`

**Step 1: Write places layer endpoint**

Create `functions/api/cop/[id]/layers/places.ts`:

```typescript
import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)

  try {
    // Get session for workspace scoping
    const session = await env.DB.prepare(
      'SELECT workspace_id, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first<any>()

    if (!session) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    // Use request bbox or session bbox
    const bbox = url.searchParams.get('bbox')
    let minLon: number, minLat: number, maxLon: number, maxLat: number

    if (bbox) {
      [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number)
    } else {
      minLat = session.bbox_min_lat ?? -90
      maxLat = session.bbox_max_lat ?? 90
      minLon = session.bbox_min_lon ?? -180
      maxLon = session.bbox_max_lon ?? 180
    }

    const rows = await env.DB.prepare(`
      SELECT id, name, place_type, country, region, coordinates,
             strategic_importance, controlled_by, description
      FROM places
      WHERE workspace_id = ?
        AND coordinates IS NOT NULL
        AND json_extract(coordinates, '$.lat') BETWEEN ? AND ?
        AND json_extract(coordinates, '$.lng') BETWEEN ? AND ?
      ORDER BY strategic_importance DESC
      LIMIT 500
    `).bind(session.workspace_id, minLat, maxLat, minLon, maxLon).all()

    const features = (rows.results || []).map((row: any) => {
      const coords = JSON.parse(row.coordinates)
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [coords.lng, coords.lat],
        },
        properties: {
          id: row.id,
          name: row.name,
          place_type: row.place_type,
          country: row.country,
          region: row.region,
          strategic_importance: row.strategic_importance,
          controlled_by: row.controlled_by,
          description: row.description,
          entity_type: 'place',
        },
      }
    })

    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features,
    }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Places Layer] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch places layer' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 2: Write events layer endpoint**

Create `functions/api/cop/[id]/layers/events.ts`:

```typescript
import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)

  try {
    const session = await env.DB.prepare(
      'SELECT workspace_id, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon, time_window_start, time_window_end, rolling_hours FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first<any>()

    if (!session) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const bbox = url.searchParams.get('bbox')
    let minLon: number, minLat: number, maxLon: number, maxLat: number

    if (bbox) {
      [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number)
    } else {
      minLat = session.bbox_min_lat ?? -90
      maxLat = session.bbox_max_lat ?? 90
      minLon = session.bbox_min_lon ?? -180
      maxLon = session.bbox_max_lon ?? 180
    }

    // Time filtering
    let timeClause = ''
    const bindings: any[] = [session.workspace_id, minLat, maxLat, minLon, maxLon]

    if (session.rolling_hours) {
      timeClause = "AND e.date_start >= datetime('now', ?)"
      bindings.push(`-${session.rolling_hours} hours`)
    } else if (session.time_window_start) {
      timeClause = 'AND e.date_start >= ?'
      bindings.push(session.time_window_start)
      if (session.time_window_end) {
        timeClause += ' AND e.date_start <= ?'
        bindings.push(session.time_window_end)
      }
    }

    const rows = await env.DB.prepare(`
      SELECT e.id, e.name, e.event_type, e.date_start, e.date_end,
             e.coordinates, e.significance, e.confidence, e.description
      FROM events e
      WHERE e.workspace_id = ?
        AND e.coordinates IS NOT NULL
        AND json_extract(e.coordinates, '$.lat') BETWEEN ? AND ?
        AND json_extract(e.coordinates, '$.lng') BETWEEN ? AND ?
        ${timeClause}
      ORDER BY e.date_start DESC
      LIMIT 500
    `).bind(...bindings).all()

    const features = (rows.results || []).map((row: any) => {
      const coords = JSON.parse(row.coordinates)
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [coords.lng, coords.lat],
        },
        properties: {
          id: row.id,
          name: row.name,
          event_type: row.event_type,
          date_start: row.date_start,
          date_end: row.date_end,
          significance: row.significance,
          confidence: row.confidence,
          description: row.description,
          entity_type: 'event',
        },
      }
    })

    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features,
    }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Events Layer] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch events layer' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 3: Write actors layer endpoint**

Create `functions/api/cop/[id]/layers/actors.ts`:

```typescript
import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)

  try {
    const session = await env.DB.prepare(
      'SELECT workspace_id, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first<any>()

    if (!session) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const bbox = url.searchParams.get('bbox')
    let minLon: number, minLat: number, maxLon: number, maxLat: number

    if (bbox) {
      [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number)
    } else {
      minLat = session.bbox_min_lat ?? -90
      maxLat = session.bbox_max_lat ?? 90
      minLon = session.bbox_min_lon ?? -180
      maxLon = session.bbox_max_lon ?? 180
    }

    // Actors with LOCATED_AT relationships to places that have coordinates
    const rows = await env.DB.prepare(`
      SELECT a.id, a.name, a.actor_type, a.category, a.affiliation, a.description,
             p.coordinates, p.name as location_name
      FROM actors a
      JOIN relationships r ON r.source_entity_id = a.id
        AND r.source_entity_type = 'ACTOR'
        AND r.relationship_type = 'LOCATED_AT'
      JOIN places p ON p.id = r.target_entity_id
        AND r.target_entity_type = 'PLACE'
      WHERE a.workspace_id = ?
        AND p.coordinates IS NOT NULL
        AND json_extract(p.coordinates, '$.lat') BETWEEN ? AND ?
        AND json_extract(p.coordinates, '$.lng') BETWEEN ? AND ?
      LIMIT 500
    `).bind(session.workspace_id, minLat, maxLat, minLon, maxLon).all()

    const features = (rows.results || []).map((row: any) => {
      const coords = JSON.parse(row.coordinates)
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [coords.lng, coords.lat],
        },
        properties: {
          id: row.id,
          name: row.name,
          actor_type: row.actor_type,
          category: row.category,
          affiliation: row.affiliation,
          description: row.description,
          location_name: row.location_name,
          entity_type: 'actor',
        },
      }
    })

    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features,
    }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Actors Layer] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch actors layer' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 4: Write relationships layer endpoint**

Create `functions/api/cop/[id]/layers/relationships.ts`:

```typescript
import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const session = await env.DB.prepare(
      'SELECT workspace_id FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first<any>()

    if (!session) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    // Get relationships between entities that both have coordinates
    const rows = await env.DB.prepare(`
      SELECT r.id, r.relationship_type, r.confidence,
             r.source_entity_id, r.source_entity_type,
             r.target_entity_id, r.target_entity_type,
             sp.coordinates as source_coords,
             tp.coordinates as target_coords
      FROM relationships r
      JOIN places sp ON (
        (r.source_entity_type = 'PLACE' AND sp.id = r.source_entity_id)
        OR (r.source_entity_type = 'ACTOR' AND sp.id IN (
          SELECT p.id FROM places p
          JOIN relationships lr ON lr.source_entity_id = r.source_entity_id
            AND lr.relationship_type = 'LOCATED_AT'
            AND lr.target_entity_type = 'PLACE'
            AND p.id = lr.target_entity_id
        ))
      )
      JOIN places tp ON (
        (r.target_entity_type = 'PLACE' AND tp.id = r.target_entity_id)
        OR (r.target_entity_type = 'ACTOR' AND tp.id IN (
          SELECT p.id FROM places p
          JOIN relationships lr ON lr.source_entity_id = r.target_entity_id
            AND lr.relationship_type = 'LOCATED_AT'
            AND lr.target_entity_type = 'PLACE'
            AND p.id = lr.target_entity_id
        ))
      )
      WHERE r.workspace_id = ?
        AND sp.coordinates IS NOT NULL
        AND tp.coordinates IS NOT NULL
      LIMIT 200
    `).bind(session.workspace_id).all()

    const features = (rows.results || []).map((row: any) => {
      const src = JSON.parse(row.source_coords)
      const tgt = JSON.parse(row.target_coords)
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [src.lng, src.lat],
            [tgt.lng, tgt.lat],
          ],
        },
        properties: {
          id: row.id,
          relationship_type: row.relationship_type,
          confidence: row.confidence,
          source_id: row.source_entity_id,
          target_id: row.target_entity_id,
        },
      }
    })

    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features,
    }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Relationships Layer] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch relationships layer' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 5: Commit**

```bash
git add functions/api/cop/\[id\]/layers/
git commit -m "feat(cop): add GeoJSON endpoints for places, events, actors, relationships layers"
```

---

## Phase 4: External Feed Proxies (ACLED + GDELT)

### Task 7: Create ACLED Proxy Endpoint

**Files:**
- Create: `functions/api/cop/[id]/layers/acled.ts`

**Context:** ACLED API (https://api.acleddata.com/acled/read) returns JSON with `data` array. Each record has `latitude`, `longitude`, `event_type`, `sub_event_type`, `event_date`, `actor1`, `fatalities`, `notes`. Free API with key registration. We proxy through our Worker and cache in KV (1h TTL).

**Step 1: Write the ACLED proxy**

```typescript
import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  COP_CACHE?: KVNamespace
  ACLED_API_KEY?: string
  ACLED_EMAIL?: string
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)

  try {
    const session = await env.DB.prepare(
      'SELECT bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon, rolling_hours, time_window_start FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first<any>()

    if (!session) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const bbox = url.searchParams.get('bbox')
    let minLon: number, minLat: number, maxLon: number, maxLat: number

    if (bbox) {
      [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number)
    } else {
      minLat = session.bbox_min_lat ?? -90
      maxLat = session.bbox_max_lat ?? 90
      minLon = session.bbox_min_lon ?? -180
      maxLon = session.bbox_max_lon ?? 180
    }

    // Check KV cache
    const cacheKey = `acled:${minLat.toFixed(1)},${minLon.toFixed(1)},${maxLat.toFixed(1)},${maxLon.toFixed(1)}`
    if (env.COP_CACHE) {
      const cached = await env.COP_CACHE.get(cacheKey)
      if (cached) {
        return new Response(cached, { headers: corsHeaders })
      }
    }

    // Calculate date range
    let eventDateWhere = ''
    if (session.rolling_hours) {
      const since = new Date(Date.now() - session.rolling_hours * 3600000)
      eventDateWhere = `&event_date=${since.toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}&event_date_where=BETWEEN`
    } else if (session.time_window_start) {
      eventDateWhere = `&event_date=${session.time_window_start.split('T')[0]}|${new Date().toISOString().split('T')[0]}&event_date_where=BETWEEN`
    }

    // Fetch from ACLED API
    const apiKey = env.ACLED_API_KEY || ''
    const email = env.ACLED_EMAIL || ''
    const acledUrl = `https://api.acleddata.com/acled/read?key=${apiKey}&email=${email}&limit=500&latitude=${minLat}|${maxLat}&latitude_where=BETWEEN&longitude=${minLon}|${maxLon}&longitude_where=BETWEEN${eventDateWhere}`

    const response = await fetch(acledUrl)

    if (!response.ok) {
      // Return empty collection if ACLED is unavailable
      console.error('[ACLED] API error:', response.status)
      return new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: [],
        _meta: { source: 'acled', error: 'API unavailable', status: response.status },
      }), { headers: corsHeaders })
    }

    const data = await response.json() as any
    const records = data.data || []

    const features = records
      .filter((r: any) => r.latitude && r.longitude)
      .map((r: any) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [parseFloat(r.longitude), parseFloat(r.latitude)],
        },
        properties: {
          id: `acled-${r.data_id}`,
          name: `${r.event_type}: ${r.sub_event_type}`,
          event_type: r.event_type,
          sub_event_type: r.sub_event_type,
          event_date: r.event_date,
          actor1: r.actor1,
          actor2: r.actor2 || null,
          fatalities: parseInt(r.fatalities) || 0,
          country: r.country,
          notes: r.notes,
          source: r.source,
          entity_type: 'acled',
        },
      }))

    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features,
      _meta: { source: 'acled', count: features.length, fetched_at: new Date().toISOString() },
    })

    // Cache for 1 hour
    if (env.COP_CACHE) {
      await env.COP_CACHE.put(cacheKey, geojson, { expirationTtl: 3600 })
    }

    return new Response(geojson, { headers: corsHeaders })
  } catch (error) {
    console.error('[ACLED Layer] Error:', error)
    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features: [],
      _meta: { source: 'acled', error: error instanceof Error ? error.message : 'Unknown' },
    }), { headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 2: Commit**

```bash
git add functions/api/cop/\[id\]/layers/acled.ts
git commit -m "feat(cop): add ACLED conflict data proxy with KV caching"
```

---

### Task 8: Create GDELT Proxy Endpoint

**Files:**
- Create: `functions/api/cop/[id]/layers/gdelt.ts`

**Context:** GDELT GeoJSON API at `https://api.gdeltproject.org/api/v2/geo/geo` returns GeoJSON directly. Parameters: `query` (search), `format=GeoJSON`, `timespan` (in minutes), `maxpoints`.

**Step 1: Write the GDELT proxy**

```typescript
import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  COP_CACHE?: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)

  try {
    const session = await env.DB.prepare(
      'SELECT bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon, rolling_hours, name FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first<any>()

    if (!session) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const bbox = url.searchParams.get('bbox')
    let minLon: number, minLat: number, maxLon: number, maxLat: number

    if (bbox) {
      [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number)
    } else {
      minLat = session.bbox_min_lat ?? -90
      maxLat = session.bbox_max_lat ?? 90
      minLon = session.bbox_min_lon ?? -180
      maxLon = session.bbox_max_lon ?? 180
    }

    // Check KV cache
    const cacheKey = `gdelt:${minLat.toFixed(1)},${minLon.toFixed(1)},${maxLat.toFixed(1)},${maxLon.toFixed(1)}`
    if (env.COP_CACHE) {
      const cached = await env.COP_CACHE.get(cacheKey)
      if (cached) {
        return new Response(cached, { headers: corsHeaders })
      }
    }

    // GDELT timespan in minutes (default 24h = 1440min)
    const timespanMinutes = (session.rolling_hours || 24) * 60

    // Use session name as search context, or broad query
    const query = url.searchParams.get('query') || 'conflict OR protest OR military OR crisis'

    const gdeltUrl = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&format=GeoJSON&timespan=${timespanMinutes}&maxpoints=500&sourcelang=eng`

    const response = await fetch(gdeltUrl)

    if (!response.ok) {
      console.error('[GDELT] API error:', response.status)
      return new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: [],
        _meta: { source: 'gdelt', error: 'API unavailable' },
      }), { headers: corsHeaders })
    }

    const data = await response.json() as any

    // Filter to bbox
    const features = (data.features || []).filter((f: any) => {
      if (!f.geometry?.coordinates) return false
      const [lon, lat] = f.geometry.coordinates
      return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon
    }).map((f: any) => ({
      ...f,
      properties: {
        ...f.properties,
        entity_type: 'gdelt',
      },
    }))

    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features,
      _meta: { source: 'gdelt', count: features.length, fetched_at: new Date().toISOString() },
    })

    // Cache for 15 min
    if (env.COP_CACHE) {
      await env.COP_CACHE.put(cacheKey, geojson, { expirationTtl: 900 })
    }

    return new Response(geojson, { headers: corsHeaders })
  } catch (error) {
    console.error('[GDELT Layer] Error:', error)
    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features: [],
      _meta: { source: 'gdelt', error: error instanceof Error ? error.message : 'Unknown' },
    }), { headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 2: Commit**

```bash
git add functions/api/cop/\[id\]/layers/gdelt.ts
git commit -m "feat(cop): add GDELT news geo proxy with KV caching"
```

---

## Phase 5: Tactical Markers + CoT Export

### Task 9: Create Marker CRUD + CoT Serializer

**Files:**
- Create: `functions/api/cop/[id]/markers.ts`
- Create: `functions/api/cop/[id]/layers/markers.ts`
- Create: `functions/api/cop/cot-serializer.ts`
- Create: `functions/api/cop/[id]/cot.ts`

**Step 1: Write marker CRUD endpoint**

Create `functions/api/cop/[id]/markers.ts`:

```typescript
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const rows = await env.DB.prepare(`
      SELECT * FROM cop_markers WHERE cop_session_id = ? ORDER BY event_time DESC
    `).bind(sessionId).all()

    const markers = (rows.results || []).map((row: any) => ({
      ...row,
      detail: JSON.parse(row.detail || '{}'),
    }))

    return new Response(JSON.stringify({ markers }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Markers] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list markers' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    const workspaceId = request.headers.get('X-Workspace-ID') || '1'
    const body = await request.json() as any

    if (body.lat == null || body.lon == null) {
      return new Response(JSON.stringify({ error: 'lat and lon are required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const id = `mkr-${crypto.randomUUID().slice(0, 12)}`
    const uid = body.uid || crypto.randomUUID()
    const now = new Date().toISOString()
    const staleMinutes = body.stale_minutes ?? 5
    const staleTime = new Date(Date.now() + staleMinutes * 60000).toISOString()

    await env.DB.prepare(`
      INSERT INTO cop_markers (
        id, cop_session_id, uid, cot_type, callsign,
        lat, lon, hae, label, description, icon, color, detail,
        event_time, stale_time, source_type, source_id,
        workspace_id, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, sessionId, uid,
      body.cot_type || 'a-u-G',
      body.callsign || null,
      body.lat, body.lon, body.hae ?? 0,
      body.label || null,
      body.description || null,
      body.icon || null,
      body.color || null,
      JSON.stringify(body.detail || {}),
      now, staleTime,
      body.source_type || 'MANUAL',
      body.source_id || null,
      workspaceId, userId, now,
    ).run()

    return new Response(JSON.stringify({ id, uid, message: 'Marker created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Markers] Create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create marker' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 2: Write markers GeoJSON layer endpoint**

Create `functions/api/cop/[id]/layers/markers.ts`:

```typescript
import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const rows = await env.DB.prepare(`
      SELECT * FROM cop_markers
      WHERE cop_session_id = ?
        AND (stale_time IS NULL OR stale_time > datetime('now'))
      ORDER BY event_time DESC
      LIMIT 500
    `).bind(sessionId).all()

    const features = (rows.results || []).map((row: any) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [row.lon, row.lat],
      },
      properties: {
        id: row.id,
        uid: row.uid,
        cot_type: row.cot_type,
        callsign: row.callsign,
        label: row.label,
        description: row.description,
        icon: row.icon,
        color: row.color,
        event_time: row.event_time,
        stale_time: row.stale_time,
        source_type: row.source_type,
        entity_type: 'marker',
      },
    }))

    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features,
    }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Markers Layer] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch markers layer' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 3: Write CoT serializer utility**

Create `functions/api/cop/cot-serializer.ts`:

```typescript
/**
 * Cursor on Target (CoT) XML Serializer
 *
 * Converts COP entities to CoT XML for ATAK/WinTAK/iTAK interoperability.
 * CoT spec: MIL-STD-6040 / https://www.mitre.org/sites/default/files/pdf/09_4937.pdf
 */

interface CoTEvent {
  uid: string
  type: string         // e.g., "a-f-G-U-C" (friendly ground unit combat)
  lat: number
  lon: number
  hae?: number
  callsign?: string
  staleMinutes?: number
  detail?: Record<string, string>
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatTime(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, '.000Z')
}

export function entityToCoT(event: CoTEvent): string {
  const now = new Date()
  const stale = new Date(now.getTime() + (event.staleMinutes ?? 5) * 60_000)

  let detailXml = ''
  if (event.callsign) {
    detailXml += `\n    <contact callsign="${escapeXml(event.callsign)}"/>`
  }
  if (event.detail) {
    for (const [key, value] of Object.entries(event.detail)) {
      detailXml += `\n    <__${escapeXml(key)}>${escapeXml(value)}</__${escapeXml(key)}>`
    }
  }

  return `<event version="2.0"
  uid="${escapeXml(event.uid)}"
  type="${escapeXml(event.type)}"
  time="${formatTime(now)}"
  start="${formatTime(now)}"
  stale="${formatTime(stale)}"
  how="h-e">
  <point lat="${event.lat}" lon="${event.lon}"
    hae="${event.hae ?? 0}"
    ce="9999999.0" le="9999999.0"/>${detailXml ? `\n  <detail>${detailXml}\n  </detail>` : '\n  <detail/>'}
</event>`
}

export function wrapCoTFeed(events: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<events>
${events.join('\n')}
</events>`
}

// Map entity types to CoT type atoms
export function placeToCoTType(placeType: string): string {
  const map: Record<string, string> = {
    FACILITY: 'b-i-X-i',
    INSTALLATION: 'b-i-X-i',
    CITY: 'a-n-G',
    REGION: 'a-n-G',
    COUNTRY: 'a-n-G',
  }
  return map[placeType] || 'b-i-X-i'
}

export function eventToCoTType(eventType: string): string {
  const map: Record<string, string> = {
    OPERATION: 'b-r-f-h-c',
    INCIDENT: 'b-r-f-h-c',
    MEETING: 'a-n-G-U',
    ACTIVITY: 'b-r-f-h-c',
  }
  return map[eventType] || 'b-r-f-h-c'
}

export function actorToCoTType(actorType: string): string {
  const map: Record<string, string> = {
    PERSON: 'a-u-G-U',
    ORGANIZATION: 'a-u-G-U-C',
    GROUP: 'a-u-G-U-C',
    GOVERNMENT: 'a-u-G-U-C',
    UNIT: 'a-u-G-U-C',
  }
  return map[actorType] || 'a-u-G-U'
}
```

**Step 4: Write CoT feed endpoint**

Create `functions/api/cop/[id]/cot.ts`:

```typescript
import type { PagesFunction } from '@cloudflare/workers-types'
import {
  entityToCoT, wrapCoTFeed,
  placeToCoTType, eventToCoTType, actorToCoTType,
} from '../cot-serializer'

interface Env {
  DB: D1Database
}

const xmlHeaders = {
  'Content-Type': 'application/xml',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const session = await env.DB.prepare(
      'SELECT * FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first<any>()

    if (!session) {
      return new Response('<error>COP session not found</error>', {
        status: 404, headers: xmlHeaders,
      })
    }

    const wsId = session.workspace_id
    const minLat = session.bbox_min_lat ?? -90
    const maxLat = session.bbox_max_lat ?? 90
    const minLon = session.bbox_min_lon ?? -180
    const maxLon = session.bbox_max_lon ?? 180
    const staleMinutes = session.rolling_hours ? session.rolling_hours * 60 : 60

    const cotEvents: string[] = []

    // Fetch places, events, actors, markers in parallel
    const [places, events, actors, markers] = await Promise.all([
      env.DB.prepare(`
        SELECT id, name, place_type, coordinates FROM places
        WHERE workspace_id = ? AND coordinates IS NOT NULL
          AND json_extract(coordinates, '$.lat') BETWEEN ? AND ?
          AND json_extract(coordinates, '$.lng') BETWEEN ? AND ?
        LIMIT 200
      `).bind(wsId, minLat, maxLat, minLon, maxLon).all(),

      env.DB.prepare(`
        SELECT id, name, event_type, coordinates FROM events
        WHERE workspace_id = ? AND coordinates IS NOT NULL
          AND json_extract(coordinates, '$.lat') BETWEEN ? AND ?
          AND json_extract(coordinates, '$.lng') BETWEEN ? AND ?
        LIMIT 200
      `).bind(wsId, minLat, maxLat, minLon, maxLon).all(),

      env.DB.prepare(`
        SELECT a.id, a.name, a.actor_type, p.coordinates
        FROM actors a
        JOIN relationships r ON r.source_entity_id = a.id
          AND r.source_entity_type = 'ACTOR' AND r.relationship_type = 'LOCATED_AT'
        JOIN places p ON p.id = r.target_entity_id AND r.target_entity_type = 'PLACE'
        WHERE a.workspace_id = ? AND p.coordinates IS NOT NULL
          AND json_extract(p.coordinates, '$.lat') BETWEEN ? AND ?
          AND json_extract(p.coordinates, '$.lng') BETWEEN ? AND ?
        LIMIT 200
      `).bind(wsId, minLat, maxLat, minLon, maxLon).all(),

      env.DB.prepare(`
        SELECT * FROM cop_markers
        WHERE cop_session_id = ?
          AND (stale_time IS NULL OR stale_time > datetime('now'))
        LIMIT 200
      `).bind(sessionId).all(),
    ])

    // Convert places
    for (const row of (places.results || []) as any[]) {
      const coords = JSON.parse(row.coordinates)
      cotEvents.push(entityToCoT({
        uid: `place-${row.id}`,
        type: placeToCoTType(row.place_type),
        lat: coords.lat,
        lon: coords.lng,
        callsign: row.name,
        staleMinutes,
      }))
    }

    // Convert events
    for (const row of (events.results || []) as any[]) {
      const coords = JSON.parse(row.coordinates)
      cotEvents.push(entityToCoT({
        uid: `event-${row.id}`,
        type: eventToCoTType(row.event_type),
        lat: coords.lat,
        lon: coords.lng,
        callsign: row.name,
        staleMinutes,
      }))
    }

    // Convert actors
    for (const row of (actors.results || []) as any[]) {
      const coords = JSON.parse(row.coordinates)
      cotEvents.push(entityToCoT({
        uid: `actor-${row.id}`,
        type: actorToCoTType(row.actor_type),
        lat: coords.lat,
        lon: coords.lng,
        callsign: row.name,
        staleMinutes,
      }))
    }

    // Convert tactical markers (already CoT-native)
    for (const row of (markers.results || []) as any[]) {
      cotEvents.push(entityToCoT({
        uid: row.uid,
        type: row.cot_type,
        lat: row.lat,
        lon: row.lon,
        hae: row.hae,
        callsign: row.callsign || row.label,
        staleMinutes: 5,
      }))
    }

    return new Response(wrapCoTFeed(cotEvents), { headers: xmlHeaders })
  } catch (error) {
    console.error('[CoT Export] Error:', error)
    return new Response('<error>Failed to generate CoT feed</error>', {
      status: 500, headers: xmlHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: xmlHeaders })
}
```

**Step 5: Commit**

```bash
git add functions/api/cop/\[id\]/markers.ts functions/api/cop/\[id\]/layers/markers.ts functions/api/cop/cot-serializer.ts functions/api/cop/\[id\]/cot.ts
git commit -m "feat(cop): add tactical markers CRUD, CoT serializer, and ATAK export endpoint"
```

---

## Phase 6: Frontend — Map Component + COP Page

### Task 10: Create CopMap Component

**Files:**
- Create: `src/components/cop/CopMap.tsx`

**Step 1: Write the MapLibre wrapper component**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { CopSession, CopFeatureCollection } from '@/types/cop'

interface CopMapProps {
  session: CopSession
  layers: Record<string, CopFeatureCollection>
  onMapClick?: (lngLat: { lng: number; lat: number }) => void
  onBboxChange?: (bbox: [number, number, number, number]) => void
}

const LAYER_COLORS: Record<string, string> = {
  places: '#3b82f6',
  events: '#ef4444',
  actors: '#8b5cf6',
  relationships: '#6b7280',
  acled: '#dc2626',
  gdelt: '#f59e0b',
  'deception-risk': '#7c3aed',
  'framework-overlay': '#059669',
  'cop-markers': '#eab308',
}

export function CopMap({ session, layers, onMapClick, onBboxChange }: CopMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [session.center_lon ?? 0, session.center_lat ?? 30],
      zoom: session.zoom_level ?? 4,
      attributionControl: false,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl(), 'bottom-right')

    map.on('load', () => {
      setMapLoaded(true)
    })

    map.on('click', (e) => {
      onMapClick?.({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    })

    map.on('moveend', () => {
      const bounds = map.getBounds()
      onBboxChange?.([
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ])
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update layers when data changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    for (const [layerId, geojson] of Object.entries(layers)) {
      const sourceId = `cop-${layerId}`
      const layerPaintId = `cop-${layerId}-layer`

      const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined

      if (source) {
        source.setData(geojson as any)
      } else {
        map.addSource(sourceId, {
          type: 'geojson',
          data: geojson as any,
          cluster: layerId !== 'relationships',
          clusterMaxZoom: 14,
          clusterRadius: 50,
        })

        if (layerId === 'relationships') {
          map.addLayer({
            id: layerPaintId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': LAYER_COLORS[layerId] || '#888',
              'line-width': 1.5,
              'line-opacity': 0.6,
            },
          })
        } else {
          // Cluster circles
          map.addLayer({
            id: `${layerPaintId}-clusters`,
            type: 'circle',
            source: sourceId,
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': LAYER_COLORS[layerId] || '#888',
              'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 50, 25],
              'circle-opacity': 0.7,
            },
          })

          // Cluster count labels
          map.addLayer({
            id: `${layerPaintId}-cluster-count`,
            type: 'symbol',
            source: sourceId,
            filter: ['has', 'point_count'],
            layout: {
              'text-field': '{point_count_abbreviated}',
              'text-font': ['Open Sans Bold'],
              'text-size': 12,
            },
            paint: { 'text-color': '#ffffff' },
          })

          // Individual points
          map.addLayer({
            id: layerPaintId,
            type: 'circle',
            source: sourceId,
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': LAYER_COLORS[layerId] || '#888',
              'circle-radius': 6,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          })
        }

        // Popup on click for point layers
        if (layerId !== 'relationships') {
          map.on('click', layerPaintId, (e) => {
            if (!e.features?.length) return
            const props = e.features[0].properties
            const coords = (e.features[0].geometry as any).coordinates.slice()

            new maplibregl.Popup({ offset: 15 })
              .setLngLat(coords)
              .setHTML(`
                <div style="color:#111;max-width:250px">
                  <strong>${props?.name || props?.callsign || 'Unknown'}</strong>
                  ${props?.description ? `<p style="margin:4px 0;font-size:12px">${props.description.slice(0, 200)}</p>` : ''}
                  <span style="font-size:11px;color:#666">${props?.entity_type || ''} ${props?.event_type || props?.place_type || props?.actor_type || ''}</span>
                </div>
              `)
              .addTo(map)
          })

          map.on('mouseenter', layerPaintId, () => {
            map.getCanvas().style.cursor = 'pointer'
          })
          map.on('mouseleave', layerPaintId, () => {
            map.getCanvas().style.cursor = ''
          })
        }
      }
    }
  }, [layers, mapLoaded])

  return (
    <div ref={mapContainer} className="w-full h-full min-h-[400px] rounded-lg" />
  )
}
```

**Step 2: Commit**

```bash
git add src/components/cop/CopMap.tsx
git commit -m "feat(cop): add CopMap component with MapLibre GL, clustering, and popups"
```

---

### Task 11: Create COP Layer Panel

**Files:**
- Create: `src/components/cop/CopLayerPanel.tsx`

**Step 1: Write the layer panel**

```typescript
import { COP_LAYERS } from './CopLayerCatalog'
import type { CopLayerCategory } from '@/types/cop'
import {
  MapPin, Calendar, Users, GitBranch, Flame, Newspaper,
  Eye, Brain, Crosshair, Pencil, ChevronDown, ChevronRight,
} from 'lucide-react'
import { useState } from 'react'

const ICONS: Record<string, React.ElementType> = {
  MapPin, Calendar, Users, GitBranch, Flame, Newspaper,
  Eye, Brain, Crosshair, Pencil,
}

const CATEGORY_LABELS: Record<string, string> = {
  entities: 'Your Data',
  external: 'World Events',
  analysis: 'Analysis',
  tactical: 'Tactical',
}

interface CopLayerPanelProps {
  activeLayers: string[]
  onToggleLayer: (layerId: string) => void
  layerCounts?: Record<string, number>
}

export function CopLayerPanel({ activeLayers, onToggleLayer, layerCounts }: CopLayerPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const categories = ['entities', 'external', 'analysis', 'tactical'] as CopLayerCategory[]

  return (
    <div className="w-56 bg-gray-900 border-r border-gray-800 overflow-y-auto text-sm">
      <div className="p-3 border-b border-gray-800">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Layers</h3>
      </div>
      {categories.map(cat => {
        const layersInCat = COP_LAYERS.filter(l => l.category === cat)
        if (layersInCat.length === 0) return null
        const isCollapsed = collapsed[cat]

        return (
          <div key={cat} className="border-b border-gray-800">
            <button
              onClick={() => setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:bg-gray-800"
            >
              {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {CATEGORY_LABELS[cat]}
            </button>
            {!isCollapsed && layersInCat.map(layer => {
              const Icon = ICONS[layer.icon] || MapPin
              const isActive = activeLayers.includes(layer.id)
              const count = layerCounts?.[layer.id]

              return (
                <label
                  key={layer.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => onToggleLayer(layer.id)}
                    className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: layer.render.color }} />
                  <span className={`flex-1 ${isActive ? 'text-gray-200' : 'text-gray-500'}`}>
                    {layer.name}
                  </span>
                  {count != null && (
                    <span className="text-xs text-gray-600">{count}</span>
                  )}
                </label>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/cop/CopLayerPanel.tsx
git commit -m "feat(cop): add layer panel sidebar with category grouping and toggle controls"
```

---

### Task 12: Create COP Wizard Component

**Files:**
- Create: `src/components/cop/CopWizard.tsx`
- Create: `functions/api/cop/wizard.ts`

**Step 1: Write the wizard component**

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Zap, Radio, BookOpen, AlertTriangle, Settings,
  ArrowLeft, ArrowRight, Loader2,
} from 'lucide-react'
import type { CopTemplateType, CopWizardInput } from '@/types/cop'
import { getLayersForTemplate } from './CopLayerCatalog'

const TEMPLATES = [
  { type: 'quick_brief' as const, icon: Zap, label: 'Quick Brief', desc: 'Answer 1-3 questions about an area', time: '1h snapshot' },
  { type: 'event_monitor' as const, icon: Radio, label: 'Event Monitor', desc: 'Track a developing situation', time: '48h rolling' },
  { type: 'area_study' as const, icon: BookOpen, label: 'Area Study', desc: 'Deep analytical picture', time: 'All time' },
  { type: 'crisis_response' as const, icon: AlertTriangle, label: 'Crisis Response', desc: 'Full operational picture', time: 'Ongoing' },
  { type: 'custom' as const, icon: Settings, label: 'Custom', desc: 'Configure everything yourself', time: 'Your choice' },
]

const TIME_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '6 hours', hours: 6 },
  { label: '24 hours', hours: 24 },
  { label: '48 hours', hours: 48 },
  { label: '7 days', hours: 168 },
  { label: 'Ongoing', hours: 0 },
]

interface CopWizardProps {
  onClose: () => void
}

export function CopWizard({ onClose }: CopWizardProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [creating, setCreating] = useState(false)

  const [input, setInput] = useState<CopWizardInput>({
    purpose: 'event_monitor',
    location: { center: { lat: 30, lon: 45 }, zoom: 5 },
    timeWindow: { type: 'rolling', rollingHours: 48 },
    questions: [],
  })

  const [locationSearch, setLocationSearch] = useState('')
  const [questionText, setQuestionText] = useState('')

  async function handleCreate() {
    setCreating(true)
    try {
      const layers = getLayersForTemplate(input.purpose)
      const body = {
        name: `${TEMPLATES.find(t => t.type === input.purpose)?.label || 'COP'} — ${locationSearch || 'Global'}`,
        description: input.questions.length > 0 ? `Key questions: ${input.questions.join('; ')}` : null,
        template_type: input.purpose,
        center_lat: input.location.center?.lat ?? 30,
        center_lon: input.location.center?.lon ?? 45,
        zoom_level: input.location.zoom ?? 5,
        bbox_min_lat: input.location.bbox?.minLat ?? null,
        bbox_min_lon: input.location.bbox?.minLon ?? null,
        bbox_max_lat: input.location.bbox?.maxLat ?? null,
        bbox_max_lon: input.location.bbox?.maxLon ?? null,
        rolling_hours: input.timeWindow.rollingHours || null,
        time_window_start: input.timeWindow.start || null,
        time_window_end: input.timeWindow.end || null,
        active_layers: layers.map(l => l.id),
        key_questions: input.questions,
      }

      const res = await fetch('/api/cop/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error('Failed to create COP session')
      const data = await res.json() as { id: string }
      navigate(`/dashboard/cop/${data.id}`)
    } catch (error) {
      console.error('Failed to create COP:', error)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="max-w-lg mx-auto bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">New Common Operating Picture</CardTitle>
        <div className="flex gap-1 mt-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`h-1 flex-1 rounded ${i <= step ? 'bg-blue-500' : 'bg-gray-700'}`} />
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {/* Step 0: Purpose */}
        {step === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400 mb-3">What's the purpose of this COP?</p>
            {TEMPLATES.map(t => (
              <button
                key={t.type}
                onClick={() => setInput(prev => ({ ...prev, purpose: t.type }))}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                  input.purpose === t.type
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <t.icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm text-white font-medium">{t.label}</div>
                  <div className="text-xs text-gray-500">{t.desc}</div>
                </div>
                <span className="text-xs text-gray-600">{t.time}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 1: Location */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Where? Search for a location or enter coordinates.</p>
            <input
              type="text"
              placeholder="e.g., Iran, Donbas, 33.88,-35.51..."
              value={locationSearch}
              onChange={e => setLocationSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-600">Tip: You can refine the area on the map after creation.</p>
          </div>
        )}

        {/* Step 2: Time */}
        {step === 2 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">How long should this COP monitor?</p>
            <div className="grid grid-cols-3 gap-2">
              {TIME_OPTIONS.map(opt => (
                <button
                  key={opt.hours}
                  onClick={() => setInput(prev => ({
                    ...prev,
                    timeWindow: {
                      type: opt.hours === 0 ? 'ongoing' : 'rolling',
                      rollingHours: opt.hours || undefined,
                    },
                  }))}
                  className={`px-3 py-2 rounded-lg border text-sm transition ${
                    input.timeWindow.rollingHours === opt.hours ||
                    (opt.hours === 0 && input.timeWindow.type === 'ongoing')
                      ? 'border-blue-500 bg-blue-500/10 text-white'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Questions */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Key questions this COP should help answer (optional):</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g., What groups are active here?"
                value={questionText}
                onChange={e => setQuestionText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && questionText.trim()) {
                    setInput(prev => ({ ...prev, questions: [...prev.questions, questionText.trim()] }))
                    setQuestionText('')
                  }
                }}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:border-blue-500"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (questionText.trim()) {
                    setInput(prev => ({ ...prev, questions: [...prev.questions, questionText.trim()] }))
                    setQuestionText('')
                  }
                }}
              >
                Add
              </Button>
            </div>
            {input.questions.length > 0 && (
              <ul className="space-y-1">
                {input.questions.map((q, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="text-gray-600">{i + 1}.</span>
                    <span className="flex-1">{q}</span>
                    <button
                      onClick={() => setInput(prev => ({
                        ...prev,
                        questions: prev.questions.filter((_, j) => j !== i),
                      }))}
                      className="text-gray-600 hover:text-red-400 text-xs"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button variant="ghost" onClick={step === 0 ? onClose : () => setStep(s => s - 1)}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(s => s + 1)}>
              Next
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Create COP
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/cop/CopWizard.tsx
git commit -m "feat(cop): add 4-step COP creation wizard with template selection"
```

---

### Task 13: Create COP Pages and Wire Routes

**Files:**
- Create: `src/pages/CopListPage.tsx`
- Create: `src/pages/CopPage.tsx`
- Modify: `src/routes/index.tsx` — add COP routes
- Modify: `src/components/layout/dashboard-sidebar.tsx` — add nav entry

**Step 1: Write COP list page**

Create `src/pages/CopListPage.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Map, Zap, Radio, BookOpen, AlertTriangle, Settings,
  MoreHorizontal, Archive, Share2, Download,
} from 'lucide-react'
import type { CopSession } from '@/types/cop'
import { CopWizard } from '@/components/cop/CopWizard'

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  quick_brief: Zap,
  event_monitor: Radio,
  area_study: BookOpen,
  crisis_response: AlertTriangle,
  custom: Settings,
}

function getAuthHeaders(): HeadersInit {
  const userHash = localStorage.getItem('omnicore_user_hash')
  return { ...(userHash && { Authorization: `Bearer ${userHash}` }) }
}

export default function CopListPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<CopSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    fetch('/api/cop/sessions', { headers: getAuthHeaders() })
      .then(r => r.json())
      .then((data: any) => setSessions(data.sessions || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (showWizard) {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <CopWizard onClose={() => setShowWizard(false)} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Map className="w-6 h-6" />
              Common Operating Pictures
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Purpose-built operational views combining your frameworks, entities, and live data feeds.
            </p>
          </div>
          <Button onClick={() => setShowWizard(true)}>
            <Plus className="w-4 h-4 mr-1" />
            New COP
          </Button>
        </div>

        {loading ? (
          <div className="text-gray-500 text-center py-12">Loading...</div>
        ) : sessions.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="py-12 text-center">
              <Map className="w-12 h-12 mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400 mb-4">No COP sessions yet. Create one to get started.</p>
              <Button onClick={() => setShowWizard(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Create Your First COP
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map(s => {
              const Icon = TEMPLATE_ICONS[s.template_type] || Map
              return (
                <Card
                  key={s.id}
                  className="bg-gray-900 border-gray-800 hover:border-gray-700 cursor-pointer transition"
                  onClick={() => navigate(`/dashboard/cop/${s.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-blue-400" />
                        <CardTitle className="text-sm text-white">{s.name}</CardTitle>
                      </div>
                      <Badge variant={s.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {s.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {s.description && (
                      <p className="text-xs text-gray-500 mb-2 line-clamp-2">{s.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{s.active_layers.length} layers</span>
                      <span>{new Date(s.updated_at).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Write the main COP page**

Create `src/pages/CopPage.tsx`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Share2, Download, Radio, RefreshCw,
} from 'lucide-react'
import type { CopSession, CopFeatureCollection } from '@/types/cop'
import { CopMap } from '@/components/cop/CopMap'
import { CopLayerPanel } from '@/components/cop/CopLayerPanel'
import { COP_LAYERS } from '@/components/cop/CopLayerCatalog'

function getAuthHeaders(): HeadersInit {
  const userHash = localStorage.getItem('omnicore_user_hash')
  return { ...(userHash && { Authorization: `Bearer ${userHash}` }) }
}

export default function CopPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<CopSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [layers, setLayers] = useState<Record<string, CopFeatureCollection>>({})
  const [layerCounts, setLayerCounts] = useState<Record<string, number>>({})
  const [activeLayers, setActiveLayers] = useState<string[]>([])

  // Load session
  useEffect(() => {
    if (!id) return
    fetch(`/api/cop/sessions/${id}`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then((data: any) => {
        setSession(data)
        setActiveLayers(data.active_layers || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  // Fetch layer data
  const fetchLayer = useCallback(async (layerId: string) => {
    if (!id) return
    const layerDef = COP_LAYERS.find(l => l.id === layerId)
    if (!layerDef || layerDef.source.type === 'static') return

    try {
      const res = await fetch(`/api/cop/${id}${layerDef.source.endpoint}`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) return
      const geojson = await res.json() as CopFeatureCollection
      setLayers(prev => ({ ...prev, [layerId]: geojson }))
      setLayerCounts(prev => ({ ...prev, [layerId]: geojson.features?.length ?? 0 }))
    } catch (error) {
      console.error(`Failed to fetch layer ${layerId}:`, error)
    }
  }, [id])

  // Load active layers
  useEffect(() => {
    activeLayers.forEach(layerId => {
      if (!layers[layerId]) fetchLayer(layerId)
    })
  }, [activeLayers, fetchLayer])

  // Auto-refresh layers
  useEffect(() => {
    const intervals: NodeJS.Timeout[] = []
    for (const layerId of activeLayers) {
      const layerDef = COP_LAYERS.find(l => l.id === layerId)
      if (layerDef?.source.refreshSeconds) {
        intervals.push(setInterval(() => fetchLayer(layerId), layerDef.source.refreshSeconds * 1000))
      }
    }
    return () => intervals.forEach(clearInterval)
  }, [activeLayers, fetchLayer])

  function handleToggleLayer(layerId: string) {
    setActiveLayers(prev => {
      const next = prev.includes(layerId) ? prev.filter(l => l !== layerId) : [...prev, layerId]
      // Persist to server
      if (id) {
        fetch(`/api/cop/sessions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ active_layers: next }),
        }).catch(console.error)
      }
      return next
    })
  }

  function handleMapClick(lngLat: { lng: number; lat: number }) {
    // Future: open marker creation dialog
    console.log('Map clicked:', lngLat)
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">Loading COP...</div>
  if (!session) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">COP not found</div>

  // Filter layers to only active ones
  const visibleLayers: Record<string, CopFeatureCollection> = {}
  for (const layerId of activeLayers) {
    if (layers[layerId]) visibleLayers[layerId] = layers[layerId]
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-900">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/cop')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">{session.name}</h1>
          {session.key_questions.length > 0 && (
            <p className="text-xs text-gray-500 truncate">
              {session.key_questions[0]}
              {session.key_questions.length > 1 && ` +${session.key_questions.length - 1} more`}
            </p>
          )}
        </div>
        <Badge variant="outline" className="text-xs">{session.template_type.replace('_', ' ')}</Badge>
        <Button variant="ghost" size="sm" onClick={() => activeLayers.forEach(fetchLayer)}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(`/api/cop/${id}/cot`, '_blank')}
          title="Export CoT feed for ATAK"
        >
          <Radio className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm">
          <Share2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Main content: sidebar + map */}
      <div className="flex flex-1 overflow-hidden">
        <CopLayerPanel
          activeLayers={activeLayers}
          onToggleLayer={handleToggleLayer}
          layerCounts={layerCounts}
        />
        <div className="flex-1 relative">
          <CopMap
            session={session}
            layers={visibleLayers}
            onMapClick={handleMapClick}
          />
          {/* KPI strip overlay */}
          {session.key_questions.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 bg-gray-900/90 backdrop-blur rounded-lg p-3 border border-gray-800">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-gray-400 font-medium">Key Questions:</span>
                {session.key_questions.map((q, i) => (
                  <span key={i} className="text-gray-300">{q}</span>
                ))}
                <span className="ml-auto text-gray-600">
                  {Object.values(layerCounts).reduce((a, b) => a + b, 0)} features loaded
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Add routes**

Add to `src/routes/index.tsx`:
- Lazy import: `const CopListPage = lazy(() => import('@/pages/CopListPage'))`
- Lazy import: `const CopPage = lazy(() => import('@/pages/CopPage'))`
- Route: `{ path: '/dashboard/cop', element: <LazyPage Component={CopListPage} /> }`
- Route: `{ path: '/dashboard/cop/:id', element: <LazyPage Component={CopPage} /> }`

**Step 4: Add sidebar nav entry**

Add to `src/components/layout/dashboard-sidebar.tsx` navigation array:
```typescript
{ name: 'Operating Pictures', href: '/dashboard/cop', icon: Map },
```

**Step 5: Commit**

```bash
git add src/pages/CopListPage.tsx src/pages/CopPage.tsx src/routes/index.tsx src/components/layout/dashboard-sidebar.tsx
git commit -m "feat(cop): add COP list page, active COP page with map, and wire routes + sidebar nav"
```

---

## Phase 7: Analysis Overlay + Polish

### Task 14: Create Analysis Layer Endpoint

**Files:**
- Create: `functions/api/cop/[id]/layers/analysis.ts`

**Step 1: Write the analysis overlay endpoint**

This endpoint returns entity data enriched with deception scores and framework analysis as GeoJSON, used by the `deception-risk` and `framework-overlay` layers.

```typescript
import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)
  const analysisType = url.searchParams.get('type') || 'deception'

  try {
    const session = await env.DB.prepare(
      'SELECT workspace_id, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first<any>()

    if (!session) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    if (analysisType === 'deception') {
      // Get actors with MOM assessments that have locations
      const rows = await env.DB.prepare(`
        SELECT a.id, a.name, a.actor_type, p.coordinates,
               m.motive_score, m.opportunity_score, m.means_score
        FROM actors a
        JOIN relationships r ON r.source_entity_id = a.id
          AND r.source_entity_type = 'ACTOR'
          AND r.relationship_type = 'LOCATED_AT'
        JOIN places p ON p.id = r.target_entity_id
          AND r.target_entity_type = 'PLACE'
        LEFT JOIN mom_assessments m ON m.actor_id = a.id
        WHERE a.workspace_id = ?
          AND p.coordinates IS NOT NULL
        LIMIT 200
      `).bind(session.workspace_id).all()

      const features = (rows.results || []).filter((r: any) => {
        try { JSON.parse(r.coordinates); return true } catch { return false }
      }).map((row: any) => {
        const coords = JSON.parse(row.coordinates)
        const riskScore = ((row.motive_score || 0) + (row.opportunity_score || 0) + (row.means_score || 0)) / 3
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [coords.lng, coords.lat] },
          properties: {
            id: row.id,
            name: row.name,
            risk_score: Math.round(riskScore * 20), // 0-100 scale
            motive: row.motive_score,
            opportunity: row.opportunity_score,
            means: row.means_score,
            entity_type: 'deception',
          },
        }
      })

      return new Response(JSON.stringify({ type: 'FeatureCollection', features }), { headers: corsHeaders })
    }

    // Framework overlay — return framework sessions with linked entities that have coordinates
    return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Analysis Layer] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch analysis layer' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 2: Commit**

```bash
git add functions/api/cop/\[id\]/layers/analysis.ts
git commit -m "feat(cop): add deception risk analysis overlay GeoJSON endpoint"
```

---

### Task 15: Add KV Binding to wrangler.toml

**Files:**
- Modify: `wrangler.toml`

**Step 1: Check current wrangler.toml for existing KV bindings**

Read `wrangler.toml` to find existing bindings.

**Step 2: Add COP_CACHE KV namespace binding**

Add under the existing KV bindings:
```toml
[[kv_namespaces]]
binding = "COP_CACHE"
id = "<created-after-wrangler-kv-create>"
```

**Step 3: Create the KV namespace**

Run: `npx wrangler kv namespace create COP_CACHE`
Expected: Returns namespace ID to put in wrangler.toml

**Step 4: Commit**

```bash
git add wrangler.toml
git commit -m "feat(cop): add COP_CACHE KV namespace for external feed caching"
```

---

## Summary

| Phase | Tasks | What It Delivers |
|-------|-------|-----------------|
| 1: Foundation | Tasks 1-3 | DB tables, types, MapLibre dependency |
| 2: Session CRUD | Task 4 | Create/read/update/archive COP sessions |
| 3: Entity Layers | Tasks 5-6 | Layer catalog + 4 entity GeoJSON endpoints |
| 4: External Feeds | Tasks 7-8 | ACLED + GDELT proxy with KV caching |
| 5: Tactical + CoT | Task 9 | Markers CRUD + CoT serializer + ATAK export |
| 6: Frontend | Tasks 10-13 | Map component, layer panel, wizard, pages, routes |
| 7: Polish | Tasks 14-15 | Analysis overlays, KV binding |

**Total: 15 tasks across 7 phases**

After completion you will have:
- A wizard that creates purpose-built COP sessions from templates
- MapLibre GL map rendering 10 data layers (entities + ACLED + GDELT + analysis + tactical)
- ATAK/CoT XML export at `/api/cop/:id/cot`
- Layer toggle sidebar with category grouping
- Session list page with create/archive/share
- KV-cached external data feeds
