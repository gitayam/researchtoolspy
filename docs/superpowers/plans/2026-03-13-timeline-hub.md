# Timeline as Hub Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the COP Timeline panel the central chronological hub that auto-captures investigation actions, classifies manual entries via AI, and links across panels.

**Architecture:** Single-table approach — all timeline data (manual, URL-extracted, system-generated) lives in `cop_timeline_entries`. A shared `createTimelineEntry()` helper with 5-minute dedup is called fire-and-forget from existing COP API endpoints. Frontend filters client-side with tabs.

**Tech Stack:** React + TypeScript + Tailwind, Cloudflare Workers (Pages Functions), D1 (SQLite), GPT-4o-mini via `callOpenAIViaGateway()`

**Spec:** `docs/superpowers/specs/2026-03-13-timeline-hub-design.md`

---

## Chunk 1: Schema + Backend Foundation

### Task 1: Migration — Add hub columns

**Files:**
- Create: `schema/migrations/085-timeline-hub-columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 085: Add cross-panel linking columns to cop_timeline_entries
-- Enables: system auto-generation, dedup, and entity linking

ALTER TABLE cop_timeline_entries ADD COLUMN entity_type TEXT;
ALTER TABLE cop_timeline_entries ADD COLUMN entity_id TEXT;
ALTER TABLE cop_timeline_entries ADD COLUMN action TEXT;

CREATE INDEX IF NOT EXISTS idx_cop_timeline_dedup
  ON cop_timeline_entries(cop_session_id, entity_type, entity_id, action);
```

- [ ] **Step 2: Apply migration locally**

Run: `npx wrangler d1 execute researchtoolspy-prod --local --file=schema/migrations/085-timeline-hub-columns.sql`
Expected: 4 commands executed successfully

- [ ] **Step 3: Verify columns exist**

Run: `npx wrangler d1 execute researchtoolspy-prod --local --command="PRAGMA table_info(cop_timeline_entries)"`
Expected: Output includes `entity_type`, `entity_id`, `action` columns

- [ ] **Step 4: Commit**

```bash
git add schema/migrations/085-timeline-hub-columns.sql
git commit -m "feat(cop): add entity linking columns to timeline entries (migration 085)"
```

---

### Task 2: Shared timeline helper with dedup

**Files:**
- Create: `functions/api/_shared/timeline-helper.ts`

- [ ] **Step 1: Create the helper**

```typescript
/**
 * Shared helper for creating timeline entries with dedup.
 * Called fire-and-forget from COP API endpoints to auto-generate
 * system timeline entries when investigation actions occur.
 */

export interface TimelineAutoEntry {
  event_date?: string       // defaults to current date
  title: string             // truncated to 200 chars by caller
  description?: string
  category?: string         // event, meeting, communication, financial, legal, etc.
  importance?: string       // low, normal, high, critical
  source_type: 'system'
  entity_type: string       // claim, evidence, entity, hypothesis, marker
  entity_id: string         // primary key of linked record, or hostname for batch
  action: string            // verified, disputed, created, promoted, extracted
}

/**
 * Create a timeline entry with dedup check.
 * Returns the new entry ID, or null if deduped.
 *
 * IMPORTANT: created_by is INTEGER in cop_timeline_entries (not TEXT like cop_claims).
 * Pass userId from getUserIdOrDefault() directly — do NOT cast to string.
 */
export async function createTimelineEntry(
  db: D1Database,
  sessionId: string,
  workspaceId: string,
  userId: number,
  entry: TimelineAutoEntry
): Promise<string | null> {
  // Dedup: skip if matching entry exists within last 5 minutes
  const existing = await db.prepare(
    `SELECT id FROM cop_timeline_entries
     WHERE cop_session_id = ? AND entity_type = ? AND entity_id = ? AND action = ?
       AND created_at > datetime('now', '-300 seconds')`
  ).bind(sessionId, entry.entity_type, entry.entity_id, entry.action).first<{ id: string }>()

  if (existing) return null

  const id = `tle-${crypto.randomUUID().slice(0, 12)}`
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO cop_timeline_entries
      (id, cop_session_id, workspace_id, event_date, title, description, category,
       source_type, importance, entity_type, entity_id, action, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, sessionId, workspaceId,
    entry.event_date || now.slice(0, 10),
    entry.title.slice(0, 200),
    entry.description ?? null,
    entry.category ?? 'event',
    'system',
    entry.importance ?? 'normal',
    entry.entity_type,
    entry.entity_id,
    entry.action,
    userId, // INTEGER — do not cast to string
    now, now,
  ).run()

  return id
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✓ built in` with no errors

- [ ] **Step 3: Commit**

```bash
git add functions/api/_shared/timeline-helper.ts
git commit -m "feat(cop): add shared timeline auto-generation helper with dedup"
```

---

### Task 3: Wire timeline helper into claims endpoints

