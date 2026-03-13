# Timeline as Hub — Design Spec

> COP Timeline panel becomes the central chronological record for both real-world investigative events and investigation actions, with AI-powered smart defaults and cross-panel linking.

## Problem

The Timeline panel is isolated from the rest of the COP dashboard. Claims can promote to evidence, evidence pins to the map, but timeline events have zero cross-panel connections. Manual entry is bare-bones (single text field). As investigations scale, the timeline needs to be the heartbeat — automatically capturing investigation milestones while supporting rich manual event entry.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data architecture | Single table (`cop_timeline_entries`) for all timeline data | Simpler queries, server-side dedup, clean filtering |
| Auto-generation trigger | Backend side effects in existing API endpoints | Reliable, no client coordination needed |
| Dedup strategy | Server-side check on `entity_type + entity_id + action` triple | Prevents duplicates without client awareness |
| Manual entry UX | AI smart defaults with editable chips | Fast capture (single field) with rich metadata (no friction) |
| Tab filtering | Events / Activity / All, default to Events | Keeps analyst-entered data front-and-center |
| Visual distinction | Muted styling for system entries, source-type icons | Scannable without cluttering |

## 1. Schema Changes

**Migration 085**: Add three columns to `cop_timeline_entries`:

```sql
ALTER TABLE cop_timeline_entries ADD COLUMN entity_type TEXT;
ALTER TABLE cop_timeline_entries ADD COLUMN entity_id TEXT;
ALTER TABLE cop_timeline_entries ADD COLUMN action TEXT;

CREATE INDEX IF NOT EXISTS idx_cop_timeline_dedup
  ON cop_timeline_entries(cop_session_id, entity_type, entity_id, action);
```

- `entity_type`: `'claim'` | `'evidence'` | `'entity'` | `'hypothesis'` | `'marker'` | `null`
- `entity_id`: ID of the linked record (e.g., `'clm-abc123'`)
- `action`: `'verified'` | `'disputed'` | `'created'` | `'promoted'` | `'extracted'` | `null`
- Existing `source_type` column gains a new value: `'system'` (alongside `'manual'` and `'url_extract'`)

No changes to `cop_claims`, `evidence_items`, or other existing tables.

**Important:** `cop_timeline_entries.created_by` is `INTEGER` (matches `getUserIdOrDefault()` return type). Do NOT cast to string. Note that `cop_claims.created_by` is `TEXT` — these tables intentionally differ.

## 2. Backend — Auto-generation Helper

### Shared helper: `functions/api/_shared/timeline-helper.ts`

```typescript
interface TimelineAutoEntry {
  event_date?: string       // defaults to now
  title: string
  description?: string
  category?: string
  importance?: string
  source_type: 'system'
  entity_type: string
  entity_id: string
  action: string
}

async function createTimelineEntry(
  db: D1Database,
  sessionId: string,
  workspaceId: string,
  userId: number,
  entry: TimelineAutoEntry
): Promise<string | null>
```

**Behavior:**
1. Dedup check (with 5-minute window to allow legitimate re-triggers):
   ```sql
   SELECT id FROM cop_timeline_entries
   WHERE cop_session_id = ? AND entity_type = ? AND entity_id = ? AND action = ?
     AND created_at > datetime('now', '-300 seconds')
   ```
2. If exists, return `null` (skip)
3. If not, insert with `source_type = 'system'` and return new ID
4. Fire-and-forget: callers should `try/catch` and never block on failure

### Endpoints that call the helper

| Endpoint | Trigger | Title template | Category | Importance |
|----------|---------|---------------|----------|------------|
| `PUT /api/cop/:id/claims` | Claim verified | "Claim verified: {claim_text...}" | legal | high |
| `PUT /api/cop/:id/claims` | Claim disputed | "Claim disputed: {claim_text...}" | event | normal |
| `POST /api/cop/:id/claims` | Claims extracted from URL | "Extracted {n} claims from {domain}" | publication | normal | `entity_id` = source URL hostname (e.g., `'reuters.com'`). Dedup window allows re-extraction after 5 min. |
| `POST /api/cop/:id/evidence` | Evidence added | "Evidence added: {title}" | event | normal |
| `POST /api/cop/:id/markers` | Map pin placed | "Location marked: {label}" | event | low |
| `POST /api/cop/:id/hypotheses` | Hypothesis created | "Hypothesis: {statement...}" | event | high |

Each title is truncated to 200 chars. Description holds the full text when truncated.

