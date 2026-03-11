# COP Phase 4: Asset & Resource Tracking — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified asset tracker for people, information sources, infrastructure, and digital resources — with map plotting, task allocation, status audit trail, and quota monitoring.

**Architecture:** Single `cop_assets` table with type-specific JSON `details` column. `cop_asset_log` for status change audit. New `assets` map layer. Integrates with task assignment and the event system.

**Tech Stack:** Cloudflare Workers, D1, TypeScript, React, MapLibre

**Spec:** `docs/superpowers/specs/2026-03-11-cop-enhancement-design.md` (Phase 4)

**Depends on:** Phase 1 (Event System)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `schema/migrations/076-add-cop-assets.sql` | Create | cop_assets + cop_asset_log tables |
| `src/types/cop.ts` | Modify | Add asset interfaces |
| `functions/api/cop/[id]/assets.ts` | Create | GET/POST/PUT/DELETE assets |
| `functions/api/cop/[id]/assets/[assetId]/check-in.ts` | Create | Status update with log |
| `functions/api/cop/[id]/assets/[assetId]/log.ts` | Create | Audit trail GET |
| `functions/api/cop/[id]/layers/assets.ts` | Create | GeoJSON layer endpoint |
| `src/components/cop/CopAssetPanel.tsx` | Create | Tabbed asset list UI |
| `src/components/cop/CopAssetDetailDrawer.tsx` | Create | Asset detail + history |
| `src/components/cop/CopResourceGauge.tsx` | Create | Quota gauge component |
| `src/components/cop/CopLayerCatalog.ts` | Modify | Add assets layer definition |
| `tests/e2e/smoke/cop-assets.spec.ts` | Create | E2E tests |

---

## Chunk 1: Schema + Types

### Task 1: Create assets migration

**Files:**
- Create: `schema/migrations/076-add-cop-assets.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 076: Add COP asset tracking for people, sources, infrastructure, digital resources
-- Single table with type-specific JSON details column.

CREATE TABLE IF NOT EXISTS cop_assets (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  asset_type TEXT NOT NULL,  -- 'human', 'source', 'infrastructure', 'digital'
  name TEXT NOT NULL,
  status TEXT DEFAULT 'available',  -- 'available', 'deployed', 'degraded', 'offline', 'compromised', 'exhausted'
  details TEXT DEFAULT '{}',
  assigned_to_task_id TEXT,
  location TEXT,
  lat REAL,
  lon REAL,
  sensitivity TEXT DEFAULT 'unclassified',  -- 'unclassified', 'internal', 'restricted'
  last_checked_at TEXT,
  notes TEXT,

  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_assets_session ON cop_assets(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_assets_type ON cop_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_cop_assets_status ON cop_assets(status);
CREATE INDEX IF NOT EXISTS idx_cop_assets_task ON cop_assets(assigned_to_task_id);

CREATE TABLE IF NOT EXISTS cop_asset_log (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  cop_session_id TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (asset_id) REFERENCES cop_assets(id),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_asset_log_asset ON cop_asset_log(asset_id);
CREATE INDEX IF NOT EXISTS idx_cop_asset_log_session ON cop_asset_log(cop_session_id);
```

- [ ] **Step 2: Commit**

```bash
git add schema/migrations/076-add-cop-assets.sql
git commit -m "feat(cop): add cop_assets and cop_asset_log tables (076)"
```

---

### Task 2: Add TypeScript interfaces

**Files:**
- Modify: `src/types/cop.ts`

- [ ] **Step 1: Add asset types**

```typescript
// -- COP Assets (Phase 4: Asset & Resource Tracking) --

export type AssetType = 'human' | 'source' | 'infrastructure' | 'digital'
export type AssetStatus = 'available' | 'deployed' | 'degraded' | 'offline' | 'compromised' | 'exhausted'
export type AssetSensitivity = 'unclassified' | 'internal' | 'restricted'

export interface HumanAssetDetails {
  skills: string[]
  timezone: string
  languages: string[]
  hours_available_per_week: number
  current_load: number
}

export interface SourceAssetDetails {
  source_type: 'humint' | 'sigint' | 'osint' | 'geoint'
  reliability_rating: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  access_status: 'active' | 'intermittent' | 'denied' | 'unknown'
  coverage_area: string
  last_contact: string
  linked_source_id: string
}

export interface InfraAssetDetails {
  infra_type: 'server' | 'vpn' | 'account' | 'device' | 'platform'
  provider: string
  expiry_date: string
  opsec_notes: string
  shared_by: string[]
}

export interface DigitalAssetDetails {
  resource_type: 'api_quota' | 'license' | 'dataset' | 'document'
  total_units: number
  used_units: number
  reset_date: string
  cost_per_unit: number
  currency: string
}

export type AssetDetails = HumanAssetDetails | SourceAssetDetails | InfraAssetDetails | DigitalAssetDetails

export interface CopAsset {
  id: string
  cop_session_id: string
  asset_type: AssetType
  name: string
  status: AssetStatus
  details: AssetDetails
  assigned_to_task_id: string | null
  location: string | null
  lat: number | null
  lon: number | null
  sensitivity: AssetSensitivity
  last_checked_at: string | null
  notes: string | null
  created_by: number
  workspace_id: string
  created_at: string
  updated_at: string
}

export interface CopAssetLog {
  id: string
  asset_id: string
  cop_session_id: string
  previous_status: string | null
  new_status: string
  changed_by: number
  reason: string | null
  created_at: string
}

export const ASSET_TYPE_CONFIG: Record<AssetType, { label: string; color: string }> = {
  human: { label: 'People', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  source: { label: 'Sources', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  infrastructure: { label: 'Infrastructure', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  digital: { label: 'Digital', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
}

export const ASSET_STATUS_CONFIG: Record<AssetStatus, { label: string; color: string }> = {
  available: { label: 'Available', color: 'bg-green-500' },
  deployed: { label: 'Deployed', color: 'bg-blue-500' },
  degraded: { label: 'Degraded', color: 'bg-yellow-500' },
  offline: { label: 'Offline', color: 'bg-gray-500' },
  compromised: { label: 'Compromised', color: 'bg-red-500' },
  exhausted: { label: 'Exhausted', color: 'bg-red-800' },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/cop.ts
git commit -m "feat(cop): add asset tracking TypeScript interfaces"
```

