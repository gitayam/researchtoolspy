# COP Workspace Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the map-only COP into a multi-panel investigation workspace with a scrollable overview that expands to full-screen deep-dives.

**Architecture:** CopWorkspacePage replaces CopPage as the main workspace view. It renders a responsive CSS grid of compact panels (StatusStrip, MiniGraph, Timeline, Questions, AnalysisSummary, EvidenceFeed, Map). Each panel wraps in a CopPanelExpander that opens a full-screen drawer. The page uses DashboardFullBleedLayout for maximum space.

**Tech Stack:** React + TypeScript, Tailwind CSS v4, Recharts (charts), react-force-graph-2d (network), maplibre-gl (map), Hono (API), D1/SQLite (database), existing shadcn/ui components.

**Design Doc:** `docs/plans/2026-03-05-cop-workspace-redesign.md`

---

## Reference: Key File Paths

| Component | Path |
|-----------|------|
| NetworkGraphCanvas | `src/components/network/NetworkGraphCanvas.tsx` |
| CopMap | `src/components/cop/CopMap.tsx` |
| CopQuestionsTab | `src/components/cop/CopQuestionsTab.tsx` |
| CopRfiTab | `src/components/cop/CopRfiTab.tsx` |
| CopEventSidebar | `src/components/cop/CopEventSidebar.tsx` |
| CopLayerPanel | `src/components/cop/CopLayerPanel.tsx` |
| IntelligenceSynthesisPage | `src/pages/IntelligenceSynthesisPage.tsx` |
| NetworkGraphPage | `src/pages/NetworkGraphPage.tsx` |
| DashboardLayout | `src/layouts/DashboardLayout.tsx` |
| COP types | `src/types/cop.ts` |
| COP sessions API | `functions/api/cop/sessions.ts` |
| COP session CRUD | `functions/api/cop/sessions/[id].ts` |
| Intelligence API | `functions/api/intelligence/*.ts` |
| COP migration | `schema/migrations/057-add-cop-tables.sql` |
| Routes | `src/routes/index.tsx` |
| UI components | `src/components/ui/*.tsx` (28 components: Card, Badge, Button, Tabs, Dialog, Skeleton, Progress, etc.) |
| cn() utility | `src/lib/utils.ts` |

## Reference: Auth Pattern

```typescript
const userHash = localStorage.getItem('omnicore_user_hash')
const headers: Record<string, string> = { 'Content-Type': 'application/json' }
if (userHash) headers['Authorization'] = `Bearer ${userHash}`
// Some COP endpoints use X-User-Hash instead:
if (userHash) headers['X-User-Hash'] = userHash
```

## Reference: NetworkGraphCanvas Props

```typescript
interface NetworkGraphCanvasProps {
  nodes: NetworkNode[]      // { id, name, entityType, val? }
  links: NetworkLink[]      // { source, target, relationshipType, weight, confidence? }
  onNodeClick?: (node: NetworkNode) => void
  onBackgroundClick?: () => void
  width?: number
  height?: number
  highlightedPath?: string[]
  highlightedNodes?: Set<string>
}
```

## Reference: CopMap Props

```typescript
interface CopMapProps {
  session: CopSession
  layers: Record<string, CopFeatureCollection>
  onMapClick?: (lngLat: { lng: number; lat: number }) => void
  onBboxChange?: (bbox: [number, number, number, number]) => void
}
```

---

## Task 1: Database Migration — Add Workspace Fields to cop_sessions

**Files:**
- Create: `schema/migrations/059-cop-workspace-fields.sql`

**Step 1: Write the migration SQL**

```sql
-- Migration 059: Add workspace fields to cop_sessions
-- Supports multi-panel workspace layout and investigation linking

ALTER TABLE cop_sessions ADD COLUMN panel_layout TEXT DEFAULT '{}';
ALTER TABLE cop_sessions ADD COLUMN workspace_mode TEXT DEFAULT 'progress';
ALTER TABLE cop_sessions ADD COLUMN investigation_id TEXT;

-- Index for investigation lookup
CREATE INDEX IF NOT EXISTS idx_cop_sessions_investigation_id ON cop_sessions(investigation_id);
```

Save to `schema/migrations/059-cop-workspace-fields.sql`.

**Step 2: Apply migration locally**

Run:
```bash
npx wrangler d1 execute researchtoolspy-db --local --file=schema/migrations/059-cop-workspace-fields.sql
```

Expected: Migration succeeds, no errors.

**Step 3: Verify columns exist**

Run:
```bash
npx wrangler d1 execute researchtoolspy-db --local --command="PRAGMA table_info(cop_sessions)" | grep -E "panel_layout|workspace_mode|investigation_id"
```

Expected: Three new columns listed.

**Step 4: Commit**

```bash
git add schema/migrations/059-cop-workspace-fields.sql
git commit -m "feat(cop): add workspace layout and investigation fields to cop_sessions"
```

---

## Task 2: Extend COP TypeScript Types

**Files:**
- Modify: `src/types/cop.ts`

**Step 1: Add workspace types to `src/types/cop.ts`**

Add these types at the end of the file (after the existing `CopSidebarTab` type on line 285):

```typescript
// ── Workspace Types ─────────────────────────────────────────

export type CopWorkspaceMode = 'progress' | 'monitor'

export type CopPanelId = 'graph' | 'timeline' | 'questions' | 'analysis' | 'feed' | 'map'

export interface CopPanelState {
  visible: boolean
  expanded: boolean
  position: [number, number] // [column, row]
}

export interface CopPanelLayout {
  mode: CopWorkspaceMode
  panels: Record<CopPanelId, CopPanelState>
}

export const DEFAULT_PANEL_LAYOUT: CopPanelLayout = {
  mode: 'progress',
  panels: {
    graph:     { visible: true, expanded: false, position: [0, 1] },
    timeline:  { visible: true, expanded: false, position: [1, 1] },
    questions: { visible: true, expanded: false, position: [0, 2] },
    analysis:  { visible: true, expanded: false, position: [1, 2] },
    feed:      { visible: true, expanded: false, position: [0, 3] },
    map:       { visible: false, expanded: false, position: [0, 4] },
  },
}

// ── Workspace Stats ─────────────────────────────────────────

export interface CopWorkspaceStats {
  evidence_count: number
  entity_count: number
  actor_count: number
  source_count: number
  event_count: number
  relationship_count: number
  framework_count: number
  open_questions: number
  answered_questions: number
  open_rfis: number
}
```