**Files:**
- Modify: `functions/api/cop/[id]/claims.ts:1-108` (onRequestPost and onRequestPut)

- [ ] **Step 1: Add import at top of claims.ts**

After the existing `import { getUserIdOrDefault }` line (line 9), add:

```typescript
import { createTimelineEntry } from '../../_shared/timeline-helper'
```

- [ ] **Step 2: Add timeline entry on claim extraction (onRequestPost)**

In `onRequestPost`, after `await env.DB.batch(stmts)` (line 96) and before the success response (line 98), add:

```typescript
    // Fire-and-forget: auto-generate timeline entry for extraction
    try {
      const domain = body.url ? new URL(body.url).hostname.replace(/^www\./, '') : 'unknown'
      await createTimelineEntry(env.DB, sessionId, workspaceId, userId, {
        title: `Extracted ${ids.length} claims from ${body.domain || domain}`,
        category: 'publication',
        importance: 'normal',
        source_type: 'system',
        entity_type: 'claim',
        entity_id: body.domain || domain,
        action: 'extracted',
      })
    } catch { /* non-fatal */ }
```

- [ ] **Step 3: Add workspace lookup and timeline entries to onRequestPut**

First, add a workspace lookup near the top of `onRequestPut` (after `const userId = ...` at line 116, before the `promote_to_evidence` branch):

```typescript
    // Lookup workspace for timeline entries
    const session = await env.DB.prepare(
      `SELECT workspace_id FROM cop_sessions WHERE id = ?`
    ).bind(sessionId).first<{ workspace_id: string }>()
    const workspaceId = session?.workspace_id ?? sessionId
```

Then, in the **promote-to-evidence** branch, insert this **BEFORE** the `return new Response(...)` at line 160 (not after — code after `return` is dead):

```typescript
      // Fire-and-forget: timeline entry for verification
      try {
        await createTimelineEntry(env.DB, sessionId, workspaceId, userId, {
          title: `Claim verified: ${claim.claim_text.substring(0, 160)}`,
          category: 'legal',
          importance: 'high',
          source_type: 'system',
          entity_type: 'claim',
          entity_id: claimId,
          action: 'verified',
        })
      } catch { /* non-fatal */ }
```

Then, in the **simple status update** path, insert this after `await env.DB.prepare(UPDATE...)` (line 177) and **BEFORE** the `return new Response(...)` at line 179:

```typescript
    // Fire-and-forget: timeline entry for status change (verified/disputed only)
    if (body.status === 'verified' || body.status === 'disputed') {
      try {
        const claim = await env.DB.prepare(
          `SELECT claim_text FROM cop_claims WHERE id = ? AND cop_session_id = ?`
        ).bind(claimId, sessionId).first<{ claim_text: string }>()

        if (claim) {
          await createTimelineEntry(env.DB, sessionId, workspaceId, userId, {
            title: `Claim ${body.status}: ${claim.claim_text.substring(0, 160)}`,
            category: body.status === 'verified' ? 'legal' : 'event',
            importance: body.status === 'verified' ? 'high' : 'normal',
            source_type: 'system',
            entity_type: 'claim',
            entity_id: claimId,
            action: body.status,
          })
        }
      } catch { /* non-fatal */ }
    }
```

- [ ] **Step 4: Verify build passes**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✓ built in` with no errors

- [ ] **Step 5: Commit**

```bash
git add functions/api/cop/[id]/claims.ts
git commit -m "feat(cop): auto-generate timeline entries on claim verify/dispute/extract"
```

---

### Task 4: Update timeline API — source_type filter, category validation, delete guard

**Files:**
- Modify: `functions/api/cop/[id]/timeline.ts`

- [ ] **Step 1: Add source_type filter to GET handler**

In `onRequestGet`, after the `category` filter block (line 41), add:

```typescript
    const sourceTypeParam = url.searchParams.get('source_type')
    if (sourceTypeParam) {
      const types = sourceTypeParam.split(',').map(t => t.trim()).filter(Boolean)
      if (types.length > 0) {
        const placeholders = types.map(() => '?').join(', ')
        query += ` AND source_type IN (${placeholders})`
        bindings.push(...types)
      }
    }
```

- [ ] **Step 2: Add system entry guard and category validation to PUT handler**

In the PUT handler, after the `entryId` check block, add a guard for system entries and category validation:

```typescript
    // Guard: system-generated entries are read-only
    const existingEntry = await env.DB.prepare(
      `SELECT source_type FROM cop_timeline_entries WHERE id = ? AND cop_session_id = ?`
    ).bind(entryId, sessionId).first<{ source_type: string }>()

    if (existingEntry?.source_type === 'system') {
      return new Response(JSON.stringify({ error: 'System-generated entries cannot be modified' }), {
        status: 403, headers: corsHeaders,
      })
    }
