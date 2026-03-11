# COP Phase 5: Standard Export Formats — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add export capabilities for GeoJSON bundles, KML/KMZ, extended CoT XML, STIX 2.1, and CSV — with R2 storage for generated files and an export history table.

**Architecture:** Modular serializer pattern (one file per format) orchestrated by `export-bundle.ts`. Small exports run in-request; large ones queue to Cloudflare Queue. Export history tracked in `cop_exports` table. Files stored in R2 with signed download URLs.

**Tech Stack:** Cloudflare Workers, D1, R2, Queues, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-11-cop-enhancement-design.md` (Phase 5)

**Depends on:** Phase 1 (Event System), Phase 4 (Assets — for asset layer export)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `schema/migrations/077-add-cop-exports.sql` | Create | cop_exports table |
| `src/types/cop.ts` | Modify | Add export interfaces |
| `src/lib/export/geojson-serializer.ts` | Create | GeoJSON bundle generator |
| `src/lib/export/kml-serializer.ts` | Create | KML/KMZ generator |
| `src/lib/export/stix-serializer.ts` | Create | STIX 2.1 bundle generator |
| `src/lib/export/csv-serializer.ts` | Create | CSV per entity type |
| `src/lib/export/cot-serializer.ts` | Create | Extended CoT (moved + enhanced) |
| `src/lib/export/export-bundle.ts` | Create | Format orchestrator + R2 upload |
| `functions/api/cop/[id]/export.ts` | Create | POST request export |
| `functions/api/cop/[id]/exports.ts` | Create | GET list past exports |
| `functions/api/cop/[id]/exports/[exportId]/download.ts` | Create | GET signed R2 URL |
| `src/components/cop/CopExportDialog.tsx` | Create | Export UI dialog |
| `tests/e2e/smoke/cop-export.spec.ts` | Create | E2E tests |

---

## Chunk 1: Schema + Types + Serializers

### Task 1: Create exports migration

**Files:**
- Create: `schema/migrations/077-add-cop-exports.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 077: Add COP export history for tracking generated files