---

## Chunk 2: Backend API

### Task 3: Create assets CRUD endpoint

**Files:**
- Create: `functions/api/cop/[id]/assets.ts`

- [ ] **Step 1: Write GET/POST/PUT/DELETE endpoint**

Follow the existing tasks.ts pattern. GET supports filtering by `asset_type` and `status` query params. POST validates asset_type enum. PUT uses dynamic update pattern. DELETE is soft (sets status to 'offline') or hard based on query param.

Parse `details` JSON on read, stringify on write.

Emit `ASSET_CREATED` on POST, `ASSET_UPDATED` on PUT, `ASSET_STATUS_CHANGED` when status changes.

For digital assets, check `used_units / total_units > 0.8` after updates and emit `ASSET_QUOTA_LOW` if threshold crossed.

- [ ] **Step 2: Commit**

```bash
git add functions/api/cop/[id]/assets.ts
git commit -m "feat(cop): add assets CRUD endpoint with event emission"
```

---

### Task 4: Create check-in endpoint

**Files:**
- Create: `functions/api/cop/[id]/assets/[assetId]/check-in.ts`

- [ ] **Step 1: Write the endpoint**

POST body: `{ status, reason }`. Updates asset status, creates `cop_asset_log` entry, sets `last_checked_at`, emits `ASSET_STATUS_CHANGED`.