**`entity_id` conventions:**
- Single-record actions (verified, disputed, created, promoted): use the record's primary key (e.g., `'clm-abc123'`)
- Batch actions (extracted): use the source URL hostname (e.g., `'reuters.com'`). The 5-minute dedup window allows re-extraction of the same source after a reasonable interval.

**Modifying existing endpoints:** Each endpoint file listed above (`claims.ts` `onRequestPut`, `claims.ts` `onRequestPost`, etc.) adds a `try/catch` call to `createTimelineEntry()` after its primary mutation succeeds. The timeline insert is fire-and-forget — never blocks the primary response. The `'false'` claim status does not generate a timeline entry (only `'verified'` and `'disputed'` do).

## 3. AI Classification Endpoint

### `POST /api/tools/classify-timeline-entry`

**Env interface:**
```typescript
interface Env {
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
  AI_CONFIG: KVNamespace
  CACHE: KVNamespace
}
```

**Request:**
```json
{
  "text": "Emergency board meeting called to discuss sanctions",
  "today": "2026-03-13"
}
```

The `today` field is the client's local date (`new Date().toISOString().slice(0, 10)`), passed to the AI prompt so relative date references ("last Tuesday") resolve correctly regardless of Worker timezone.

**Response:**
```json
{
  "category": "meeting",
  "importance": "high",
  "event_date_hint": null
}
```

**Implementation:**
- Single GPT-4o-mini call via `callOpenAIViaGateway`
- System prompt lists valid categories (`event`, `meeting`, `communication`, `financial`, `legal`, `travel`, `publication`, `military`, `political`) and importance levels (`low`, `normal`, `high`, `critical`)
- `event_date_hint`: If text contains a date reference ("last Tuesday", "March 5"), AI extracts it as ISO date string. Otherwise `null`.
- Response validated field-by-field (never spread raw LLM output):
  - `category`: must be in allowed set, fallback `'event'`
  - `importance`: must be in allowed set, fallback `'normal'`
  - `event_date_hint`: must pass `Date.parse()` check or be null, fallback `null`
- `max_completion_tokens: 100`, `temperature: 0.1`, `response_format: { type: 'json_object' }`
- Cache TTL: standard for classification tasks

**Error handling:** If call fails or exceeds 2s client-side timeout, fall back to `{ category: 'event', importance: 'normal', event_date_hint: null }`. Never block the user.

## 4. Frontend Changes

### 4a. Filter Tabs

Added above the event list inside `CopTimelinePanel`:

```
[ All (24) ]  [ Events (8) ]  [ Activity (16) ]
```

- **Events** tab (default): `source_type IN ('manual', 'url_extract')`
- **Activity** tab: `source_type = 'system'`
- **All** tab: no filter
- All entries fetched on mount (no `source_type` param in initial load). Tab switching is purely client-side filtering over the in-memory list. Counts computed from loaded entries.
- Active tab stored in component state (not persisted — resets to Events on reload)

**API change:** GET `/api/cop/:id/timeline` gains optional `source_type` query param (for future server-side pagination, not used in Phase 1). Implementation must handle CSV values with dynamic `IN` clause:
```typescript
const sourceTypeParam = url.searchParams.get('source_type')
if (sourceTypeParam) {
  const types = sourceTypeParam.split(',').map(t => t.trim()).filter(Boolean)
  const placeholders = types.map(() => '?').join(', ')
  query += ` AND source_type IN (${placeholders})`
  bindings.push(...types)
}
```

### 4b. AI Smart Defaults Flow

1. User types text in input field, hits Add (or Enter)
2. Brief inline spinner replaces the Add button
3. Parallel calls: classify endpoint + save prep
4. On classify response, show editable chips below input:
   - Category chip (colored, tappable to cycle)
   - Importance chip (icon + label, tappable to cycle)
   - Date chip (from `event_date_hint` or date picker value or "today", tappable to open date picker)
5. User can modify any chip, then hits confirm (Enter or checkmark button)
6. Entry saved to DB with final values
7. Chips disappear, input clears

**If user hits Enter again immediately** (before modifying chips): save with the AI defaults. This preserves the fast "type and go" workflow.

### 4c. System Entry Styling

System-generated entries in the timeline list:
- `opacity-75` on the entire row
- Smaller title text (`text-[11px]` vs `text-xs`)
- Source-type icon before the title:
  - Shield icon → claim actions (verified/disputed)
  - FileText icon → evidence actions
  - MapPin icon → marker actions
  - Lightbulb icon → hypothesis actions
- Entity name in the title is a **clickable link** (blue, underlined on hover)

### 4d. Cross-Panel Scrolling