Also add new fields to the existing `CopSession` interface (after `content_analyses: string[]` around line 59):

```typescript
  // Workspace fields
  panel_layout: CopPanelLayout | null
  workspace_mode: CopWorkspaceMode
  investigation_id: string | null
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: May show existing errors but no new errors from cop.ts changes. If CopSession usage sites complain about missing fields, that's expected — we'll fix them in subsequent tasks.

**Step 3: Commit**

```bash
git add src/types/cop.ts
git commit -m "feat(cop): add workspace panel layout and stats types"
```

---

## Task 3: Workspace Stats API Endpoint

**Files:**
- Create: `functions/api/cop/[id]/stats.ts`

This endpoint aggregates counts of entities, evidence, frameworks, RFIs, etc. for the workspace KPI strip.

**Step 1: Create the stats endpoint**

Create `functions/api/cop/[id]/stats.ts`:

```typescript
/**
 * GET /api/cop/:id/stats
 * Returns aggregate counts for the workspace status strip.
 */
import type { EventContext } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context: EventContext<Env, string, unknown>) => {
  const { id } = context.params as { id: string }
  const db = context.env.DB

  try {
    // Run all count queries in parallel
    const [
      entityCounts,
      evidenceCounts,
      frameworkCounts,
      rfiCounts,
    ] = await Promise.all([
      // Entity counts by type
      db.prepare(`
        SELECT
          COUNT(CASE WHEN entity_type = 'actor' THEN 1 END) as actor_count,
          COUNT(CASE WHEN entity_type = 'source' THEN 1 END) as source_count,
          COUNT(CASE WHEN entity_type = 'event' THEN 1 END) as event_count
        FROM (
          SELECT 'actor' as entity_type FROM actors WHERE workspace_id = (SELECT workspace_id FROM cop_sessions WHERE id = ?1) LIMIT 1000
          UNION ALL
          SELECT 'source' FROM sources WHERE workspace_id = (SELECT workspace_id FROM cop_sessions WHERE id = ?1) LIMIT 1000
          UNION ALL
          SELECT 'event' FROM events WHERE workspace_id = (SELECT workspace_id FROM cop_sessions WHERE id = ?1) LIMIT 1000
        )
      `).bind(id).first() as Promise<Record<string, number> | null>,

      // Evidence count
      db.prepare(`
        SELECT COUNT(*) as count FROM evidence_items
        WHERE workspace_id = (SELECT workspace_id FROM cop_sessions WHERE id = ?1)
      `).bind(id).first() as Promise<{ count: number } | null>,

      // Framework session count
      db.prepare(`
        SELECT COUNT(*) as count FROM framework_sessions
        WHERE user_id = (SELECT created_by FROM cop_sessions WHERE id = ?1)
      `).bind(id).first() as Promise<{ count: number } | null>,

      // RFI counts
      db.prepare(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'open' THEN 1 END) as open_count,
          COUNT(CASE WHEN status IN ('answered', 'accepted') THEN 1 END) as answered_count
        FROM cop_rfis WHERE cop_session_id = ?1
      `).bind(id).first() as Promise<{ total: number; open_count: number; answered_count: number } | null>,
    ])

    // Relationship count (separate because it's simpler)
    const relCount = await db.prepare(`
      SELECT COUNT(*) as count FROM relationships
      WHERE workspace_id = (SELECT workspace_id FROM cop_sessions WHERE id = ?1)
    `).bind(id).first() as { count: number } | null

    const stats = {
      evidence_count: evidenceCounts?.count ?? 0,
      entity_count: (entityCounts?.actor_count ?? 0) + (entityCounts?.source_count ?? 0) + (entityCounts?.event_count ?? 0),
      actor_count: entityCounts?.actor_count ?? 0,
      source_count: entityCounts?.source_count ?? 0,
      event_count: entityCounts?.event_count ?? 0,
      relationship_count: relCount?.count ?? 0,
      framework_count: frameworkCounts?.count ?? 0,
      open_questions: rfiCounts?.open_count ?? 0,
      answered_questions: rfiCounts?.answered_count ?? 0,
      open_rfis: rfiCounts?.open_count ?? 0,
    }

    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Stats endpoint error:', err)
    return new Response(JSON.stringify({ error: 'Failed to load stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
```

**Step 2: Test locally with curl**

Start dev server, then:
```bash
curl -s http://localhost:8788/api/cop/<session-id>/stats | jq .
```

Expected: JSON object with all count fields.

**Step 3: Commit**

```bash
git add functions/api/cop/\[id\]/stats.ts
git commit -m "feat(cop): add workspace stats aggregation endpoint"
```

---

## Task 4: CopStatusStrip Component — KPI Bar

**Files:**
- Create: `src/components/cop/CopStatusStrip.tsx`

**Step 1: Create the status strip component**

```typescript
/**
 * CopStatusStrip — Horizontal KPI bar showing investigation progress at a glance.
 * Color-coded indicators: green (healthy), amber (needs attention), red (critical).
 */
import { useEffect, useState } from 'react'
import {
  FileText,
  Users,
  Network,
  Brain,
  HelpCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { CopWorkspaceStats } from '@/types/cop'

interface CopStatusStripProps {
  sessionId: string
  className?: string
}

interface KpiItem {
  label: string
  value: number
  icon: typeof FileText
  status: 'green' | 'amber' | 'red'
}

function getStatus(value: number, thresholds: { amber: number; red: number }): 'green' | 'amber' | 'red' {
  if (value <= thresholds.red) return 'red'
  if (value <= thresholds.amber) return 'amber'
  return 'green'
}

const STATUS_COLORS = {
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
} as const

export default function CopStatusStrip({ sessionId, className }: CopStatusStripProps) {
  const [stats, setStats] = useState<CopWorkspaceStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchStats() {
      try {
        const userHash = localStorage.getItem('omnicore_user_hash')
        const headers: Record<string, string> = {}
        if (userHash) headers['X-User-Hash'] = userHash

        const res = await fetch(`/api/cop/${sessionId}/stats`, { headers })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setStats(data)
      } catch {
        // Silently fail — strip is supplementary
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchStats()
    return () => { cancelled = true }
  }, [sessionId])

  if (loading) {
    return (
      <div className={cn('flex items-center gap-4 px-4 py-3 bg-muted/50 border-b', className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading workspace stats...</span>
      </div>
    )
  }

  if (!stats) return null

  const kpis: KpiItem[] = [
    {
      label: 'Evidence',
      value: stats.evidence_count,
      icon: FileText,
      status: getStatus(stats.evidence_count, { amber: 2, red: 0 }),
    },
    {
      label: 'Entities',
      value: stats.entity_count,
      icon: Users,
      status: getStatus(stats.entity_count, { amber: 2, red: 0 }),
    },
    {
      label: 'Relationships',
      value: stats.relationship_count,
      icon: Network,
      status: getStatus(stats.relationship_count, { amber: 1, red: 0 }),
    },
    {
      label: 'Analyses',
      value: stats.framework_count,
      icon: Brain,
      status: getStatus(stats.framework_count, { amber: 1, red: 0 }),
    },
    {
      label: 'Open Questions',
      value: stats.open_rfis,
      icon: HelpCircle,
      // Invert: more open questions = amber/red
      status: stats.open_rfis === 0 ? 'green' : stats.open_rfis <= 3 ? 'amber' : 'red',
    },
  ]

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2.5 bg-muted/30 border-b overflow-x-auto',
      className,
    )}>
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="flex items-center gap-2 shrink-0"
        >
          <kpi.icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{kpi.label}:</span>
          <Badge
            variant="secondary"
            className={cn('text-xs font-semibold px-2 py-0', STATUS_COLORS[kpi.status])}
          >
            {kpi.value}
          </Badge>
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "CopStatusStrip" | head -5
```

Expected: No errors from this file.

**Step 3: Commit**

```bash
git add src/components/cop/CopStatusStrip.tsx
git commit -m "feat(cop): add CopStatusStrip KPI bar component"
```

---

## Task 5: CopPanelExpander — Full-Screen Drawer Wrapper

**Files:**
- Create: `src/components/cop/CopPanelExpander.tsx`

This is the generic wrapper that gives every panel the "expand to full-screen" behavior. When collapsed, it renders a compact card. When expanded, it renders a full-screen overlay.

**Step 1: Create the panel expander component**

```typescript
/**
 * CopPanelExpander — Wraps a panel with expand/collapse to full-screen drawer.
 *
 * Collapsed: renders children in a Card with a header bar showing title + expand button.
 * Expanded: renders children in a fixed full-screen overlay with close button.
 */
import { useState, useCallback, type ReactNode } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface CopPanelExpanderProps {
  title: string
  icon: ReactNode
  badge?: string | number
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline'
  children: (expanded: boolean) => ReactNode
  className?: string
  /** Height constraint when collapsed. Default: 'h-[320px]' */
  collapsedHeight?: string
  /** If true, panel starts hidden and needs to be toggled on */
  defaultHidden?: boolean
}

export default function CopPanelExpander({
  title,
  icon,
  badge,
  badgeVariant = 'secondary',
  children,
  className,
  collapsedHeight = 'h-[320px]',
  defaultHidden = false,
}: CopPanelExpanderProps) {
  const [expanded, setExpanded] = useState(false)

  const handleExpand = useCallback(() => setExpanded(true), [])
  const handleCollapse = useCallback(() => setExpanded(false), [])

  // Expanded: full-screen fixed overlay
  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
          <div className="flex items-center gap-2 text-muted-foreground">{icon}</div>
          <h2 className="font-semibold text-sm flex-1">{title}</h2>
          {badge != null && (
            <Badge variant={badgeVariant} className="text-xs">
              {badge}
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={handleCollapse} title="Collapse panel">
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCollapse} title="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content — full available space */}
        <div className="flex-1 overflow-auto">
          {children(true)}
        </div>
      </div>
    )
  }

  // Collapsed: compact card
  return (
    <Card className={cn('overflow-hidden flex flex-col', collapsedHeight, className)}>
      <CardHeader className="py-3 px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">{icon}</div>
          <CardTitle className="text-sm font-semibold flex-1">{title}</CardTitle>
          {badge != null && (
            <Badge variant={badgeVariant} className="text-xs">
              {badge}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExpand}
            title="Expand to full screen"
            className="h-7 w-7 p-0"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        {children(false)}
      </CardContent>
    </Card>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "PanelExpander" | head -5
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/cop/CopPanelExpander.tsx
git commit -m "feat(cop): add CopPanelExpander full-screen drawer wrapper"
```

---

## Task 6: CopMiniGraph — Compact Network Graph Panel

**Files:**
- Create: `src/components/cop/CopMiniGraph.tsx`

Wraps the existing `NetworkGraphCanvas` in a compact panel with data fetching. In collapsed mode, shows a small graph. In expanded mode, shows the full graph with controls.

**Step 1: Create the mini graph component**

```typescript
/**
 * CopMiniGraph — Compact entity relationship graph for the workspace overview.
 * Fetches relationship data and renders NetworkGraphCanvas.
 * Collapsed: small graph preview. Expanded: full interactive graph.
 */
import { useEffect, useState, useMemo } from 'react'
import { Loader2, Network } from 'lucide-react'
import { NetworkGraphCanvas } from '@/components/network/NetworkGraphCanvas'
import type { EntityType } from '@/types/entities'

interface NetworkNode {
  id: string
  name: string
  entityType: EntityType
  val?: number
}

interface NetworkLink {
  source: string
  target: string
  relationshipType: string
  weight: number
  confidence?: string
}

interface CopMiniGraphProps {
  sessionId: string
  expanded: boolean
}

export default function CopMiniGraph({ sessionId, expanded }: CopMiniGraphProps) {
  const [nodes, setNodes] = useState<NetworkNode[]>([])
  const [links, setLinks] = useState<NetworkLink[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchGraph() {
      try {
        const userHash = localStorage.getItem('omnicore_user_hash')
        const headers: Record<string, string> = {}
        if (userHash) headers['Authorization'] = `Bearer ${userHash}`

        // Fetch relationships which include connected entities
        const res = await fetch('/api/relationships', { headers })
        if (!res.ok) return

        const data = await res.json()
        const rels = data.relationships ?? data ?? []

        // Build nodes and links from relationships
        const nodeMap = new Map<string, NetworkNode>()
        const graphLinks: NetworkLink[] = []

        for (const rel of rels) {
          if (!nodeMap.has(rel.source_id)) {
            nodeMap.set(rel.source_id, {
              id: rel.source_id,
              name: rel.source_name ?? rel.source_id,
              entityType: rel.source_type ?? 'actor',
              val: 1,
            })
          }
          if (!nodeMap.has(rel.target_id)) {
            nodeMap.set(rel.target_id, {
              id: rel.target_id,
              name: rel.target_name ?? rel.target_id,
              entityType: rel.target_type ?? 'actor',
              val: 1,
            })
          }

          // Increase node size for more connections
          const srcNode = nodeMap.get(rel.source_id)!
          srcNode.val = (srcNode.val ?? 1) + 1
          const tgtNode = nodeMap.get(rel.target_id)!
          tgtNode.val = (tgtNode.val ?? 1) + 1

          graphLinks.push({
            source: rel.source_id,
            target: rel.target_id,
            relationshipType: rel.relationship_type ?? 'RELATED_TO',
            weight: rel.weight ?? 1,
            confidence: rel.confidence,
          })
        }

        if (!cancelled) {
          setNodes(Array.from(nodeMap.values()))
          setLinks(graphLinks)
        }
      } catch {
        // Silently fail — panel is supplementary
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchGraph()
    return () => { cancelled = true }
  }, [sessionId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <Network className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No entity relationships yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add entities and relationships to see the network graph
        </p>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <NetworkGraphCanvas
        nodes={nodes}
        links={links}
        width={expanded ? undefined : 400}
        height={expanded ? undefined : 260}
      />
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "CopMiniGraph" | head -5
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/cop/CopMiniGraph.tsx
git commit -m "feat(cop): add CopMiniGraph compact network graph panel"
```

---

## Task 7: CopTimelinePanel — Event & Evidence Timeline

**Files:**
- Create: `src/components/cop/CopTimelinePanel.tsx`

Horizontal timeline showing events, evidence additions, and analysis milestones using Recharts.

**Step 1: Create the timeline panel**

```typescript
/**
 * CopTimelinePanel — Horizontal timeline of events, evidence, and analysis milestones.
 * Uses Recharts AreaChart for compact view and expands to a detailed list.
 */
import { useEffect, useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Loader2, Clock, FileText, Users, Brain } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface TimelineEntry {
  date: string
  events: number
  evidence: number
  analyses: number
}

interface CopTimelinePanelProps {
  sessionId: string
  expanded: boolean
}

export default function CopTimelinePanel({ sessionId, expanded }: CopTimelinePanelProps) {
  const [data, setData] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchTimeline() {
      try {
        const userHash = localStorage.getItem('omnicore_user_hash')
        const headers: Record<string, string> = {}
        if (userHash) headers['Authorization'] = `Bearer ${userHash}`

        const res = await fetch('/api/intelligence/timeline', { headers })
        if (!res.ok) return

        const result = await res.json()
        const entries = result.timeline ?? result.daily_activity ?? []

        // Normalize to our format
        const normalized: TimelineEntry[] = entries.map((e: any) => ({
          date: e.date ?? e.day ?? '',
          events: e.events ?? e.event_count ?? 0,
          evidence: e.evidence ?? e.evidence_count ?? 0,
          analyses: e.analyses ?? e.framework_count ?? 0,
        }))

        if (!cancelled) setData(normalized)
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchTimeline()
    return () => { cancelled = true }
  }, [sessionId])

  const totals = useMemo(() => ({
    events: data.reduce((s, d) => s + d.events, 0),
    evidence: data.reduce((s, d) => s + d.evidence, 0),
    analyses: data.reduce((s, d) => s + d.analyses, 0),
  }), [data])

  const dateRange = useMemo(() => {
    if (data.length === 0) return ''
    const first = data[0].date
    const last = data[data.length - 1].date
    return `${first} — ${last}`
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <Clock className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No timeline data yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add events and evidence to build the investigation timeline
        </p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', expanded ? 'p-6' : 'p-3')}>
      {/* Summary badges */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <Badge variant="outline" className="text-xs gap-1">
          <Users className="h-3 w-3" />
          {totals.events} events
        </Badge>
        <Badge variant="outline" className="text-xs gap-1">
          <FileText className="h-3 w-3" />
          {totals.evidence} evidence
        </Badge>
        <Badge variant="outline" className="text-xs gap-1">
          <Brain className="h-3 w-3" />
          {totals.analyses} analyses
        </Badge>
        {dateRange && (
          <span className="text-xs text-muted-foreground ml-auto">{dateRange}</span>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorEvidence" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorAnalyses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            {expanded && (
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            )}
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Area
              type="monotone"
              dataKey="events"
              stroke="#8b5cf6"
              fill="url(#colorEvents)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="evidence"
              stroke="#3b82f6"
              fill="url(#colorEvidence)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="analyses"
              stroke="#10b981"
              fill="url(#colorAnalyses)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "CopTimelinePanel" | head -5
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/cop/CopTimelinePanel.tsx
git commit -m "feat(cop): add CopTimelinePanel with Recharts area chart"
```

---

## Task 8: CopAnalysisSummary — Framework Results Overview

**Files:**
- Create: `src/components/cop/CopAnalysisSummary.tsx`

Shows which frameworks have been run, key findings, and contradictions. Adapts data from the Intelligence Synthesis API.

**Step 1: Create the analysis summary component**

```typescript
/**
 * CopAnalysisSummary — Framework results overview panel.
 * Shows which analyses have been run, key findings, and contradictions.
 */
import { useEffect, useState } from 'react'
import {
  Brain,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SynthesisFinding {
  title: string
  confidence: number
  supporting_frameworks: string[]
}

interface Contradiction {
  description: string
  framework_a: string
  framework_b: string
}

interface AnalysisSummaryData {
  framework_count: number
  findings: SynthesisFinding[]
  contradictions: Contradiction[]
}

interface CopAnalysisSummaryProps {
  sessionId: string
  expanded: boolean
}

export default function CopAnalysisSummary({ sessionId, expanded }: CopAnalysisSummaryProps) {
  const [data, setData] = useState<AnalysisSummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchSynthesis() {
      try {
        const userHash = localStorage.getItem('omnicore_user_hash')
        const headers: Record<string, string> = {}
        if (userHash) headers['Authorization'] = `Bearer ${userHash}`

        const [synthRes, contradictRes] = await Promise.all([
          fetch('/api/intelligence/synthesis', { headers }),
          fetch('/api/intelligence/contradictions', { headers }),
        ])

        const synthData = synthRes.ok ? await synthRes.json() : {}
        const contradictData = contradictRes.ok ? await contradictRes.json() : {}

        if (!cancelled) {
          setData({
            framework_count: synthData.framework_count ?? synthData.findings?.length ?? 0,
            findings: (synthData.findings ?? []).slice(0, expanded ? 20 : 5),
            contradictions: contradictData.contradictions ?? [],
          })
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchSynthesis()
    return () => { cancelled = true }
  }, [sessionId, expanded])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data || (data.findings.length === 0 && data.contradictions.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <Brain className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No analyses run yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Run SWOT, ACH, or other frameworks to see synthesis here
        </p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3 h-full overflow-y-auto', expanded ? 'p-6' : 'p-3')}>
      {/* Findings */}
      {data.findings.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Key Findings
          </h4>
          <div className="space-y-2">
            {data.findings.map((finding, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{finding.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">
                      {Math.round(finding.confidence)}% confidence
                    </Badge>
                    {finding.supporting_frameworks?.map((fw) => (
                      <Badge key={fw} variant="secondary" className="text-[10px]">
                        {fw}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contradictions */}
      {data.contradictions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            Contradictions ({data.contradictions.length})
          </h4>
          <div className="space-y-2">
            {data.contradictions.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-sm bg-amber-50 dark:bg-amber-900/10 rounded-md px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{c.description}</p>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{c.framework_a}</Badge>
                    <ArrowRight className="h-3 w-3" />
                    <Badge variant="outline" className="text-[10px]">{c.framework_b}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "CopAnalysisSummary" | head -5
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/cop/CopAnalysisSummary.tsx
git commit -m "feat(cop): add CopAnalysisSummary framework results panel"
```

---

## Task 9: CopEvidenceFeed — Chronological Activity Feed

**Files:**
- Create: `src/components/cop/CopEvidenceFeed.tsx`

Chronological feed of evidence, content analyses, and investigation activity. Also serves as the input point for analyzing new URLs.

**Step 1: Create the evidence feed component**

```typescript
/**
 * CopEvidenceFeed — Chronological feed of investigation activity.
 * Shows evidence additions, content analyses, and framework results.
 * Includes URL analysis input for adding new content.
 */
import { useEffect, useState, useCallback } from 'react'
import {
  FileText,
  Link,
  Brain,
  Users,
  Globe,
  Loader2,
  Plus,
  Send,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface FeedItem {
  id: string
  type: 'evidence' | 'analysis' | 'entity' | 'framework' | 'url'
  title: string
  description?: string
  url?: string
  created_at: string
}

interface CopEvidenceFeedProps {
  sessionId: string
  expanded: boolean
}

const TYPE_ICONS = {
  evidence: FileText,
  analysis: Globe,
  entity: Users,
  framework: Brain,
  url: Link,
} as const

const TYPE_COLORS = {
  evidence: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  analysis: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  entity: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  framework: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  url: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
} as const

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function CopEvidenceFeed({ sessionId, expanded }: CopEvidenceFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [urlInput, setUrlInput] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchFeed() {
      try {
        const userHash = localStorage.getItem('omnicore_user_hash')
        const headers: Record<string, string> = {}
        if (userHash) headers['Authorization'] = `Bearer ${userHash}`

        // Fetch evidence items as the feed source
        const res = await fetch('/api/evidence', { headers })
        if (!res.ok) return

        const data = await res.json()
        const evidence = data.evidence ?? data ?? []

        const feedItems: FeedItem[] = evidence.map((e: any) => ({
          id: e.id,
          type: 'evidence' as const,
          title: e.title ?? e.content?.substring(0, 80) ?? 'Evidence item',
          description: e.content?.substring(0, 200),
          url: e.source_url,
          created_at: e.created_at ?? new Date().toISOString(),
        }))

        // Sort by date descending
        feedItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        if (!cancelled) setItems(feedItems)
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchFeed()
    return () => { cancelled = true }
  }, [sessionId])

  const handleAnalyzeUrl = useCallback(async () => {
    const trimmed = urlInput.trim()
    if (!trimmed) return

    setAnalyzing(true)
    try {
      const res = await fetch('/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })

      if (res.ok) {
        const data = await res.json()
        const newItem: FeedItem = {
          id: data.id ?? crypto.randomUUID(),
          type: 'analysis',
          title: data.title ?? trimmed,
          description: `Analyzed: ${data.entity_count ?? 0} entities, ${data.claim_count ?? 0} claims extracted`,
          url: trimmed,
          created_at: new Date().toISOString(),
        }
        setItems(prev => [newItem, ...prev])
        setUrlInput('')
      }
    } catch {
      // Handle error
    } finally {
      setAnalyzing(false)
    }
  }, [urlInput])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', expanded ? 'p-6' : 'p-3')}>
      {/* URL Analysis Input */}
      <div className="flex gap-2 mb-3 shrink-0">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeUrl()}
          placeholder="Analyze a URL..."
          className="flex-1 text-sm px-3 py-1.5 rounded-md border bg-background"
        />
        <Button
          size="sm"
          onClick={handleAnalyzeUrl}
          disabled={analyzing || !urlInput.trim()}
        >
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No evidence yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Analyze URLs or add evidence to populate the feed
            </p>
          </div>
        ) : (
          items.slice(0, expanded ? 100 : 10).map((item) => {
            const Icon = TYPE_ICONS[item.type]
            return (
              <div
                key={item.id}
                className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className={cn('rounded-md p-1.5 shrink-0', TYPE_COLORS[item.type])}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0"
                      >
                        <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </div>
                  {item.description && expanded && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {timeAgo(item.created_at)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "CopEvidenceFeed" | head -5
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/cop/CopEvidenceFeed.tsx
git commit -m "feat(cop): add CopEvidenceFeed chronological activity feed"
```

---

## Task 10: CopWorkspacePage — Main Workspace Shell

**Files:**
- Create: `src/pages/CopWorkspacePage.tsx`

This is the centerpiece. It replaces the current `CopPage` with the multi-panel command center layout.

**Step 1: Create the workspace page**

```typescript
/**
 * COP Workspace Page
 *
 * Multi-panel command center for investigation research.
 * Scrollable overview with compact panels that expand to full-screen.
 * Replaces the old map-only CopPage.
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Share2,
  RefreshCw,
  Network,
  Clock,
  HelpCircle,
  Brain,
  FileText,
  Map,
  Loader2,
  Radio,
  UserPlus,
  MonitorPlay,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import CopStatusStrip from '@/components/cop/CopStatusStrip'
import CopPanelExpander from '@/components/cop/CopPanelExpander'
import CopMiniGraph from '@/components/cop/CopMiniGraph'
import CopTimelinePanel from '@/components/cop/CopTimelinePanel'
import CopAnalysisSummary from '@/components/cop/CopAnalysisSummary'
import CopEvidenceFeed from '@/components/cop/CopEvidenceFeed'
import CopQuestionsTab from '@/components/cop/CopQuestionsTab'
import CopRfiTab from '@/components/cop/CopRfiTab'
import CopMap from '@/components/cop/CopMap'
import CopLayerPanel from '@/components/cop/CopLayerPanel'
import { COP_LAYERS, getLayerById } from '@/components/cop/CopLayerCatalog'
import type { CopSession, CopFeatureCollection, CopLayerDef, CopWorkspaceMode } from '@/types/cop'

// ── Auth headers ──────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const userHash = localStorage.getItem('omnicore_user_hash')
  if (userHash) headers['X-User-Hash'] = userHash
  return headers
}

// ── Template labels ───────────────────────────────────────────

const TEMPLATE_LABELS: Record<string, string> = {
  quick_brief: 'Quick Brief',
  event_monitor: 'Event Monitor',
  area_study: 'Area Study',
  crisis_response: 'Crisis Response',
  event_analysis: 'Event Analysis',
  custom: 'Custom',
}

// ── Component ─────────────────────────────────────────────────

export default function CopWorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [session, setSession] = useState<CopSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<CopWorkspaceMode>('progress')
  const [showMap, setShowMap] = useState(false)

  // Map layer state (reused from old CopPage)
  const [activeLayers, setActiveLayers] = useState<string[]>([])
  const [layerData, setLayerData] = useState<Record<string, CopFeatureCollection>>({})
  const [layerCounts, setLayerCounts] = useState<Record<string, number>>({})

  // ── Fetch session ─────────────────────────────────────────────

  const fetchSession = useCallback(async (signal?: AbortSignal) => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cop/sessions/${id}`, { headers: getHeaders(), signal })
      if (!res.ok) throw new Error(`Server responded with ${res.status}`)
      const data = await res.json()
      const sess: CopSession = data.session ?? data
      setSession(sess)
      setActiveLayers(sess.active_layers ?? [])

      // Auto-show map if session has geo data
      if (sess.center_lat && sess.center_lon) {
        setShowMap(true)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    fetchSession(controller.signal)
    return () => controller.abort()
  }, [fetchSession])

  // ── Layer fetching (from old CopPage) ─────────────────────────

  const fetchLayerData = useCallback(
    async (layerDef: CopLayerDef) => {
      if (!id || layerDef.source.type === 'static') return
      try {
        const endpoint = `/api/cop/${id}${layerDef.source.endpoint}`
        const res = await fetch(endpoint, { headers: getHeaders() })
        if (!res.ok) return
        const fc: CopFeatureCollection = await res.json()
        setLayerData(prev => ({ ...prev, [layerDef.id]: fc }))
        setLayerCounts(prev => ({ ...prev, [layerDef.id]: fc.features?.length ?? 0 }))
      } catch { /* skip */ }
    },
    [id],
  )

  const handleToggleLayer = useCallback(
    async (layerId: string) => {
      const newLayers = activeLayers.includes(layerId)
        ? activeLayers.filter(l => l !== layerId)
        : [...activeLayers, layerId]
      setActiveLayers(newLayers)

      if (id) {
        try {
          await fetch(`/api/cop/sessions/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ active_layers: newLayers }),
          })
        } catch {
          setActiveLayers(activeLayers) // revert
        }
      }
    },
    [activeLayers, id],
  )

  // Fetch layers when they change
  useEffect(() => {
    if (activeLayers.length > 0) {
      const promises = activeLayers
        .map(getLayerById)
        .filter((l): l is CopLayerDef => l != null)
        .map(fetchLayerData)
      Promise.allSettled(promises)
    }
  }, [activeLayers, fetchLayerData])

  // ── Share handler ─────────────────────────────────────────────

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/dashboard/cop/${id}`
    navigator.clipboard.writeText(url).catch(() => {})
  }, [id])

  // ── Loading state ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">
          {error ?? 'Session not found'}
        </div>
        <Button onClick={() => navigate('/dashboard/cop')} variant="outline">
          Back to Workspaces
        </Button>
      </div>
    )
  }

  // ── Main layout ───────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)]">
      {/* ── Header bar ─────────────────────────────────────────── */}
      <header className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 bg-background border-b shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/cop')}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Back</span>
        </Button>

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="font-semibold text-sm truncate">{session.name}</h1>
          <Badge variant="secondary" className="shrink-0 text-[10px] hidden sm:inline-flex">
            {TEMPLATE_LABELS[session.template_type] ?? session.template_type}
          </Badge>
        </div>

        {/* Mode toggle */}
        <div className="hidden md:flex items-center gap-1 bg-muted rounded-md p-0.5">
          <Button
            variant={mode === 'progress' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode('progress')}
            className="h-7 text-xs"
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1" />
            Progress
          </Button>
          <Button
            variant={mode === 'monitor' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode('monitor')}
            className="h-7 text-xs"
          >
            <MonitorPlay className="h-3.5 w-3.5 mr-1" />
            Monitor
          </Button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" title="Invite collaborator">
            <UserPlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleShare} title="Copy share link">
            <Share2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/api/cop/${id}/cot`, '_blank')}
            title="Export as Cursor-on-Target (ATAK)"
          >
            <Radio className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── Status strip ───────────────────────────────────────── */}
      <CopStatusStrip sessionId={id!} />

      {/* ── Panel grid ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-6">
        {mode === 'progress' ? (
          <div className="space-y-4 max-w-7xl mx-auto">
            {/* Row 1: Graph + Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CopPanelExpander
                title="Entity Relationships"
                icon={<Network className="h-4 w-4" />}
                badge={`${session.active_layers?.length ?? 0} layers`}
              >
                {(expanded) => (
                  <CopMiniGraph sessionId={id!} expanded={expanded} />
                )}
              </CopPanelExpander>

              <CopPanelExpander
                title="Timeline"
                icon={<Clock className="h-4 w-4" />}
              >
                {(expanded) => (
                  <CopTimelinePanel sessionId={id!} expanded={expanded} />
                )}
              </CopPanelExpander>
            </div>

            {/* Row 2: Questions + Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CopPanelExpander
                title="Key Questions & RFIs"
                icon={<HelpCircle className="h-4 w-4" />}
              >
                {(expanded) => (
                  <div className={cn('h-full overflow-y-auto', expanded ? 'p-4' : 'p-2')}>
                    {expanded ? (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-sm font-semibold mb-3">Key Questions</h3>
                          <CopQuestionsTab session={session} />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold mb-3">Requests for Information</h3>
                          <CopRfiTab sessionId={id!} />
                        </div>
                      </div>
                    ) : (
                      <CopQuestionsTab session={session} />
                    )}
                  </div>
                )}
              </CopPanelExpander>

              <CopPanelExpander
                title="Analysis Summary"
                icon={<Brain className="h-4 w-4" />}
              >
                {(expanded) => (
                  <CopAnalysisSummary sessionId={id!} expanded={expanded} />
                )}
              </CopPanelExpander>
            </div>

            {/* Row 3: Evidence Feed (full-width) */}
            <CopPanelExpander
              title="Evidence & Intel Feed"
              icon={<FileText className="h-4 w-4" />}
              collapsedHeight="h-[280px]"
            >
              {(expanded) => (
                <CopEvidenceFeed sessionId={id!} expanded={expanded} />
              )}
            </CopPanelExpander>

            {/* Row 4: Map (optional, toggleable) */}
            {showMap && session && (
              <CopPanelExpander
                title="Map"
                icon={<Map className="h-4 w-4" />}
                collapsedHeight="h-[400px]"
              >
                {(expanded) => (
                  <div className={cn('h-full', expanded ? '' : 'relative')}>
                    {expanded && (
                      <div className="absolute top-0 left-0 bottom-0 w-56 z-10 bg-background border-r">
                        <CopLayerPanel
                          activeLayers={activeLayers}
                          onToggleLayer={handleToggleLayer}
                          layerCounts={layerCounts}
                        />
                      </div>
                    )}
                    <div className={cn('h-full', expanded ? 'ml-56' : '')}>
                      <CopMap session={session} layers={layerData} />
                    </div>
                  </div>
                )}
              </CopPanelExpander>
            )}

            {/* Toggle map button if hidden */}
            {!showMap && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMap(true)}
                className="w-full border-dashed"
              >
                <Map className="h-4 w-4 mr-2" />
                Show Map Panel
              </Button>
            )}
          </div>
        ) : (
          /* Monitor mode — feed-first layout */
          <div className="space-y-4 max-w-7xl mx-auto">
            {/* Feed is primary in monitor mode */}
            <CopPanelExpander
              title="Live Feed"
              icon={<FileText className="h-4 w-4" />}
              collapsedHeight="h-[500px]"
            >
              {(expanded) => (
                <CopEvidenceFeed sessionId={id!} expanded={expanded} />
              )}
            </CopPanelExpander>

            {/* Map second if available */}
            {showMap && session && (
              <CopPanelExpander
                title="Map"
                icon={<Map className="h-4 w-4" />}
                collapsedHeight="h-[400px]"
              >
                {(expanded) => (
                  <div className="h-full">
                    <CopMap session={session} layers={layerData} />
                  </div>
                )}
              </CopPanelExpander>
            )}

            {/* Questions sidebar */}
            <CopPanelExpander
              title="Key Questions"
              icon={<HelpCircle className="h-4 w-4" />}
            >
              {(expanded) => (
                <div className={cn('h-full overflow-y-auto', expanded ? 'p-4' : 'p-2')}>
                  <CopQuestionsTab session={session} />
                </div>
              )}
            </CopPanelExpander>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "CopWorkspacePage\|workspace" | head -10
```

Expected: May have some type issues from the CopSession changes in Task 2. Fix any issues.

**Step 3: Commit**

```bash
git add src/pages/CopWorkspacePage.tsx
git commit -m "feat(cop): add CopWorkspacePage multi-panel command center"
```

---

## Task 11: Update Routes — Wire Up Workspace Page

**Files:**
- Modify: `src/routes/index.tsx`

**Step 1: Update the COP route to use the new workspace page**

In `src/routes/index.tsx`, change the CopPage import and route:

Replace the existing COP lazy import (around line 81):
```typescript
const CopPage = lazy(() => import('@/pages/CopPage'))
```

With:
```typescript
const CopWorkspacePage = lazy(() => import('@/pages/CopWorkspacePage'))
```

Then update the route definition for `/dashboard/cop/:id` (around line 173-178). Change from:

```typescript
  {
    path: '/dashboard/cop/:id',
    element: <DashboardFullBleedLayout />,
    children: [
      { index: true, element: <LazyPage Component={CopPage} /> },
    ],
  },
```

To:

```typescript
  {
    path: '/dashboard/cop/:id',
    element: <DashboardFullBleedLayout />,
    children: [
      { index: true, element: <LazyPage Component={CopWorkspacePage} /> },
    ],
  },
```

**Step 2: Verify build**

Run:
```bash
npx vite build 2>&1 | tail -10
```

Expected: Build succeeds (or only has pre-existing warnings).

**Step 3: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat(cop): wire CopWorkspacePage into router replacing map-only CopPage"
```

---

## Task 12: Update CopSession Type Compatibility

**Files:**
- Modify: `src/types/cop.ts` (if needed)
- Modify: `src/pages/CopWorkspacePage.tsx` (if needed)

The new workspace fields added to CopSession in Task 2 may cause type errors in existing components that create CopSession objects, since `panel_layout`, `workspace_mode`, and `investigation_id` are now expected.

**Step 1: Make new fields optional in CopSession**

In `src/types/cop.ts`, ensure the workspace fields are optional (nullable already handled by `| null` types, but add `?` to make them truly optional for backward compatibility):

```typescript
  // Workspace fields (optional — only populated for workspace sessions)
  panel_layout?: CopPanelLayout | null
  workspace_mode?: CopWorkspaceMode
  investigation_id?: string | null
```

**Step 2: Run full TypeScript check**

Run:
```bash
npx tsc --noEmit 2>&1 | head -30
```

Fix any remaining type errors related to these changes.

**Step 3: Commit**

```bash
git add src/types/cop.ts
git commit -m "fix(cop): make workspace fields optional for backward compatibility"
```

---

## Task 13: Visual Smoke Test

**Step 1: Start dev server**

Run:
```bash
npx vite --port 5173
```

**Step 2: Test the workspace**

1. Navigate to `http://localhost:5173/dashboard/cop`
2. Create a new COP session (or use an existing one)
3. Open the COP session — should see the multi-panel workspace instead of the old map-only view
4. Verify:
   - Header bar shows session name, template badge, mode toggle, share/invite buttons
   - Status strip shows KPI badges (may show 0s if no data)
   - Entity Relationships panel renders (empty state or graph)
   - Timeline panel renders (empty state or chart)
   - Key Questions panel renders
   - Analysis Summary panel renders
   - Evidence Feed panel renders with URL input
   - Map panel shows if session has geo data (or "Show Map" button if not)
5. Click "Expand" on any panel — should open full-screen overlay
6. Close the overlay — should return to overview
7. Toggle to "Monitor" mode — layout should change
8. Test on mobile viewport (375px) — should stack to single column

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(cop): address visual issues from smoke testing"
```

---

## Summary

| Task | Component | Type |
|------|-----------|------|
| 1 | DB migration (059) | Schema |
| 2 | COP types extension | Types |
| 3 | Stats API endpoint | Backend |
| 4 | CopStatusStrip | Component |
| 5 | CopPanelExpander | Component |
| 6 | CopMiniGraph | Component |
| 7 | CopTimelinePanel | Component |
| 8 | CopAnalysisSummary | Component |
| 9 | CopEvidenceFeed | Component |
| 10 | CopWorkspacePage | Page |
| 11 | Route wiring | Routes |
| 12 | Type compatibility | Fix |
| 13 | Visual smoke test | QA |

**This covers Phase 1 of the design.** Phases 2-5 (deep-dive improvements, collaboration, investigation merge, live monitor) should each get their own implementation plan once Phase 1 is stable.