```

Then add category validation:

```typescript
    const validCategories = ['event', 'meeting', 'communication', 'financial', 'legal', 'travel', 'publication', 'military', 'political']
    if (body.category !== undefined && !validCategories.includes(body.category)) {
      return new Response(JSON.stringify({ error: `category must be one of: ${validCategories.join(', ')}` }), {
        status: 400, headers: corsHeaders,
      })
    }
```

Replace the PUT success response with one that returns the updated entry:

```typescript
    // Fetch and return the updated entry
    const updated = await env.DB.prepare(
      `SELECT * FROM cop_timeline_entries WHERE id = ? AND cop_session_id = ?`
    ).bind(entryId, sessionId).first()

    return new Response(JSON.stringify({ message: 'Timeline entry updated', entry: updated }), { headers: corsHeaders })
```

- [ ] **Step 3: Add system entry deletion guard to DELETE handler**

In `onRequestDelete`, after the `entryId` check (line 170) and before the DELETE query (line 172), add:

```typescript
    // Guard: system-generated entries cannot be deleted
    const existing = await env.DB.prepare(
      `SELECT source_type FROM cop_timeline_entries WHERE id = ? AND cop_session_id = ?`
    ).bind(entryId, sessionId).first<{ source_type: string }>()

    if (existing?.source_type === 'system') {
      return new Response(JSON.stringify({ error: 'System-generated entries cannot be deleted' }), {
        status: 403, headers: corsHeaders,
      })
    }