CREATE TABLE IF NOT EXISTS cop_exports (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  format TEXT NOT NULL,  -- 'geojson', 'kml', 'cot', 'stix', 'csv'
  scope TEXT DEFAULT 'full',  -- 'full', 'layers', 'entities', 'evidence', 'tasks'
  filters_json TEXT DEFAULT '{}',
  file_url TEXT,
  file_size_bytes INTEGER,
  status TEXT DEFAULT 'pending',  -- 'pending', 'generating', 'completed', 'failed'
  error_message TEXT,

  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_exports_session ON cop_exports(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_exports_status ON cop_exports(status);
```

- [ ] **Step 2: Commit**

```bash
git add schema/migrations/077-add-cop-exports.sql
git commit -m "feat(cop): add cop_exports table (077)"
```

---

### Task 2: Add export types

**Files:**
- Modify: `src/types/cop.ts`

- [ ] **Step 1: Add interfaces**

```typescript
// -- COP Exports (Phase 5: Standard Export Formats) --

export type ExportFormat = 'geojson' | 'kml' | 'cot' | 'stix' | 'csv'
export type ExportScope = 'full' | 'layers' | 'entities' | 'evidence' | 'tasks'
export type ExportStatus = 'pending' | 'generating' | 'completed' | 'failed'

export interface CopExport {
  id: string
  cop_session_id: string
  format: ExportFormat
  scope: ExportScope
  filters_json: Record<string, unknown>
  file_url: string | null
  file_size_bytes: number | null
  status: ExportStatus
  error_message: string | null
  created_by: number
  created_at: string
}

export const EXPORT_FORMAT_CONFIG: Record<ExportFormat, { label: string; ext: string; description: string }> = {
  geojson: { label: 'GeoJSON Bundle', ext: '.geojson.zip', description: 'Machine-readable map data' },
  kml: { label: 'KML/KMZ', ext: '.kmz', description: 'Google Earth compatible' },
  cot: { label: 'CoT XML', ext: '.cot.zip', description: 'Cursor on Target (TAK)' },
  stix: { label: 'STIX 2.1', ext: '.stix.json', description: 'Cyber threat intel standard' },
  csv: { label: 'CSV', ext: '.csv.zip', description: 'Spreadsheet-friendly tables' },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/cop.ts
git commit -m "feat(cop): add export format types and config"
```

---

### Task 3: Create GeoJSON serializer

**Files:**
- Create: `src/lib/export/geojson-serializer.ts`

- [ ] **Step 1: Write the serializer**

```typescript
/**
 * GeoJSON Bundle Serializer
 * Generates one FeatureCollection per active layer.
 * Returns a map of { layerName: GeoJSON string }.
 */

export interface GeoJsonBundle {
  layers: Record<string, string>  // layerId -> GeoJSON string
  metadata: string                 // session metadata JSON
}

export function serializeGeoJsonBundle(
  session: any,
  layerData: Record<string, any>  // layerId -> FeatureCollection
): GeoJsonBundle {
  const layers: Record<string, string> = {}

  for (const [layerId, featureCollection] of Object.entries(layerData)) {
    layers[`${layerId}.geojson`] = JSON.stringify(featureCollection, null, 2)
  }

  const metadata = JSON.stringify({
    session_id: session.id,
    session_name: session.name,
    template_type: session.template_type,
    exported_at: new Date().toISOString(),
    bbox: session.bbox_min_lat ? {
      min_lat: session.bbox_min_lat,
      min_lon: session.bbox_min_lon,
      max_lat: session.bbox_max_lat,
      max_lon: session.bbox_max_lon,
    } : null,
    layer_count: Object.keys(layers).length,
    total_features: Object.values(layerData).reduce(
      (sum, fc) => sum + (fc.features?.length || 0), 0
    ),
  }, null, 2)

  return { layers, metadata }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/export/geojson-serializer.ts
git commit -m "feat(cop): add GeoJSON bundle serializer"
```

---

### Task 4: Create KML serializer

**Files:**
- Create: `src/lib/export/kml-serializer.ts`

- [ ] **Step 1: Write the serializer**

Converts FeatureCollections to KML XML. Maps entity types to styled Placemarks. Relationships as LineStrings. Events get TimeSpan elements. Layers become KML Folders.

```typescript
/**
 * KML Serializer
 * Generates KML XML from GeoJSON FeatureCollections.
 */

const KML_HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>`

const KML_FOOTER = `</Document>
</kml>`

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function featureToPlacemark(feature: any): string {
  const props = feature.properties || {}
  const name = escapeXml(props.name || props.title || props.id || 'Unnamed')
  const desc = escapeXml(props.description || '')
  const coords = feature.geometry?.coordinates

  if (!coords) return ''

  const geomType = feature.geometry.type

  let geometry = ''
  if (geomType === 'Point') {
    geometry = `<Point><coordinates>${coords[0]},${coords[1]},0</coordinates></Point>`
  } else if (geomType === 'LineString') {
    const coordStr = coords.map((c: number[]) => `${c[0]},${c[1]},0`).join(' ')
    geometry = `<LineString><coordinates>${coordStr}</coordinates></LineString>`
  } else if (geomType === 'Polygon') {
    const coordStr = coords[0].map((c: number[]) => `${c[0]},${c[1]},0`).join(' ')
    geometry = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordStr}</coordinates></LinearRing></outerBoundaryIs></Polygon>`
  }

  let timeSpan = ''
  if (props.start_date || props.event_date) {
    const begin = props.start_date || props.event_date
    const end = props.end_date || ''
    timeSpan = `<TimeSpan><begin>${begin}</begin>${end ? `<end>${end}</end>` : ''}</TimeSpan>`
  }

  return `
    <Placemark>
      <name>${name}</name>
      <description>${desc}</description>
      ${timeSpan}
      ${geometry}
    </Placemark>`
}

export function serializeKml(
  session: any,
  layerData: Record<string, any>
): string {
  const folders = Object.entries(layerData).map(([layerId, fc]) => {
    const placemarks = (fc.features || []).map(featureToPlacemark).join('\n')
    return `
  <Folder>
    <name>${escapeXml(layerId)}</name>
    ${placemarks}
  </Folder>`
  }).join('\n')

  return `${KML_HEADER}
  <name>${escapeXml(session.name || 'COP Export')}</name>
  ${folders}
${KML_FOOTER}`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/export/kml-serializer.ts
git commit -m "feat(cop): add KML serializer with TimeSpan and folder structure"
```

---

### Task 5: Create STIX 2.1 serializer

**Files:**
- Create: `src/lib/export/stix-serializer.ts`

- [ ] **Step 1: Write the serializer**

Maps COP entities to STIX Domain Objects:
- Actors → `threat-actor` or `identity`
- Events → `incident`
- Places → `location`
- Evidence → `observed-data`
- Relationships → `relationship`
- Hypotheses → `opinion`

```typescript
/**
 * STIX 2.1 Bundle Serializer
 * Maps COP entities to STIX Cyber Threat Intelligence objects.
 */

interface StixObject {
  type: string
  spec_version: '2.1'
  id: string
  created: string
  modified: string
  [key: string]: unknown
}

function toStixId(type: string, copId: string): string {
  return `${type}--${copId}`
}

export function serializeStixBundle(
  session: any,
  entities: {
    actors?: any[]
    events?: any[]
    places?: any[]
    evidence?: any[]
    relationships?: any[]
    hypotheses?: any[]
  }
): string {
  const objects: StixObject[] = []
  const now = new Date().toISOString()

  // Identity for the COP session itself
  objects.push({
    type: 'identity',
    spec_version: '2.1',
    id: toStixId('identity', session.id),
    created: session.created_at,
    modified: session.updated_at || now,
    name: session.name,
    identity_class: 'organization',
    description: `COP Session: ${session.name}`,
  })

  // Actors -> threat-actor or identity
  for (const actor of (entities.actors || [])) {
    objects.push({
      type: actor.type === 'ORGANIZATION' ? 'identity' : 'threat-actor',
      spec_version: '2.1',
      id: toStixId(actor.type === 'ORGANIZATION' ? 'identity' : 'threat-actor', actor.id),
      created: actor.created_at || now,
      modified: actor.updated_at || now,
      name: actor.name,
      description: actor.description || '',
      ...(actor.type !== 'ORGANIZATION' && { threat_actor_types: [actor.category || 'unknown'] }),
    })
  }

  // Events -> incident
  for (const event of (entities.events || [])) {
    objects.push({
      type: 'incident',
      spec_version: '2.1',
      id: toStixId('incident', event.id),
      created: event.created_at || now,
      modified: event.updated_at || now,
      name: event.name || event.title,
      description: event.description || '',
    })
  }

  // Places -> location
  for (const place of (entities.places || [])) {
    const coords = typeof place.coordinates === 'string'
      ? JSON.parse(place.coordinates) : place.coordinates
    objects.push({
      type: 'location',
      spec_version: '2.1',
      id: toStixId('location', place.id),
      created: place.created_at || now,
      modified: place.updated_at || now,
      name: place.name,
      description: place.description || '',
      ...(coords && { latitude: coords.lat, longitude: coords.lng }),
    })
  }

  // Evidence -> observed-data
  for (const ev of (entities.evidence || [])) {
    objects.push({
      type: 'observed-data',
      spec_version: '2.1',
      id: toStixId('observed-data', ev.id),
      created: ev.created_at || now,
      modified: ev.updated_at || now,
      first_observed: ev.created_at || now,
      last_observed: ev.updated_at || now,
      number_observed: 1,
      object_refs: [],
    })
  }

  // Relationships
  for (const rel of (entities.relationships || [])) {
    objects.push({
      type: 'relationship',
      spec_version: '2.1',
      id: toStixId('relationship', rel.id),
      created: rel.created_at || now,
      modified: rel.updated_at || now,
      relationship_type: (rel.relationship_type || 'related-to').toLowerCase().replace(/_/g, '-'),
      source_ref: toStixId(mapEntityType(rel.source_entity_type), rel.source_entity_id),
      target_ref: toStixId(mapEntityType(rel.target_entity_type), rel.target_entity_id),
    })
  }

  // Hypotheses -> opinion
  for (const hyp of (entities.hypotheses || [])) {
    objects.push({
      type: 'opinion',
      spec_version: '2.1',
      id: toStixId('opinion', hyp.id),
      created: hyp.created_at || now,
      modified: hyp.updated_at || now,
      explanation: hyp.statement,
      opinion: mapConfidenceToOpinion(hyp.confidence),
      object_refs: [],
    })
  }

  return JSON.stringify({
    type: 'bundle',
    id: `bundle--${session.id}`,
    objects,
  }, null, 2)
}

function mapEntityType(copType: string): string {
  const map: Record<string, string> = {
    ACTOR: 'threat-actor',
    PERSON: 'threat-actor',
    ORGANIZATION: 'identity',
    EVENT: 'incident',
    PLACE: 'location',
  }
  return map[copType] || 'identity'
}

function mapConfidenceToOpinion(confidence: number): string {
  if (confidence >= 80) return 'strongly-agree'
  if (confidence >= 60) return 'agree'
  if (confidence >= 40) return 'neutral'
  if (confidence >= 20) return 'disagree'
  return 'strongly-disagree'
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/export/stix-serializer.ts
git commit -m "feat(cop): add STIX 2.1 bundle serializer"
```

---

### Task 6: Create CSV serializer

**Files:**
- Create: `src/lib/export/csv-serializer.ts`

- [ ] **Step 1: Write the serializer**

One CSV per entity type. Flat columns, no nested JSON. Returns map of filename→CSV string.

```typescript
/**
 * CSV Serializer
 * One CSV file per entity type with flat columns.
 */

function escapeCsv(value: unknown): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.join(',')
  const dataLines = rows.map(row =>
    headers.map(h => escapeCsv(row[h])).join(',')
  )
  return [headerLine, ...dataLines].join('\n')
}

export function serializeCsvBundle(entities: {
  actors?: any[]
  events?: any[]
  places?: any[]
  evidence?: any[]
  tasks?: any[]
}): Record<string, string> {
  const files: Record<string, string> = {}

  if (entities.actors?.length) {
    files['actors.csv'] = toCsv(
      ['id', 'name', 'type', 'category', 'affiliation', 'description', 'created_at'],
      entities.actors
    )
  }

  if (entities.events?.length) {
    files['events.csv'] = toCsv(
      ['id', 'name', 'type', 'description', 'date', 'location', 'created_at'],
      entities.events
    )
  }

  if (entities.places?.length) {
    files['places.csv'] = toCsv(
      ['id', 'name', 'type', 'description', 'lat', 'lon', 'created_at'],
      entities.places.map((p: any) => {
        const coords = typeof p.coordinates === 'string' ? JSON.parse(p.coordinates) : p.coordinates
        return { ...p, lat: coords?.lat, lon: coords?.lng }
      })
    )
  }

  if (entities.evidence?.length) {
    files['evidence.csv'] = toCsv(
      ['id', 'title', 'type', 'source_url', 'confidence', 'created_at'],
      entities.evidence
    )
  }

  if (entities.tasks?.length) {
    files['tasks.csv'] = toCsv(
      ['id', 'title', 'status', 'priority', 'task_type', 'assigned_to', 'due_date', 'completed_at'],
      entities.tasks
    )
  }

  return files
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/export/csv-serializer.ts
git commit -m "feat(cop): add CSV serializer with flat columns"
```

---

## Chunk 2: Export Orchestrator + API

### Task 7: Create export bundle orchestrator

**Files:**
- Create: `src/lib/export/export-bundle.ts`

- [ ] **Step 1: Write the orchestrator**

Selects the right serializer based on format, fetches data from layer/entity endpoints, serializes, and returns the result. R2 upload is handled by the API endpoint.

- [ ] **Step 2: Commit**

```bash
git add src/lib/export/export-bundle.ts
git commit -m "feat(cop): add export bundle orchestrator"
```

---

### Task 8: Create export request endpoint

**Files:**
- Create: `functions/api/cop/[id]/export.ts`

- [ ] **Step 1: Write POST endpoint**

Accepts `{ format, scope, filters }`. Creates `cop_exports` row with status `generating`. Fetches all relevant data, runs serializer, uploads to R2, updates row with `file_url` and `completed` status. Emits `export.completed` or `export.failed`.

For R2 upload, use the R2 binding from `env.EXPORTS_BUCKET` (needs to be added to `wrangler.toml`).

- [ ] **Step 2: Commit**

```bash
git add functions/api/cop/[id]/export.ts
git commit -m "feat(cop): add export request endpoint with R2 upload"
```

---

### Task 9: Create export list and download endpoints

**Files:**
- Create: `functions/api/cop/[id]/exports.ts`
- Create: `functions/api/cop/[id]/exports/[exportId]/download.ts`

- [ ] **Step 1: Write exports list GET**

Returns past exports for the session, ordered by created_at DESC.

- [ ] **Step 2: Write download endpoint**

Generates a signed R2 URL (or streams directly) for the export file.

- [ ] **Step 3: Commit**

```bash
git add functions/api/cop/[id]/exports.ts functions/api/cop/[id]/exports/[exportId]/download.ts
git commit -m "feat(cop): add export history list and download endpoints"
```

---

## Chunk 3: Frontend + Tests

### Task 10: Create CopExportDialog

**Files:**
- Create: `src/components/cop/CopExportDialog.tsx`

- [ ] **Step 1: Write the component**

Modal dialog with:
- Format radio buttons (GeoJSON, KML, CoT, STIX, CSV) with descriptions
- Scope selector (full, layers only, entities only, etc.)
- Layer checkboxes (only for layer scope)
- "Export" button that triggers POST, shows progress, then download link
- Past exports list at bottom

- [ ] **Step 2: Commit**

```bash
git add src/components/cop/CopExportDialog.tsx
git commit -m "feat(cop): add CopExportDialog with format picker"
```

---

### Task 11: E2E tests

- [ ] **Step 1: Write tests covering format selection, export request, and download**
- [ ] **Step 2: Commit**

```bash
git add tests/e2e/smoke/cop-export.spec.ts
git commit -m "test(cop): add E2E tests for export system"
```

---

## Summary

| Task | What |
|---|---|
| 1 | Exports migration (077) |
| 2 | Export types |
| 3 | GeoJSON serializer |
| 4 | KML serializer |
| 5 | STIX 2.1 serializer |
| 6 | CSV serializer |
| 7 | Export bundle orchestrator |
| 8 | Export request endpoint |
| 9 | Export list + download endpoints |
| 10 | CopExportDialog UI |
| 11 | E2E tests |