```typescript
import { getUserIdOrDefault } from '../../../../_shared/auth-helpers'
import { emitCopEvent } from '../../../../_shared/cop-events'
import { ASSET_STATUS_CHANGED } from '../../../../_shared/cop-event-types'

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `alog-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const assetId = params.assetId as string
  const userId = await getUserIdOrDefault(request, env)

  try {
    const body = await request.json() as any
    const VALID_STATUSES = ['available', 'deployed', 'degraded', 'offline', 'compromised', 'exhausted']

    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      return new Response(JSON.stringify({ error: 'Valid status required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const existing = await env.DB.prepare(
      'SELECT * FROM cop_assets WHERE id = ? AND cop_session_id = ?'
    ).bind(assetId, sessionId).first() as any

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Asset not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const now = new Date().toISOString()

    // Update asset
    await env.DB.prepare(
      'UPDATE cop_assets SET status = ?, last_checked_at = ?, updated_at = ? WHERE id = ?'
    ).bind(body.status, now, now, assetId).run()

    // Create log entry
    const logId = generateId()
    await env.DB.prepare(`
      INSERT INTO cop_asset_log (id, asset_id, cop_session_id, previous_status, new_status, changed_by, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(logId, assetId, sessionId, existing.status, body.status, userId, body.reason || null).run()

    // Emit event
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: ASSET_STATUS_CHANGED,
      entityType: 'asset',
      entityId: assetId,
      payload: {
        name: existing.name,
        asset_type: existing.asset_type,
        previous_status: existing.status,
        new_status: body.status,
        reason: body.reason || null,
      },
      createdBy: userId,
    })

    return new Response(JSON.stringify({ message: 'Asset status updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Asset Check-in] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to check in asset' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/cop/[id]/assets/[assetId]/check-in.ts
git commit -m "feat(cop): add asset check-in endpoint with audit log"
```

---

### Task 5: Create asset log endpoint

**Files:**
- Create: `functions/api/cop/[id]/assets/[assetId]/log.ts`

- [ ] **Step 1: Write GET endpoint**

Returns audit trail for a specific asset, ordered by created_at DESC.

- [ ] **Step 2: Commit**

```bash
git add functions/api/cop/[id]/assets/[assetId]/log.ts
git commit -m "feat(cop): add asset audit log GET endpoint"
```

---

### Task 6: Create assets GeoJSON layer endpoint

**Files:**
- Create: `functions/api/cop/[id]/layers/assets.ts`

- [ ] **Step 1: Write the endpoint**

Follow the actors layer pattern. Query assets with non-null lat/lon. Return GeoJSON FeatureCollection with properties including asset_type, status, name, sensitivity.

```typescript
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  try {
    const url = new URL(request.url)
    const bbox = url.searchParams.get('bbox')

    let query = `
      SELECT id, name, asset_type, status, sensitivity, location, lat, lon, details
      FROM cop_assets
      WHERE cop_session_id = ? AND lat IS NOT NULL AND lon IS NOT NULL
    `
    const bindings: any[] = [sessionId]

    if (bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number)
      query += ' AND lon >= ? AND lon <= ? AND lat >= ? AND lat <= ?'
      bindings.push(minLon, maxLon, minLat, maxLat)
    }

    query += ' LIMIT 500'

    const results = await env.DB.prepare(query).bind(...bindings).all()

    const features = (results.results || []).map((row: any) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [row.lon, row.lat],
      },
      properties: {
        id: row.id,
        name: row.name,
        asset_type: row.asset_type,
        status: row.status,
        sensitivity: row.sensitivity,
        location: row.location,
        entity_type: 'asset',
      },
    }))

    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features,
    }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Assets Layer] Error:', error)
    return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/cop/[id]/layers/assets.ts
git commit -m "feat(cop): add assets GeoJSON layer endpoint"
```

---

## Chunk 3: Frontend Components

### Task 7: Add assets layer to catalog

**Files:**
- Modify: `src/components/cop/CopLayerCatalog.ts`

- [ ] **Step 1: Add the layer definition**

```typescript
{
  id: 'assets',
  name: 'Assets & Resources',
  category: 'operational',
  source: 'api',
  endpoint: '/layers/assets',
  render: 'cluster',
  icon: 'briefcase',
  defaultTemplates: ['crisis_response', 'area_study', 'event_monitor'],
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cop/CopLayerCatalog.ts
git commit -m "feat(cop): add assets layer to layer catalog"
```

---

### Task 8: Create CopAssetPanel

**Files:**
- Create: `src/components/cop/CopAssetPanel.tsx`

- [ ] **Step 1: Write the component**

Tabbed panel showing assets grouped by type (People / Sources / Infra / Digital). Each tab shows:
- Asset cards with name, status badge, location
- Quick status change buttons
- For digital assets: quota bar (used/total)
- Filter by status
- "Add Asset" form

Follow CopTaskBoard patterns for state, fetch, polling, optimistic updates.

- [ ] **Step 2: Commit**

```bash
git add src/components/cop/CopAssetPanel.tsx
git commit -m "feat(cop): add CopAssetPanel tabbed asset list component"
```

---

### Task 9: Create CopResourceGauge

**Files:**
- Create: `src/components/cop/CopResourceGauge.tsx`

- [ ] **Step 1: Write the component**

Small visual gauge for digital resource quotas. Shows used/total with color thresholds:
- Green: <60% used
- Yellow: 60-80% used
- Red: >80% used

```typescript
interface CopResourceGaugeProps {
  used: number
  total: number
  label: string
  unit?: string
}

export default function CopResourceGauge({ used, total, label, unit = '' }: CopResourceGaugeProps) {
  const pct = total > 0 ? (used / total) * 100 : 0
  const color = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-green-500'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{used}{unit} / {total}{unit}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cop/CopResourceGauge.tsx
git commit -m "feat(cop): add CopResourceGauge quota visualization component"
```

---

### Task 10: Create CopAssetDetailDrawer

**Files:**
- Create: `src/components/cop/CopAssetDetailDrawer.tsx`

- [ ] **Step 1: Write the component**

Drawer/overlay showing full asset details + status history timeline. Includes:
- Type-specific detail fields (rendered from details JSON)
- Status change form (select new status + reason text)
- Audit log timeline (fetched from `/assets/:id/log`)
- Task allocation info (which task this asset is assigned to)

- [ ] **Step 2: Commit**

```bash
git add src/components/cop/CopAssetDetailDrawer.tsx
git commit -m "feat(cop): add CopAssetDetailDrawer with status history"
```

---

## Chunk 4: Tests

### Task 11: E2E tests + migration

- [ ] **Step 1: Write tests**

Cover:
- Asset CRUD operations
- Check-in creates log entry
- GeoJSON layer returns assets with coordinates
- Quota gauge renders for digital assets
- Status filter works

- [ ] **Step 2: Apply migration and run**

```bash
npx wrangler d1 execute researchtoolspy-db --local --file=schema/migrations/076-add-cop-assets.sql
npx playwright test tests/e2e/smoke/cop-assets.spec.ts --reporter=list
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/smoke/cop-assets.spec.ts
git commit -m "test(cop): add E2E tests for asset tracking"
```

---

## Summary

| Task | What |
|---|---|
| 1 | Assets + log migration (076) |
| 2 | Asset types in cop.ts |
| 3 | Assets CRUD endpoint |
| 4 | Check-in endpoint + audit log |
| 5 | Asset log GET endpoint |
| 6 | Assets GeoJSON layer |
| 7 | Layer catalog addition |
| 8 | CopAssetPanel UI |
| 9 | CopResourceGauge component |
| 10 | CopAssetDetailDrawer |
| 11 | E2E tests |