```

- [ ] **Step 4: Update POST handler to support new columns**

In `onRequestPost`, update the INSERT statement to include the new columns. Change the INSERT SQL and `.bind()` call to include `entity_type`, `entity_id`, and `action`:

```typescript
      return env.DB.prepare(`
        INSERT INTO cop_timeline_entries (id, cop_session_id, workspace_id, event_date, title, description, category, source_type, source_url, source_title, importance, entity_type, entity_id, action, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, sessionId, workspaceId,
        entry.event_date || now.slice(0, 10),
        entry.title,
        entry.description ?? null,
        entry.category ?? 'event',
        entry.source_type ?? 'manual',
        entry.source_url ?? null,
        entry.source_title ?? null,
        entry.importance ?? 'normal',
        entry.entity_type ?? null,
        entry.entity_id ?? null,
        entry.action ?? null,
        userId, now, now,
      )
```

- [ ] **Step 5: Verify build passes**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✓ built in` with no errors

- [ ] **Step 6: Commit**

```bash
git add functions/api/cop/[id]/timeline.ts
git commit -m "feat(cop): add source_type filter, category validation, and system delete guard to timeline API"
```

---

### Task 5: AI classification endpoint

**Files:**
- Create: `functions/api/tools/classify-timeline-entry.ts`

- [ ] **Step 1: Create the classification endpoint**

```typescript
/**
 * Classify a timeline entry text into category + importance using AI.
 * Lightweight endpoint for smart defaults on manual timeline entry.
 *
 * POST /api/tools/classify-timeline-entry
 * Body: { text: string, today?: string }
 * Returns: { category, importance, event_date_hint }
 */

import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'

interface Env {
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
  AI_CONFIG: KVNamespace
  CACHE: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

const VALID_CATEGORIES = ['event', 'meeting', 'communication', 'financial', 'legal', 'travel', 'publication', 'military', 'political']
const VALID_IMPORTANCE = ['low', 'normal', 'high', 'critical']

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { text: string; today?: string }

    if (!body.text?.trim()) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const today = body.today || new Date().toISOString().slice(0, 10)

    const aiData = await callOpenAIViaGateway(context.env, {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You classify intelligence timeline events. Today's date is ${today}.

Given event text, return JSON with:
- category: one of [${VALID_CATEGORIES.join(', ')}]
- importance: one of [${VALID_IMPORTANCE.join(', ')}]
- event_date_hint: ISO date (YYYY-MM-DD) if text mentions a specific date or relative date ("last Tuesday", "March 5"), otherwise null

Return ONLY valid JSON: { "category": "...", "importance": "...", "event_date_hint": "..." }`
        },
        { role: 'user', content: body.text.slice(0, 500) }
      ],
      max_completion_tokens: 100,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    }, {
      cacheTTL: getOptimalCacheTTL('classification'),
      metadata: { endpoint: 'classify-timeline-entry' }
    })

    const raw = JSON.parse(aiData.choices[0].message.content)

    // Validate field-by-field — never spread raw LLM output
    const category = VALID_CATEGORIES.includes(raw.category) ? raw.category : 'event'
    const importance = VALID_IMPORTANCE.includes(raw.importance) ? raw.importance : 'normal'
    let event_date_hint: string | null = null
    if (typeof raw.event_date_hint === 'string' && !isNaN(Date.parse(raw.event_date_hint))) {
      event_date_hint = raw.event_date_hint
    }

    return new Response(JSON.stringify({ category, importance, event_date_hint }), {
      headers: corsHeaders,
    })
  } catch (error) {
    console.error('[ClassifyTimeline] Error:', error)
    // Fallback — never block the user
    return new Response(JSON.stringify({
      category: 'event',
      importance: 'normal',
      event_date_hint: null,
    }), { headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✓ built in` with no errors

- [ ] **Step 3: Commit**

```bash
git add functions/api/tools/classify-timeline-entry.ts
git commit -m "feat(cop): add AI classification endpoint for timeline entry smart defaults"
```

---

## Chunk 2: Frontend — Filter Tabs + AI Smart Defaults

### Task 6: Add filter tabs to CopTimelinePanel

**Files:**
- Modify: `src/components/cop/CopTimelinePanel.tsx`

- [ ] **Step 1: Add tab state and filtered entries logic**

After the existing `const isUrl = ...` line, add:

```typescript
  const [activeTab, setActiveTab] = useState<'events' | 'activity' | 'all'>('events')

  const filteredEntries = useMemo(() => {
    if (activeTab === 'events') return entries.filter(e => e.source_type !== 'system')
    if (activeTab === 'activity') return entries.filter(e => e.source_type === 'system')
    return entries
  }, [entries, activeTab])

  const tabCounts = useMemo(() => ({
    all: entries.length,
    events: entries.filter(e => e.source_type !== 'system').length,
    activity: entries.filter(e => e.source_type === 'system').length,
  }), [entries])
```

Update the `TimelineEvent` interface to include the new fields:

```typescript
interface TimelineEvent {
  id?: string
  event_date: string
  title: string
  description?: string | null
  category?: string
  source_type?: string
  source_url?: string | null
  source_title?: string | null
  importance?: string
  entity_type?: string | null
  entity_id?: string | null
  action?: string | null
}
```

- [ ] **Step 2: Add tab bar UI**

Inside the component's return, between the input section (closing `</div>` of the input bar) and the extracted preview section, add:

```tsx
      {/* Filter tabs */}
      {entries.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700">
          {(['events', 'activity', 'all'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-2 py-0.5 text-[10px] rounded-full transition-colors cursor-pointer',
                activeTab === tab
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tabCounts[tab]})
            </button>
          ))}
        </div>
      )}
```

- [ ] **Step 3: Replace `entries` with `filteredEntries` in the render**

In the timeline entries list section, replace all references to `entries` (the event loop) with `filteredEntries`. Specifically:
- `entries.length === 0` empty state check → `filteredEntries.length === 0`
- `entries.map((entry, i) =>` → `filteredEntries.map((entry, i) =>`
- Keep `categoryCounts` using the unfiltered `entries` (it summarizes everything)
- Update the empty state text for Activity tab: show "No investigation activity recorded yet" instead of "No timeline events yet"

- [ ] **Step 4: Verify build passes**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✓ built in` with no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/cop/CopTimelinePanel.tsx
git commit -m "feat(cop): add Events/Activity/All filter tabs to timeline panel"
```

---

### Task 7: AI smart defaults with editable chips

**Files:**
- Modify: `src/components/cop/CopTimelinePanel.tsx`

- [ ] **Step 1: Add chip state and constants**

Add at the top of the component, after existing state declarations:

```typescript
  const [pendingClassification, setPendingClassification] = useState<{
    text: string
    category: string
    importance: string
    eventDate: string
  } | null>(null)
  const [classifying, setClassifying] = useState(false)
```

Add category and importance constants outside the component (near other helpers):

```typescript
const CATEGORIES = ['event', 'meeting', 'communication', 'financial', 'legal', 'travel', 'publication', 'military', 'political']
const IMPORTANCE_LEVELS = ['low', 'normal', 'high', 'critical']
```

- [ ] **Step 2: Rewrite handleManualEntry to classify first**

Replace the existing `handleManualEntry` callback with:

```typescript
  const handleManualEntry = useCallback(async (text: string) => {
    // If we already have a pending classification, save it
    if (pendingClassification) {
      setLoading(true)
      setError(null)
      try {
        const entry = {
          title: pendingClassification.text,
          event_date: pendingClassification.eventDate,
          category: pendingClassification.category,
          importance: pendingClassification.importance,
          source_type: 'manual',
        }
        const res = await fetch(`/api/cop/${sessionId}/timeline`, {
          method: 'POST',
          headers: getCopHeaders(),
          body: JSON.stringify({ entries: [entry] }),
        })
        if (!res.ok) throw new Error('Failed to save timeline entry')
        const data = await res.json()
        setEntries(prev => [...prev, { ...entry, id: data.ids?.[0] }]
          .sort((a, b) => a.event_date.localeCompare(b.event_date)))
        setPendingClassification(null)
        setInput('')
        setEventDate('')
        setShowDateInput(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save entry')
      } finally {
        setLoading(false)
      }
      return
    }

    // First pass: classify the text
    setClassifying(true)
    setError(null)
    const fallback = { category: 'event', importance: 'normal', event_date_hint: null }

    let classification = fallback
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)
      const res = await fetch('/api/tools/classify-timeline-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, today: new Date().toISOString().slice(0, 10) }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (res.ok) classification = await res.json()
    } catch {
      // Timeout or network error — use fallback silently
    }

    setPendingClassification({
      text,
      category: classification.category || 'event',
      importance: classification.importance || 'normal',
      eventDate: classification.event_date_hint || eventDate || new Date().toISOString().slice(0, 10),
    })
    setClassifying(false)
  }, [sessionId, eventDate, pendingClassification, handleExtractFromUrl])
```

- [ ] **Step 3: Add chip UI below the input bar**

After the error display `{error && ...}` block in the input section, add:

```tsx
        {/* AI classification chips — editable before confirm */}
        {pendingClassification && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500">Classified:</span>
            <button
              type="button"
              onClick={() => setPendingClassification(prev => prev ? {
                ...prev,
                category: CATEGORIES[(CATEGORIES.indexOf(prev.category) + 1) % CATEGORIES.length]
              } : null)}
              className={cn('px-1.5 py-0.5 text-[10px] rounded-full cursor-pointer transition-colors', getCategoryColor(pendingClassification.category))}
            >
              {pendingClassification.category}
            </button>
            <button
              type="button"
              onClick={() => setPendingClassification(prev => prev ? {
                ...prev,
                importance: IMPORTANCE_LEVELS[(IMPORTANCE_LEVELS.indexOf(prev.importance) + 1) % IMPORTANCE_LEVELS.length]
              } : null)}
              className={cn('px-1.5 py-0.5 text-[10px] rounded-full cursor-pointer transition-colors',
                pendingClassification.importance === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                pendingClassification.importance === 'high' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                pendingClassification.importance === 'low' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' :
                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              )}
            >
              {pendingClassification.importance}
            </button>
            <button
              type="button"
              onClick={() => {
                const newDate = prompt('Event date (YYYY-MM-DD):', pendingClassification.eventDate)
                if (newDate) setPendingClassification(prev => prev ? { ...prev, eventDate: newDate } : null)
              }}
              className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer font-mono"
            >
              {pendingClassification.eventDate}
            </button>
            <Button
              size="sm"
              onClick={() => handleManualEntry(pendingClassification.text)}
              className="h-5 text-[10px] px-2 cursor-pointer ml-auto"
            >
              Confirm
            </Button>
            <button
              type="button"
              onClick={() => setPendingClassification(null)}
              className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
```

- [ ] **Step 4: Update the submit button to show classifying state**

In the button section, update the loading condition:

```tsx
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={loading || classifying || !input.trim()}
            className="h-8 text-xs px-3 cursor-pointer"
          >
            {loading || classifying ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isUrl ? (
              'Extract'
            ) : pendingClassification ? (
              'Confirm'
            ) : (
              'Add'
            )}
          </Button>
```

- [ ] **Step 5: Update handleSubmit to handle pending classification**

Replace the `handleSubmit` callback:

```typescript
  const handleSubmit = useCallback(() => {
    const trimmed = input.trim()
    if (pendingClassification) {
      handleManualEntry(pendingClassification.text)
      return
    }
    if (!trimmed) return
    if (isUrl) {
      handleExtractFromUrl(trimmed)
    } else {
      handleManualEntry(trimmed)
    }
  }, [input, isUrl, pendingClassification, handleExtractFromUrl, handleManualEntry])
```

- [ ] **Step 6: Verify build passes**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✓ built in` with no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/cop/CopTimelinePanel.tsx
git commit -m "feat(cop): add AI-powered smart defaults with editable classification chips"
```

---

## Chunk 3: Frontend — System Entry Styling + Inline Editing

### Task 8: System entry styling with entity icons

**Files:**
- Modify: `src/components/cop/CopTimelinePanel.tsx`

- [ ] **Step 1: Add system entry icons import**

Add to the lucide-react import:

```typescript
import {
  // ... existing imports ...
  Shield,
  FileText,
  MapPin,
  Lightbulb,
} from 'lucide-react'
```

- [ ] **Step 2: Add entity icon helper**

Near the other helpers at the top:

```typescript
function getEntityIcon(entityType: string | null | undefined) {
  switch (entityType) {
    case 'claim': return Shield
    case 'evidence': return FileText
    case 'marker': return MapPin
    case 'hypothesis': return Lightbulb
    default: return Clock
  }
}
```

- [ ] **Step 3: Update the entry rendering for system entries**

In the entry map loop, wrap the existing entry render with a system-entry check. Update the entry `<div>` to apply muted styles:

```tsx
                return (
                  <div key={entry.id || i} className={cn(
                    'relative flex items-start gap-2 py-1.5 group',
                    entry.source_type === 'system' && 'opacity-75'
                  )}>
```

Update the title rendering to show entity icon for system entries and smaller text:

```tsx
                        <p className={cn(
                          'leading-relaxed flex-1',
                          entry.source_type === 'system' ? 'text-[11px] text-slate-500 dark:text-slate-400' : 'text-xs text-slate-700 dark:text-slate-200'
                        )}>
                          {entry.source_type === 'system' && (() => {
                            const EntityIcon = getEntityIcon(entry.entity_type)
                            return <EntityIcon className="inline h-3 w-3 mr-1 text-slate-400" />
                          })()}
                          {entry.title}
                        </p>
```

Hide the delete button for system entries (replace the existing delete button condition):

```tsx
                        {entry.id && entry.source_type !== 'system' && (
                          <button ...>
```

- [ ] **Step 4: Verify build passes**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✓ built in` with no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/cop/CopTimelinePanel.tsx
git commit -m "feat(cop): add muted styling and entity icons for system timeline entries"
```

---

### Task 9: Inline editing for manual entries

**Files:**
- Modify: `src/components/cop/CopTimelinePanel.tsx`

- [ ] **Step 1: Add editing state**

After existing state declarations:

```typescript
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
```

- [ ] **Step 2: Add inline update handler**

After `handleDelete`:

```typescript
  const handleInlineUpdate = useCallback(async (entryId: string, field: string, value: string) => {
    try {
      const res = await fetch(`/api/cop/${sessionId}/timeline`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({ entry_id: entryId, [field]: value }),
      })
      if (!res.ok) return

      const data = await res.json()
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, [field]: value } : e))
    } catch { /* non-fatal */ }
  }, [sessionId])
```

- [ ] **Step 3: Replace static title with editable title for manual entries**

Update the title `<p>` element in the entry render. For non-system entries, make it double-click-to-edit:

```tsx
                        {entry.source_type !== 'system' && entry.id ? (
                          editingId === entry.id ? (
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => {
                                if (editingTitle.trim() && editingTitle !== entry.title) {
                                  handleInlineUpdate(entry.id!, 'title', editingTitle.trim())
                                }
                                setEditingId(null)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              autoFocus
                              className="text-xs text-slate-700 dark:text-slate-200 bg-transparent border-b border-indigo-500 outline-none w-full"
                            />
                          ) : (
                            <p
                              className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed flex-1 cursor-text"
                              onDoubleClick={() => { setEditingId(entry.id!); setEditingTitle(entry.title) }}
                              title="Double-click to edit"
                            >
                              {entry.title}
                            </p>
                          )
                        ) : (
                          <p className={cn(
                            'leading-relaxed flex-1',
                            entry.source_type === 'system' ? 'text-[11px] text-slate-500 dark:text-slate-400' : 'text-xs text-slate-700 dark:text-slate-200'
                          )}>
                            {entry.source_type === 'system' && (() => {
                              const EntityIcon = getEntityIcon(entry.entity_type)
                              return <EntityIcon className="inline h-3 w-3 mr-1 text-slate-400" />
                            })()}
                            {entry.title}
                          </p>
                        )}
```

- [ ] **Step 4: Make category and importance chips clickable for manual entries**

Update the category badge in the meta badges section to cycle on click for non-system entries:

```tsx
                        {entry.category && entry.category !== 'event' && (
                          entry.source_type !== 'system' && entry.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                const next = CATEGORIES[(CATEGORIES.indexOf(entry.category || 'event') + 1) % CATEGORIES.length]
                                handleInlineUpdate(entry.id!, 'category', next)
                              }}
                              className={cn('text-[8px] px-1 py-0 leading-3 rounded cursor-pointer transition-colors', getCategoryColor(entry.category))}
                            >
                              {entry.category}
                            </button>
                          ) : (
                            <Badge className={cn('text-[8px] px-1 py-0 leading-3 border-transparent', getCategoryColor(entry.category))}>
                              {entry.category}
                            </Badge>
                          )
                        )}
```

- [ ] **Step 5: Add inline importance cycling**

After the category badge, add an importance badge that cycles on click for non-system entries. In the meta badges section, after the category chip:

```tsx
                        {entry.importance && entry.importance !== 'normal' && entry.source_type !== 'system' && entry.id ? (
                          <button
                            type="button"
                            onClick={() => {
                              const next = IMPORTANCE_LEVELS[(IMPORTANCE_LEVELS.indexOf(entry.importance || 'normal') + 1) % IMPORTANCE_LEVELS.length]
                              handleInlineUpdate(entry.id!, 'importance', next)
                            }}
                            className={cn('text-[8px] px-1 py-0 leading-3 rounded cursor-pointer transition-colors',
                              entry.importance === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              entry.importance === 'high' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            )}
                          >
                            {entry.importance}
                          </button>
                        ) : entry.importance && entry.importance !== 'normal' ? (
                          <Badge className={cn('text-[8px] px-1 py-0 leading-3 border-transparent',
                            entry.importance === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            entry.importance === 'high' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          )}>
                            {entry.importance}
                          </Badge>
                        ) : null}
```

- [ ] **Step 6: Add inline date editing**

Make the date label editable for non-system entries. In the date column section, wrap the date text:

```tsx
                    <div className="w-[48px] shrink-0 text-right">
                      {showDate && (
                        entry.source_type !== 'system' && entry.id ? (
                          <input
                            type="date"
                            value={entry.event_date}
                            onChange={(e) => {
                              if (e.target.value) handleInlineUpdate(entry.id!, 'event_date', e.target.value)
                            }}
                            className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-transparent border-none outline-none w-full text-right cursor-pointer"
                          />
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 leading-tight">
                            {formatEventDate(entry.event_date)}
                          </span>
                        )
                      )}
                    </div>
```

- [ ] **Step 7: Verify build passes**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✓ built in` with no errors

- [ ] **Step 8: Commit**

```bash
git add src/components/cop/CopTimelinePanel.tsx
git commit -m "feat(cop): add inline editing for manual timeline entries (title, category, importance, date)"
```

---

## Chunk 4: Cross-Panel Scrolling

### Task 10: Add forceOpen prop to CopPanelExpander

**Files:**
- Modify: `src/components/cop/CopPanelExpander.tsx`

- [ ] **Step 1: Add forceOpen prop to interface**

Add to `CopPanelExpanderProps` (after `canMoveDown`):

```typescript
  forceOpen?: boolean
```

Add to the destructured props:

```typescript
  forceOpen = false,
```

- [ ] **Step 2: Add useEffect to respond to forceOpen**

After the existing `useState` for expansion state, add:

```typescript
  // forceOpen overrides collapsed state — setExpanded(true) is a no-op if already expanded
  useEffect(() => {
    if (forceOpen) setExpanded(true)
  }, [forceOpen])
```

(`setExpanded` is the existing expansion state setter in the component. No need to read `expanded` in the effect — `setExpanded(true)` is idempotent.)

- [ ] **Step 3: Verify build passes**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✓ built in` with no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/cop/CopPanelExpander.tsx
git commit -m "feat(cop): add forceOpen prop to CopPanelExpander for cross-panel scroll"
```

---

### Task 11: Wire onScrollToPanel in CopWorkspacePage

**Files:**
- Modify: `src/pages/CopWorkspacePage.tsx`

- [ ] **Step 1: Add forceOpenPanel state and scroll handler**

In `CopWorkspacePage`, add state near other state declarations:

```typescript
const [forceOpenPanel, setForceOpenPanel] = useState<{ panelId: string; entityId: string } | null>(null)
```

Add the scroll handler:

```typescript
const handleScrollToPanel = useCallback((panelId: string, entityId: string) => {
  // Set force-open to expand collapsed panel
  setForceOpenPanel({ panelId, entityId })

  // Scroll to the panel after a brief delay (allows expansion)
  setTimeout(() => {
    const el = document.querySelector(`[data-panel="${panelId}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 100)

  // Clear force-open after 3 seconds
  setTimeout(() => setForceOpenPanel(null), 3000)
}, [])
```

- [ ] **Step 2: Pass forceOpen to the claims panel expander**

Find the CopPanelExpander that wraps CopClaimsPanel (search for `id="claims"` in the JSX). Add:

```tsx
forceOpen={forceOpenPanel?.panelId === 'claims'}
```

- [ ] **Step 3: Pass onScrollToPanel to CopTimelinePanel**

Find where CopTimelinePanel is rendered. Add the prop:

```tsx
onScrollToPanel={handleScrollToPanel}
```

- [ ] **Step 4: Pass highlightEntityId to CopClaimsPanel**

Find where CopClaimsPanel is rendered. Add:

```tsx
highlightEntityId={forceOpenPanel?.panelId === 'claims' ? forceOpenPanel.entityId : undefined}
```

- [ ] **Step 5: Verify build passes**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✓ built in` with no errors

- [ ] **Step 6: Commit**

```bash
git add src/pages/CopWorkspacePage.tsx
git commit -m "feat(cop): wire cross-panel scroll with forceOpen and highlightEntityId"
```

---

### Task 12: Add highlightEntityId support to CopClaimsPanel

**Files:**
- Modify: `src/components/cop/CopClaimsPanel.tsx`

- [ ] **Step 1: Add highlightEntityId prop**

Update `CopClaimsPanelProps`:

```typescript
interface CopClaimsPanelProps {
  sessionId: string
  expanded: boolean
  highlightEntityId?: string
}
```

Destructure it in the component.

- [ ] **Step 2: Add highlight effect**

Add a `useEffect` that scrolls to and flashes the highlighted claim. Uses `.find(el => offsetParent !== null)` to handle dual-rendered panels (2xl breakpoint renders two copies — we need the visible one):

```typescript
  useEffect(() => {
    if (!highlightEntityId) return
    // Brief delay for panel to expand
    const timer = setTimeout(() => {
      // Find the visible instance (dual-render layout may have hidden duplicates)
      const el = Array.from(document.querySelectorAll(`[data-claim-id="${highlightEntityId}"]`))
        .find(el => (el as HTMLElement).offsetParent !== null) as HTMLElement | undefined
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-yellow-400', 'transition-all')
        setTimeout(() => el.classList.remove('ring-2', 'ring-yellow-400'), 2000)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [highlightEntityId])
```

- [ ] **Step 3: Add data-claim-id attribute to claim items**

In the claim render loop, add `data-claim-id` to each claim's wrapper `<div>`:

```tsx
<div key={ci} data-claim-id={claim.id} className={cn('px-3 py-2 space-y-1', ...)}>
```

- [ ] **Step 4: Add clickable entity links in timeline system entries**

Back in `CopTimelinePanel.tsx`, update the system entry title to make entity text clickable. Wrap the title text for system entries:

```tsx
{entry.source_type === 'system' && entry.entity_id && onScrollToPanel ? (
  <button
    type="button"
    onClick={() => {
      const panelMap: Record<string, string> = { claim: 'claims', evidence: 'evidence', hypothesis: 'analysis', marker: 'map' }
      const panelId = panelMap[entry.entity_type || ''] || 'claims'
      onScrollToPanel(panelId, entry.entity_id!)
    }}
    className="text-blue-500 dark:text-blue-400 hover:underline cursor-pointer"
  >
    {entry.title}
  </button>
) : (
  <span>{entry.title}</span>
)}
```

- [ ] **Step 5: Add onScrollToPanel to CopTimelinePanel props interface**

```typescript
interface CopTimelinePanelProps {
  sessionId: string
  expanded: boolean
  onScrollToPanel?: (panelId: string, entityId: string) => void
}
```

- [ ] **Step 6: Verify build passes**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✓ built in` with no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/cop/CopClaimsPanel.tsx src/components/cop/CopTimelinePanel.tsx
git commit -m "feat(cop): add cross-panel entity highlighting and clickable timeline links"
```

---

## Chunk 5: Phase 2 — Additional Endpoint Wiring

### Task 13: Wire timeline auto-generation into evidence, markers, and hypotheses endpoints

**Files:**
- Modify: `functions/api/cop/[id]/evidence.ts` (if POST handler exists)
- Modify: `functions/api/cop/[id]/markers.ts` (if POST handler exists)
- Modify: `functions/api/cop/[id]/hypotheses.ts` (if POST handler exists)

> **Note:** This task is Phase 2. The implementer should first check if each endpoint file exists and has a POST handler. If it does, add the `createTimelineEntry` call following the exact same pattern as Task 3 (import helper, fire-and-forget try/catch after primary mutation).

- [ ] **Step 1: Check which endpoint files exist**

Run: `ls -la functions/api/cop/\[id\]/evidence.ts functions/api/cop/\[id\]/markers.ts functions/api/cop/\[id\]/hypotheses.ts 2>&1`

- [ ] **Step 2: For each existing file with a POST handler, add the import and timeline call**

Pattern for each (example for evidence):

```typescript
import { createTimelineEntry } from '../../_shared/timeline-helper'

// After the primary INSERT succeeds:
try {
  await createTimelineEntry(env.DB, sessionId, workspaceId, userId, {
    title: `Evidence added: ${body.title?.substring(0, 160) || 'Untitled'}`,
    category: 'event',
    importance: 'normal',
    source_type: 'system',
    entity_type: 'evidence',
    entity_id: newId,
    action: 'created',
  })
} catch { /* non-fatal */ }
```

Adjust `entity_type`, `entity_id`, `title` template, `category`, and `importance` per the spec table in Section 2.

- [ ] **Step 3: Verify build passes**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✓ built in` with no errors

- [ ] **Step 4: Commit**

```bash
git add functions/api/cop/[id]/evidence.ts functions/api/cop/[id]/markers.ts functions/api/cop/[id]/hypotheses.ts
git commit -m "feat(cop): wire timeline auto-generation into evidence, markers, and hypotheses endpoints"
```

---

### Task 14: Apply migration to remote D1

- [ ] **Step 1: Apply migration 085 to remote database**

Run: `npx wrangler d1 execute researchtoolspy-prod --remote --file=schema/migrations/085-timeline-hub-columns.sql`
Expected: 4 commands executed successfully

> **Note:** Also apply migration 084 (cop_timeline_entries table) if it hasn't been applied to remote yet:
> Run: `npx wrangler d1 execute researchtoolspy-prod --remote --file=schema/migrations/084-cop-timeline-entries.sql`

- [ ] **Step 2: Verify columns exist remotely**

Run: `npx wrangler d1 execute researchtoolspy-prod --remote --command="PRAGMA table_info(cop_timeline_entries)"`

- [ ] **Step 3: Deploy**

Run: `npx vite build && npx wrangler pages deploy dist/ --project-name=researchtoolspy`