Clicking a linked entity in a system timeline entry:
1. Calls `onScrollToPanel(panelId, entityId)` — new callback prop from `CopWorkspacePage`
2. If the target panel is collapsed, auto-expand it first. `CopPanelExpander` gains a new `forceOpen?: boolean` prop that overrides the collapsed state when true. `CopWorkspacePage` sets `forceOpenPanel` state which is passed to the matching expander and cleared after 3 seconds.
3. `CopWorkspacePage` scrolls to the target panel via `[data-panel="${panelId}"]` + `scrollIntoView({ behavior: 'smooth' })`
4. Target panel receives a `highlightEntityId` prop, applies a 2-second yellow flash (`animate-highlight`) to the matching item
5. If the panel is not in the current mode (progress vs monitor), scroll is a no-op (no mode switching)

**New prop on CopTimelinePanel:**
```typescript
onScrollToPanel?: (panelId: string, entityId: string) => void
```

**Panels that need `highlightEntityId` support:**
- `CopClaimsPanel` — highlight a specific claim by ID
- Other panels can be added incrementally

### 4e. Inline Editing

For manual and url_extract entries only (system entries are read-only):
- **Title**: Click → contentEditable or inline input, save on blur/Enter via PUT
- **Category chip**: Click → cycle through categories, save immediately
- **Importance chip**: Click → cycle through importance levels, save immediately
- **Date**: Click date label → inline date picker, save on change

Changes call `PUT /api/cop/:id/timeline` with `{ entry_id, [changed_field]: value }`.

**Backend constraints for inline editing:**
- `PUT` handler must validate `category` against the allowed enum (same set as classification endpoint). Reject invalid values with 400.
- `PUT` handler should return the updated entry in the response body (not just a message) for optimistic UI reconciliation.

### 4f. System Entry Deletion Guard

`DELETE /api/cop/:id/timeline` must refuse to delete entries where `source_type = 'system'`. Return 403 with `{ error: "System-generated entries cannot be deleted" }`. This prevents a confusing loop where: user deletes system entry → action re-triggers → entry reappears (dedup check finds no existing row since it was hard-deleted).

## 5. Files to Create

| File | Purpose |
|------|---------|
| `schema/migrations/085-timeline-hub-columns.sql` | Add entity_type, entity_id, action columns + dedup index |
| `functions/api/_shared/timeline-helper.ts` | Shared createTimelineEntry() with dedup |
| `functions/api/tools/classify-timeline-entry.ts` | AI classification endpoint |

## 6. Files to Modify

| File | Change |
|------|--------|
| `functions/api/cop/[id]/timeline.ts` | Add `source_type` filter param to GET |
| `functions/api/cop/[id]/claims.ts` | Call createTimelineEntry on verify/dispute/extract |
| `src/components/cop/CopTimelinePanel.tsx` | Filter tabs, AI chips, system entry styling, inline editing, cross-panel scroll |
| `src/components/cop/CopClaimsPanel.tsx` | Add `highlightEntityId` prop support |
| `src/components/cop/CopPanelExpander.tsx` | Add `forceOpen` prop for cross-panel scroll auto-expand |
| `src/pages/CopWorkspacePage.tsx` | Wire `onScrollToPanel` callback, `forceOpenPanel` state, pass to TimelinePanel |

## 7. Files to Modify (Phase 2 — incremental)

These can be wired up after the core is working:

| File | Change |
|------|--------|
| `functions/api/cop/[id]/evidence.ts` | Call createTimelineEntry on evidence creation |
| `functions/api/cop/[id]/markers.ts` | Call createTimelineEntry on pin placement |
| `functions/api/cop/[id]/hypotheses.ts` | Call createTimelineEntry on hypothesis creation |

## Non-Goals

- **Chart visualization**: The timeline is now an event list (the area chart was already replaced in the prior iteration). A chart toggle could be added later but is not part of this spec.
- **File extraction**: Extracting timeline events from uploaded files (PDF, DOCX) is future work.
- **Real-time updates**: No WebSocket/SSE push. Timeline refreshes on mount and after user actions.
- **Timeline export**: No CSV/PDF export of timeline data in this iteration.

## Success Criteria

1. Manual timeline entry with AI-classified category/importance works end-to-end
2. Verifying or disputing a claim in Claims panel auto-creates a timeline entry
3. Extracting claims from a URL auto-creates a timeline entry
4. System entries appear in Activity tab, not in Events tab (default)
5. Clicking a linked entity in a system timeline entry scrolls to the correct panel
6. Dedup prevents duplicate system entries for the same action
7. Inline editing works for manual entries (title, category, importance, date)
