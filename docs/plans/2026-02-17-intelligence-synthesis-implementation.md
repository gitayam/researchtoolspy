# Intelligence Synthesis Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cross-framework intelligence synthesis dashboard that unifies findings from all analytical frameworks in a workspace into a single BI view with KPIs, entity convergence, timelines, network intelligence, contradiction detection, and predictive indicators.

**Architecture:** 7 independent API endpoints (Cloudflare Pages Functions using PagesFunction pattern) feeding a single React page with 7 independently-loading sections. AI-powered sections use gpt-4o-mini via `callOpenAIViaGateway()`. Pure SQL aggregation for non-AI sections. No new DB tables — compute-on-read from existing `framework_sessions`, entity tables, `relationships`, and `evidence_items`.

**Tech Stack:** React 18 + TypeScript, Cloudflare Pages Functions, D1 (SQLite), recharts (new dependency), react-force-graph-2d (existing), OpenAI via AI Gateway (existing), shadcn/ui components (existing).

**Reference pattern:** Downtown-Guide `AnalyticsDashboardPage.tsx` + `analytics-bi.ts` — independent section loading with skeletons, KPI strip in hero, period-agnostic (current state).

---

## Task 1: Install recharts + Create Type Definitions

**Files:**
- Modify: `package.json` (add recharts dependency)
- Create: `src/types/intelligence-synthesis.ts`

**Step 1: Install recharts**

Run: `cd /Users/sac/Git/researchtoolspy && npm install recharts`

Expected: recharts added to package.json dependencies

**Step 2: Create type definitions**

Create `src/types/intelligence-synthesis.ts` with all API response types:

```typescript
// ─── KPI Types ──────────────────────────────────────────────────────────────

export interface IntelligenceKpi {
  active_frameworks: number
  frameworks_by_type: Record<string, number>
  entities_tracked: number
  entities_by_type: Record<string, number>
  evidence_count: number
  avg_confidence: number
  confidence_sparkline: number[]
  deception_risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  deception_risk_score: number
  coverage_gap_pct: number
}

// ─── Synthesis Types ────────────────────────────────────────────────────────

export interface SynthesisFinding {
  finding: string
  supporting_frameworks: string[]
  confidence: number
  evidence_count: number
}

export interface ConvergencePoint {
  description: string
  frameworks: { type: string; session_id: string; element: string }[]
  strength: 'strong' | 'moderate' | 'weak'
}

export interface Contradiction {
  description: string
  side_a: { framework_type: string; session_id: string; claim: string }
  side_b: { framework_type: string; session_id: string; claim: string }
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  suggested_resolution: string
}

export interface SynthesisResponse {
  key_findings: SynthesisFinding[]
  convergence_points: ConvergencePoint[]
  contradictions: Contradiction[]
  overall_confidence: number
  confidence_breakdown: { framework_type: string; confidence: number }[]
  generated_at: string
}

// ─── Entity Convergence Types ───────────────────────────────────────────────

export interface EntityConvergenceRow {
  entity_id: string
  entity_name: string
  entity_type: 'ACTOR' | 'SOURCE' | 'EVENT' | 'PLACE' | 'BEHAVIOR'
  frameworks_count: number
  convergence_score: number
  relationship_count: number
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null
  mom_score: number | null
}

export interface EntityConvergenceResponse {
  entities: EntityConvergenceRow[]
  total_frameworks: number
}

// ─── Timeline Types ─────────────────────────────────────────────────────────

export interface TimelinePoint {
  date: string
  frameworks_created: number
  frameworks_updated: number
  evidence_added: number
  entities_added: number
}

export interface Milestone {
  date: string
  type: 'first_framework' | 'entity_spike' | 'deception_added' | 'evidence_milestone'
  description: string
}

export interface TimelineResponse {
  activity: TimelinePoint[]
  evidence_accumulation: { date: string; cumulative: number }[]
  milestones: Milestone[]
}

// ─── Network Intelligence Types ─────────────────────────────────────────────

export interface NetworkNode {
  id: string
  name: string
  type: string
  community_id: number
  degree_centrality: number
  betweenness_centrality: number
  frameworks_count: number
}

export interface NetworkEdge {
  source: string
  target: string
  relationship_type: string
  confidence: number
}

export interface Community {
  id: number
  members: string[]
  dominant_type: string
  size: number
}

export interface KeyInfluencer {
  entity_id: string
  entity_name: string
  composite_score: number
  role: string
}

export interface NetworkIntelligenceResponse {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  communities: Community[]
  key_influencers: KeyInfluencer[]
  bridge_nodes: string[]
  metrics: {
    total_nodes: number
    total_edges: number
    community_count: number
    network_density: number
  }
}

// ─── Contradictions Types ───────────────────────────────────────────────────

export interface ContradictionsResponse {
  contradictions: Contradiction[]
  total_count: number
  by_severity: { INFO: number; WARNING: number; CRITICAL: number }
}

// ─── Predictions Types ──────────────────────────────────────────────────────

export interface WatchItem {
  entity_or_topic: string
  reason: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  related_frameworks: string[]
}

export interface CollectionGap {
  area: string
  current_evidence_count: number
  recommended_action: string
  impact_if_filled: string
}

export interface PredictionsResponse {
  watch_list: WatchItem[]
  emerging_patterns: { description: string; confidence: number }[]
  collection_gaps: CollectionGap[]
  risk_trajectory: 'ESCALATING' | 'STABLE' | 'DE_ESCALATING'
  risk_trajectory_reasoning: string
  generated_at: string
}
```

**Step 3: Commit**

```bash
git add package.json package-lock.json src/types/intelligence-synthesis.ts
git commit -m "feat: add recharts + intelligence synthesis type definitions"
```

---

## Task 2: KPI Endpoint

**Files:**
- Create: `functions/api/intelligence/kpi.ts`

**Context needed:**
- Auth pattern: `functions/api/_shared/auth-helpers.ts` — use `getUserFromRequest()`
- DB binding: `env.DB` (D1Database)
- Tables: `framework_sessions`, `actors`, `sources`, `events`, `places`, `behaviors`, `evidence_items`, `mom_assessments`, `relationships`
- All entity tables have `workspace_id` and `is_public` columns
- `framework_sessions` has `user_id`, `framework_type`, `status`, `data` (JSON string), `created_at`

**Step 1: Create the KPI endpoint**

Create `functions/api/intelligence/kpi.ts`:

```typescript
import { getUserFromRequest } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(request.url)
    const workspaceId = url.searchParams.get('workspace_id') || 'default'

    // Run all queries in parallel
    const [
      frameworksResult,
      actorsCount,
      sourcesCount,
      eventsCount,
      placesCount,
      behaviorsCount,
      evidenceCount,
      frameworksForConfidence,
      momAssessments,
      relationshipCount,
      recentFrameworks,
    ] = await Promise.all([
      // Active frameworks by type
      env.DB.prepare(`
        SELECT framework_type, COUNT(*) as cnt
        FROM framework_sessions
        WHERE user_id = ? AND status != 'archived'
        GROUP BY framework_type
      `).bind(userId).all<{ framework_type: string; cnt: number }>(),

      // Entity counts
      env.DB.prepare(`SELECT COUNT(*) as cnt FROM actors WHERE (user_id = ? OR is_public = 1)`).bind(userId).first<{ cnt: number }>(),
      env.DB.prepare(`SELECT COUNT(*) as cnt FROM sources WHERE (user_id = ? OR is_public = 1)`).bind(userId).first<{ cnt: number }>(),
      env.DB.prepare(`SELECT COUNT(*) as cnt FROM events WHERE (user_id = ? OR is_public = 1)`).bind(userId).first<{ cnt: number }>(),
      env.DB.prepare(`SELECT COUNT(*) as cnt FROM places WHERE (user_id = ? OR is_public = 1)`).bind(userId).first<{ cnt: number }>(),
      env.DB.prepare(`SELECT COUNT(*) as cnt FROM behaviors WHERE (user_id = ? OR is_public = 1)`).bind(userId).first<{ cnt: number }>(),

      // Evidence count
      env.DB.prepare(`SELECT COUNT(*) as cnt FROM evidence_items WHERE user_id = ?`).bind(userId).first<{ cnt: number }>(),

      // Frameworks with data for confidence extraction
      env.DB.prepare(`
        SELECT framework_type, data, created_at
        FROM framework_sessions
        WHERE user_id = ? AND status != 'archived'
        ORDER BY created_at DESC
      `).bind(userId).all<{ framework_type: string; data: string; created_at: string }>(),

      // MOM assessments for deception risk
      env.DB.prepare(`
        SELECT motive_score, opportunity_score, means_score
        FROM mom_assessments
        WHERE user_id = ?
      `).bind(userId).all<{ motive_score: number; opportunity_score: number; means_score: number }>(),

      // Relationship count for coverage
      env.DB.prepare(`SELECT COUNT(*) as cnt FROM relationships WHERE user_id = ?`).bind(userId).first<{ cnt: number }>(),

      // Recent 7 frameworks for sparkline (by creation date)
      env.DB.prepare(`
        SELECT created_at, framework_type, data
        FROM framework_sessions
        WHERE user_id = ? AND status != 'archived'
        ORDER BY created_at DESC
        LIMIT 7
      `).bind(userId).all<{ created_at: string; framework_type: string; data: string }>(),
    ])

    // Calculate derived values
    const frameworksByType: Record<string, number> = {}
    let totalFrameworks = 0
    for (const row of frameworksResult.results || []) {
      frameworksByType[row.framework_type] = row.cnt
      totalFrameworks += row.cnt
    }

    const entitiesByType: Record<string, number> = {
      ACTOR: actorsCount?.cnt ?? 0,
      SOURCE: sourcesCount?.cnt ?? 0,
      EVENT: eventsCount?.cnt ?? 0,
      PLACE: placesCount?.cnt ?? 0,
      BEHAVIOR: behaviorsCount?.cnt ?? 0,
    }
    const totalEntities = Object.values(entitiesByType).reduce((a, b) => a + b, 0)

    // Extract confidence from framework data
    const confidenceValues: number[] = []
    for (const fw of frameworksForConfidence.results || []) {
      try {
        const data = JSON.parse(fw.data || '{}')
        // Different frameworks store confidence differently
        if (data.confidence) confidenceValues.push(Number(data.confidence))
        if (data.overall_confidence) confidenceValues.push(Number(data.overall_confidence))
        // ACH: use highest hypothesis score as proxy
        if (data.hypotheses && Array.isArray(data.hypotheses)) {
          const scores = data.hypotheses.map((h: any) => h.score ?? h.likelihood ?? 0).filter((s: number) => s > 0)
          if (scores.length > 0) confidenceValues.push(Math.max(...scores))
        }
      } catch { /* skip unparseable */ }
    }
    const avgConfidence = confidenceValues.length > 0
      ? Math.round(confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length)
      : 0

    // Confidence sparkline from recent frameworks
    const sparkline = (recentFrameworks.results || []).reverse().map(fw => {
      try {
        const data = JSON.parse(fw.data || '{}')
        return data.confidence ?? data.overall_confidence ?? 50
      } catch { return 50 }
    })

    // Deception risk from MOM assessments
    const momRows = momAssessments.results || []
    let deceptionScore = 0
    if (momRows.length > 0) {
      const avgMom = momRows.reduce((sum, r) => sum + (r.motive_score + r.opportunity_score + r.means_score) / 3, 0) / momRows.length
      deceptionScore = Math.round(avgMom * 10) / 10
    }
    const deceptionLevel = deceptionScore >= 4 ? 'CRITICAL' : deceptionScore >= 3 ? 'HIGH' : deceptionScore >= 2 ? 'MEDIUM' : 'LOW'

    // Coverage gap: % of entities not referenced in any relationship
    // (entities with 0 relationships are "uncovered")
    const relCount = relationshipCount?.cnt ?? 0
    const coverageGap = totalEntities > 0
      ? Math.round((Math.max(0, totalEntities - relCount) / totalEntities) * 100)
      : 0

    return new Response(JSON.stringify({
      active_frameworks: totalFrameworks,
      frameworks_by_type: frameworksByType,
      entities_tracked: totalEntities,
      entities_by_type: entitiesByType,
      evidence_count: evidenceCount?.cnt ?? 0,
      avg_confidence: avgConfidence,
      confidence_sparkline: sparkline,
      deception_risk_level: deceptionLevel,
      deception_risk_score: deceptionScore,
      coverage_gap_pct: coverageGap,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Intelligence KPI error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch KPI data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

**Step 2: Commit**

```bash
git add functions/api/intelligence/kpi.ts
git commit -m "feat(api): add intelligence KPI endpoint"
```

---

## Task 3: Entity Convergence Endpoint

**Files:**
- Create: `functions/api/intelligence/entities.ts`

**Context:** Pure SQL. Count how many frameworks reference each entity. Entities can be referenced via `relationships` table (source_entity_id or target_entity_id) or via framework `data` JSON (entities are sometimes embedded).

**Step 1: Create the endpoint**

Create `functions/api/intelligence/entities.ts`:

```typescript
import { getUserFromRequest } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get total framework count for convergence score denominator
    const fwCount = await env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM framework_sessions
      WHERE user_id = ? AND status != 'archived'
    `).bind(userId).first<{ cnt: number }>()
    const totalFrameworks = fwCount?.cnt ?? 0

    // Get all entities with relationship counts
    // Union all entity types into a single query
    const entitiesResult = await env.DB.prepare(`
      SELECT
        e.id as entity_id,
        e.name as entity_name,
        e.entity_type,
        COALESCE(r_count.rel_count, 0) as relationship_count,
        m.avg_mom as mom_score
      FROM (
        SELECT CAST(id AS TEXT) as id, name, 'ACTOR' as entity_type, user_id FROM actors WHERE user_id = ? OR is_public = 1
        UNION ALL
        SELECT CAST(id AS TEXT) as id, name, 'SOURCE' as entity_type, user_id FROM sources WHERE user_id = ? OR is_public = 1
        UNION ALL
        SELECT CAST(id AS TEXT) as id, name, 'EVENT' as entity_type, user_id FROM events WHERE user_id = ? OR is_public = 1
        UNION ALL
        SELECT CAST(id AS TEXT) as id, name, 'PLACE' as entity_type, user_id FROM places WHERE user_id = ? OR is_public = 1
        UNION ALL
        SELECT CAST(id AS TEXT) as id, name, 'BEHAVIOR' as entity_type, user_id FROM behaviors WHERE user_id = ? OR is_public = 1
      ) e
      LEFT JOIN (
        SELECT entity_id, COUNT(*) as rel_count FROM (
          SELECT source_entity_id as entity_id FROM relationships WHERE user_id = ?
          UNION ALL
          SELECT target_entity_id as entity_id FROM relationships WHERE user_id = ?
        ) GROUP BY entity_id
      ) r_count ON r_count.entity_id = e.id
      LEFT JOIN (
        SELECT actor_id, AVG((motive_score + opportunity_score + means_score) / 3.0) as avg_mom
        FROM mom_assessments
        WHERE user_id = ?
        GROUP BY actor_id
      ) m ON m.actor_id = e.id AND e.entity_type = 'ACTOR'
      ORDER BY COALESCE(r_count.rel_count, 0) DESC
      LIMIT 100
    `).bind(userId, userId, userId, userId, userId, userId, userId, userId).all<{
      entity_id: string
      entity_name: string
      entity_type: string
      relationship_count: number
      mom_score: number | null
    }>()

    // For each entity, count how many distinct frameworks reference it
    // (via relationships that link to framework evidence)
    // Simplified: use relationship count as proxy for framework coverage
    const entities = (entitiesResult.results || []).map(e => {
      // Estimate frameworks_count from relationship density
      // More relationships = more likely referenced across frameworks
      const estimatedFrameworks = Math.min(totalFrameworks, Math.ceil(e.relationship_count / 2))
      const convergenceScore = totalFrameworks > 0
        ? Math.round((estimatedFrameworks / totalFrameworks) * 100) / 100
        : 0

      const riskLevel = e.mom_score !== null
        ? (e.mom_score >= 4 ? 'CRITICAL' : e.mom_score >= 3 ? 'HIGH' : e.mom_score >= 2 ? 'MEDIUM' : 'LOW')
        : null

      return {
        entity_id: e.entity_id,
        entity_name: e.entity_name,
        entity_type: e.entity_type,
        frameworks_count: estimatedFrameworks,
        convergence_score: convergenceScore,
        relationship_count: e.relationship_count,
        risk_level: riskLevel,
        mom_score: e.mom_score !== null ? Math.round(e.mom_score * 10) / 10 : null,
      }
    })

    return new Response(JSON.stringify({
      entities,
      total_frameworks: totalFrameworks,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Intelligence entities error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch entity convergence data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

**Step 2: Commit**

```bash
git add functions/api/intelligence/entities.ts
git commit -m "feat(api): add entity convergence endpoint"
```

---

## Task 4: Timeline Endpoint

**Files:**
- Create: `functions/api/intelligence/timeline.ts`

**Step 1: Create the endpoint**

Create `functions/api/intelligence/timeline.ts`:

```typescript
import { getUserFromRequest } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Daily framework activity (created + updated)
    const [frameworkActivity, evidenceActivity, entityActivity, firstFramework] = await Promise.all([
      env.DB.prepare(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as created,
          SUM(CASE WHEN updated_at > created_at THEN 1 ELSE 0 END) as updated
        FROM framework_sessions
        WHERE user_id = ? AND status != 'archived'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `).bind(userId).all<{ date: string; created: number; updated: number }>(),

      env.DB.prepare(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM evidence_items
        WHERE user_id = ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `).bind(userId).all<{ date: string; count: number }>(),

      env.DB.prepare(`
        SELECT date, SUM(count) as count FROM (
          SELECT DATE(created_at) as date, COUNT(*) as count FROM actors WHERE user_id = ? GROUP BY DATE(created_at)
          UNION ALL
          SELECT DATE(created_at) as date, COUNT(*) as count FROM sources WHERE user_id = ? GROUP BY DATE(created_at)
          UNION ALL
          SELECT DATE(created_at) as date, COUNT(*) as count FROM events WHERE user_id = ? GROUP BY DATE(created_at)
          UNION ALL
          SELECT DATE(created_at) as date, COUNT(*) as count FROM places WHERE user_id = ? GROUP BY DATE(created_at)
          UNION ALL
          SELECT DATE(created_at) as date, COUNT(*) as count FROM behaviors WHERE user_id = ? GROUP BY DATE(created_at)
        ) GROUP BY date ORDER BY date ASC
      `).bind(userId, userId, userId, userId, userId).all<{ date: string; count: number }>(),

      // First framework for milestone
      env.DB.prepare(`
        SELECT MIN(created_at) as first_date, framework_type
        FROM framework_sessions
        WHERE user_id = ?
      `).bind(userId).first<{ first_date: string; framework_type: string }>(),
    ])

    // Build unified daily activity
    const dateSet = new Set<string>()
    const fwByDate: Record<string, { created: number; updated: number }> = {}
    const evByDate: Record<string, number> = {}
    const entByDate: Record<string, number> = {}

    for (const r of frameworkActivity.results || []) {
      dateSet.add(r.date)
      fwByDate[r.date] = { created: r.created, updated: r.updated }
    }
    for (const r of evidenceActivity.results || []) {
      dateSet.add(r.date)
      evByDate[r.date] = r.count
    }
    for (const r of entityActivity.results || []) {
      dateSet.add(r.date)
      entByDate[r.date] = r.count
    }

    const sortedDates = Array.from(dateSet).sort()
    const activity = sortedDates.map(date => ({
      date,
      frameworks_created: fwByDate[date]?.created ?? 0,
      frameworks_updated: fwByDate[date]?.updated ?? 0,
      evidence_added: evByDate[date] ?? 0,
      entities_added: entByDate[date] ?? 0,
    }))

    // Cumulative evidence
    let cumulative = 0
    const evidenceAccumulation = sortedDates.map(date => {
      cumulative += evByDate[date] ?? 0
      return { date, cumulative }
    })

    // Milestones
    const milestones: { date: string; type: string; description: string }[] = []
    if (firstFramework?.first_date) {
      milestones.push({
        date: firstFramework.first_date.split('T')[0],
        type: 'first_framework',
        description: `First analysis created (${firstFramework.framework_type})`,
      })
    }

    return new Response(JSON.stringify({
      activity,
      evidence_accumulation: evidenceAccumulation,
      milestones,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Intelligence timeline error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch timeline data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

**Step 2: Commit**

```bash
git add functions/api/intelligence/timeline.ts
git commit -m "feat(api): add analysis timeline endpoint"
```

---

## Task 5: Network Intelligence Endpoint

**Files:**
- Create: `functions/api/intelligence/network.ts`

**Context:** This computes centrality metrics and community detection from the relationships graph. Uses simple algorithms (no external graph library needed).

**Step 1: Create the endpoint**

Create `functions/api/intelligence/network.ts`:

```typescript
import { getUserFromRequest } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

// Simple graph algorithms (no external deps needed)
function computeDegreeCentrality(adjList: Map<string, Set<string>>): Map<string, number> {
  const result = new Map<string, number>()
  const maxDegree = Math.max(1, ...Array.from(adjList.values()).map(s => s.size))
  for (const [node, neighbors] of adjList) {
    result.set(node, neighbors.size / maxDegree)
  }
  return result
}

function computeBetweennessCentrality(adjList: Map<string, Set<string>>): Map<string, number> {
  const nodes = Array.from(adjList.keys())
  const betweenness = new Map<string, number>()
  for (const n of nodes) betweenness.set(n, 0)

  // Brandes algorithm (simplified for small graphs)
  for (const s of nodes) {
    const stack: string[] = []
    const pred = new Map<string, string[]>()
    const sigma = new Map<string, number>()
    const dist = new Map<string, number>()
    const delta = new Map<string, number>()

    for (const n of nodes) {
      pred.set(n, [])
      sigma.set(n, 0)
      dist.set(n, -1)
      delta.set(n, 0)
    }
    sigma.set(s, 1)
    dist.set(s, 0)

    const queue = [s]
    while (queue.length > 0) {
      const v = queue.shift()!
      stack.push(v)
      const neighbors = adjList.get(v) || new Set()
      for (const w of neighbors) {
        if (dist.get(w)! < 0) {
          queue.push(w)
          dist.set(w, dist.get(v)! + 1)
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, (sigma.get(w) || 0) + (sigma.get(v) || 0))
          pred.get(w)!.push(v)
        }
      }
    }

    while (stack.length > 0) {
      const w = stack.pop()!
      for (const v of pred.get(w)!) {
        const d = ((sigma.get(v) || 0) / (sigma.get(w) || 1)) * (1 + (delta.get(w) || 0))
        delta.set(v, (delta.get(v) || 0) + d)
      }
      if (w !== s) {
        betweenness.set(w, (betweenness.get(w) || 0) + (delta.get(w) || 0))
      }
    }
  }

  // Normalize
  const n = nodes.length
  const norm = n > 2 ? (n - 1) * (n - 2) : 1
  for (const [node, val] of betweenness) {
    betweenness.set(node, val / norm)
  }
  return betweenness
}

function detectCommunities(adjList: Map<string, Set<string>>): Map<string, number> {
  // Label propagation algorithm
  const labels = new Map<string, number>()
  const nodes = Array.from(adjList.keys())
  nodes.forEach((n, i) => labels.set(n, i))

  for (let iter = 0; iter < 10; iter++) {
    let changed = false
    // Shuffle nodes for randomness
    const shuffled = [...nodes].sort(() => Math.random() - 0.5)
    for (const node of shuffled) {
      const neighbors = adjList.get(node) || new Set()
      if (neighbors.size === 0) continue

      const labelCounts = new Map<number, number>()
      for (const neighbor of neighbors) {
        const l = labels.get(neighbor)!
        labelCounts.set(l, (labelCounts.get(l) || 0) + 1)
      }

      let maxCount = 0
      let bestLabel = labels.get(node)!
      for (const [l, c] of labelCounts) {
        if (c > maxCount) { maxCount = c; bestLabel = l }
      }
      if (bestLabel !== labels.get(node)) {
        labels.set(node, bestLabel)
        changed = true
      }
    }
    if (!changed) break
  }

  // Renumber communities to be sequential
  const uniqueLabels = [...new Set(labels.values())]
  const remap = new Map<number, number>()
  uniqueLabels.forEach((l, i) => remap.set(l, i))
  for (const [node, label] of labels) {
    labels.set(node, remap.get(label)!)
  }
  return labels
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Fetch all relationships and entities
    const [relationships, entities] = await Promise.all([
      env.DB.prepare(`
        SELECT source_entity_id, source_entity_type, target_entity_id, target_entity_type,
               relationship_type, confidence
        FROM relationships
        WHERE user_id = ?
      `).bind(userId).all<{
        source_entity_id: string; source_entity_type: string
        target_entity_id: string; target_entity_type: string
        relationship_type: string; confidence: string
      }>(),

      env.DB.prepare(`
        SELECT id, name, entity_type FROM (
          SELECT CAST(id AS TEXT) as id, name, 'ACTOR' as entity_type FROM actors WHERE user_id = ? OR is_public = 1
          UNION ALL
          SELECT CAST(id AS TEXT) as id, name, 'SOURCE' as entity_type FROM sources WHERE user_id = ? OR is_public = 1
          UNION ALL
          SELECT CAST(id AS TEXT) as id, name, 'EVENT' as entity_type FROM events WHERE user_id = ? OR is_public = 1
          UNION ALL
          SELECT CAST(id AS TEXT) as id, name, 'PLACE' as entity_type FROM places WHERE user_id = ? OR is_public = 1
          UNION ALL
          SELECT CAST(id AS TEXT) as id, name, 'BEHAVIOR' as entity_type FROM behaviors WHERE user_id = ? OR is_public = 1
        )
      `).bind(userId, userId, userId, userId, userId).all<{ id: string; name: string; entity_type: string }>(),
    ])

    const entityMap = new Map<string, { name: string; type: string }>()
    for (const e of entities.results || []) {
      entityMap.set(e.id, { name: e.name, type: e.entity_type })
    }

    // Build adjacency list
    const adjList = new Map<string, Set<string>>()
    const edgeList: { source: string; target: string; relationship_type: string; confidence: number }[] = []

    for (const r of relationships.results || []) {
      const src = r.source_entity_id
      const tgt = r.target_entity_id
      if (!adjList.has(src)) adjList.set(src, new Set())
      if (!adjList.has(tgt)) adjList.set(tgt, new Set())
      adjList.get(src)!.add(tgt)
      adjList.get(tgt)!.add(src)

      const confidenceMap: Record<string, number> = { CONFIRMED: 1, PROBABLE: 0.75, POSSIBLE: 0.5, SUSPECTED: 0.25 }
      edgeList.push({
        source: src,
        target: tgt,
        relationship_type: r.relationship_type,
        confidence: confidenceMap[r.confidence] ?? 0.5,
      })
    }

    // Compute metrics
    const degreeCentrality = computeDegreeCentrality(adjList)
    const betweenness = adjList.size <= 200 ? computeBetweennessCentrality(adjList) : new Map<string, number>()
    const communityLabels = detectCommunities(adjList)

    // Build nodes
    const nodes = Array.from(adjList.keys()).map(id => {
      const entity = entityMap.get(id) || { name: `Unknown (${id})`, type: 'UNKNOWN' }
      return {
        id,
        name: entity.name,
        type: entity.type,
        community_id: communityLabels.get(id) ?? 0,
        degree_centrality: Math.round((degreeCentrality.get(id) ?? 0) * 1000) / 1000,
        betweenness_centrality: Math.round((betweenness.get(id) ?? 0) * 1000) / 1000,
        frameworks_count: 0, // TODO: cross-reference with framework data
      }
    })

    // Communities
    const communityMembers = new Map<number, string[]>()
    for (const [id, cid] of communityLabels) {
      if (!communityMembers.has(cid)) communityMembers.set(cid, [])
      communityMembers.get(cid)!.push(id)
    }
    const communities = Array.from(communityMembers.entries()).map(([id, members]) => {
      const types = members.map(m => entityMap.get(m)?.type ?? 'UNKNOWN')
      const typeCounts: Record<string, number> = {}
      for (const t of types) typeCounts[t] = (typeCounts[t] || 0) + 1
      const dominant = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'UNKNOWN'
      return { id, members, dominant_type: dominant, size: members.length }
    })

    // Key influencers (top 5 by composite score)
    const influencers = nodes
      .map(n => ({
        entity_id: n.id,
        entity_name: n.name,
        composite_score: Math.round((n.degree_centrality * 0.4 + n.betweenness_centrality * 0.6) * 1000) / 1000,
        role: n.betweenness_centrality > n.degree_centrality ? 'Information broker' : 'Central connector',
      }))
      .sort((a, b) => b.composite_score - a.composite_score)
      .slice(0, 5)

    // Bridge nodes: high betweenness but low degree
    const bridgeNodes = nodes
      .filter(n => n.betweenness_centrality > 0.1 && n.degree_centrality < 0.5)
      .map(n => n.id)

    // Network density
    const n = nodes.length
    const possibleEdges = n > 1 ? (n * (n - 1)) / 2 : 1
    const density = Math.round((edgeList.length / possibleEdges) * 1000) / 1000

    return new Response(JSON.stringify({
      nodes,
      edges: edgeList,
      communities,
      key_influencers: influencers,
      bridge_nodes: bridgeNodes,
      metrics: {
        total_nodes: nodes.length,
        total_edges: edgeList.length,
        community_count: communities.length,
        network_density: density,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Intelligence network error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch network intelligence data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

**Step 2: Commit**

```bash
git add functions/api/intelligence/network.ts
git commit -m "feat(api): add network intelligence endpoint with centrality and community detection"
```

---

## Task 6: AI-Powered Synthesis Endpoint

**Files:**
- Create: `functions/api/intelligence/synthesis.ts`

**Context:**
- Use `callOpenAIViaGateway()` from `functions/api/_shared/ai-gateway.ts`
- Model: `gpt-4o-mini` (per CLAUDE.md: use gpt-4o-mini as fallback until gpt-5 available)
- Request `response_format: { type: 'json_object' }` for structured output

**Step 1: Create the endpoint**

Create `functions/api/intelligence/synthesis.ts`:

```typescript
import { getUserFromRequest } from '../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../_shared/ai-gateway'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Load all frameworks for this user
    const frameworks = await env.DB.prepare(`
      SELECT id, framework_type, title, data, status, created_at
      FROM framework_sessions
      WHERE user_id = ? AND status != 'archived'
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(userId).all<{
      id: number; framework_type: string; title: string;
      data: string; status: string; created_at: string
    }>()

    const fwResults = frameworks.results || []
    if (fwResults.length === 0) {
      return new Response(JSON.stringify({
        key_findings: [],
        convergence_points: [],
        contradictions: [],
        overall_confidence: 0,
        confidence_breakdown: [],
        generated_at: new Date().toISOString(),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Prepare framework summaries for LLM
    const frameworkSummaries = fwResults.map(fw => {
      let parsedData: any = {}
      try { parsedData = JSON.parse(fw.data || '{}') } catch { /* skip */ }

      return {
        id: fw.id,
        type: fw.framework_type,
        title: fw.title,
        status: fw.status,
        created_at: fw.created_at,
        data_summary: truncateForLLM(parsedData, fw.framework_type),
      }
    })

    const systemPrompt = `You are an intelligence analyst performing cross-framework synthesis. You are given structured analysis data from multiple analytical frameworks (ACH, COG, SWOT, Deception Detection, etc.) applied to the same subject.

Your job is to synthesize findings across frameworks to identify:
1. Key findings that emerge when combining insights from multiple frameworks
2. Convergence points where multiple frameworks agree
3. Contradictions where frameworks disagree or provide conflicting assessments
4. An overall confidence assessment

Respond ONLY with valid JSON matching this exact schema:
{
  "key_findings": [
    { "finding": "string", "supporting_frameworks": ["framework_type"], "confidence": 0-100, "evidence_count": 0 }
  ],
  "convergence_points": [
    { "description": "string", "frameworks": [{"type": "string", "session_id": "string", "element": "string"}], "strength": "strong|moderate|weak" }
  ],
  "contradictions": [
    { "description": "string", "side_a": {"framework_type": "string", "session_id": "string", "claim": "string"}, "side_b": {"framework_type": "string", "session_id": "string", "claim": "string"}, "severity": "INFO|WARNING|CRITICAL", "suggested_resolution": "string" }
  ],
  "overall_confidence": 0-100,
  "confidence_breakdown": [{ "framework_type": "string", "confidence": 0-100 }]
}`

    const userPrompt = `Analyze these ${frameworkSummaries.length} framework analyses and synthesize findings:

${JSON.stringify(frameworkSummaries, null, 2)}

Identify cross-framework patterns, agreements, contradictions, and provide an overall confidence assessment.`

    const response = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_completion_tokens: 4000,
      response_format: { type: 'json_object' }
    }, {
      cacheTTL: 300, // 5 min cache (synthesis changes as frameworks update)
      metadata: { endpoint: 'intelligence-synthesis', userId: String(userId) }
    })

    const content = response.choices?.[0]?.message?.content || '{}'
    let synthesis: any
    try {
      synthesis = JSON.parse(content)
    } catch {
      synthesis = {
        key_findings: [],
        convergence_points: [],
        contradictions: [],
        overall_confidence: 0,
        confidence_breakdown: [],
      }
    }

    return new Response(JSON.stringify({
      ...synthesis,
      generated_at: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Intelligence synthesis error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate synthesis' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Truncate framework data for LLM context window.
 * Extract the most relevant fields per framework type.
 */
function truncateForLLM(data: any, frameworkType: string): any {
  const MAX_ITEMS = 10

  switch (frameworkType) {
    case 'ach':
      return {
        hypotheses: (data.hypotheses || []).slice(0, MAX_ITEMS).map((h: any) => ({
          name: h.name || h.title,
          score: h.score ?? h.likelihood,
          description: h.description?.substring(0, 200),
        })),
        evidence_count: (data.evidence || []).length,
      }
    case 'swot':
      return {
        strengths: (data.strengths || []).slice(0, MAX_ITEMS).map((s: any) => s.text || s.name || s),
        weaknesses: (data.weaknesses || []).slice(0, MAX_ITEMS).map((s: any) => s.text || s.name || s),
        opportunities: (data.opportunities || []).slice(0, MAX_ITEMS).map((s: any) => s.text || s.name || s),
        threats: (data.threats || []).slice(0, MAX_ITEMS).map((s: any) => s.text || s.name || s),
      }
    case 'cog':
      return {
        centers_of_gravity: (data.cogs || data.centers_of_gravity || []).slice(0, MAX_ITEMS).map((c: any) => ({
          name: c.name,
          actor_category: c.actor_category,
          capabilities: (c.capabilities || []).slice(0, 3),
          vulnerabilities: (c.vulnerabilities || []).slice(0, 3),
        })),
      }
    case 'deception':
      return {
        likelihood: data.deception_likelihood ?? data.likelihood,
        claims: (data.claims || []).slice(0, MAX_ITEMS).map((c: any) => ({
          claim: c.claim?.substring(0, 200),
          risk_level: c.risk_level,
        })),
        mom_summary: data.mom_summary,
      }
    default:
      // Generic: take first 500 chars of JSON
      const str = JSON.stringify(data)
      return str.length > 500 ? JSON.parse(str.substring(0, 500) + '"}') : data
  }
}
```

**Step 2: Commit**

```bash
git add functions/api/intelligence/synthesis.ts
git commit -m "feat(api): add AI-powered cross-framework synthesis endpoint"
```

---

## Task 7: Contradictions Endpoint

**Files:**
- Create: `functions/api/intelligence/contradictions.ts`

**Step 1: Create the endpoint**

This is a lightweight wrapper that calls the synthesis endpoint logic but focuses on contradictions. For v1, it extracts contradictions from framework data using pattern matching (no LLM).

Create `functions/api/intelligence/contradictions.ts`:

```typescript
import { getUserFromRequest } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Load frameworks
    const frameworks = await env.DB.prepare(`
      SELECT id, framework_type, title, data
      FROM framework_sessions
      WHERE user_id = ? AND status != 'archived'
    `).bind(userId).all<{ id: number; framework_type: string; title: string; data: string }>()

    const contradictions: any[] = []
    const fwResults = frameworks.results || []

    // Parse all framework data
    const parsed = fwResults.map(fw => {
      let data: any = {}
      try { data = JSON.parse(fw.data || '{}') } catch { /* skip */ }
      return { ...fw, parsedData: data }
    })

    // Detection 1: ACH hypotheses vs Deception assessment
    const achFrameworks = parsed.filter(f => f.framework_type === 'ach')
    const deceptionFrameworks = parsed.filter(f => f.framework_type === 'deception')

    for (const ach of achFrameworks) {
      for (const dec of deceptionFrameworks) {
        // If ACH has a high-confidence hypothesis but deception rates sources as unreliable
        const topHypothesis = (ach.parsedData.hypotheses || [])
          .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))[0]
        const deceptionLikelihood = dec.parsedData.deception_likelihood ?? dec.parsedData.likelihood

        if (topHypothesis && deceptionLikelihood && deceptionLikelihood > 60) {
          contradictions.push({
            description: `ACH analysis "${ach.title}" identifies "${topHypothesis.name || topHypothesis.title}" as most likely, but Deception analysis "${dec.title}" rates deception likelihood at ${deceptionLikelihood}%`,
            side_a: { framework_type: 'ach', session_id: String(ach.id), claim: `Hypothesis "${topHypothesis.name || topHypothesis.title}" scored highest` },
            side_b: { framework_type: 'deception', session_id: String(dec.id), claim: `Deception likelihood: ${deceptionLikelihood}%` },
            severity: deceptionLikelihood > 80 ? 'CRITICAL' : 'WARNING',
            suggested_resolution: 'Review evidence quality and source reliability. Consider whether key evidence supporting the top ACH hypothesis comes from potentially deceptive sources.',
          })
        }
      }
    }

    // Detection 2: SWOT strengths vs COG vulnerabilities (same topic)
    const swotFrameworks = parsed.filter(f => f.framework_type === 'swot')
    const cogFrameworks = parsed.filter(f => f.framework_type === 'cog')

    for (const swot of swotFrameworks) {
      for (const cog of cogFrameworks) {
        const strengths = (swot.parsedData.strengths || []).map((s: any) => (s.text || s.name || s).toLowerCase())
        const vulnerabilities = (cog.parsedData.cogs || cog.parsedData.centers_of_gravity || [])
          .flatMap((c: any) => (c.vulnerabilities || []).map((v: any) => (v.name || v.text || v).toLowerCase()))

        // Find overlapping terms
        for (const strength of strengths) {
          for (const vuln of vulnerabilities) {
            const words1 = new Set(strength.split(/\s+/))
            const words2 = new Set(vuln.split(/\s+/))
            const overlap = [...words1].filter(w => words2.has(w) && w.length > 3)
            if (overlap.length >= 2) {
              contradictions.push({
                description: `SWOT identifies "${strength.substring(0, 80)}" as a strength, but COG identifies "${vuln.substring(0, 80)}" as a vulnerability`,
                side_a: { framework_type: 'swot', session_id: String(swot.id), claim: `Strength: ${strength.substring(0, 100)}` },
                side_b: { framework_type: 'cog', session_id: String(cog.id), claim: `Vulnerability: ${vuln.substring(0, 100)}` },
                severity: 'INFO',
                suggested_resolution: 'This may reflect different perspectives (internal vs external view). Investigate whether the capability is both a strength to leverage and a vulnerability to protect.',
              })
            }
          }
        }
      }
    }

    const bySeverity = { INFO: 0, WARNING: 0, CRITICAL: 0 }
    for (const c of contradictions) {
      bySeverity[c.severity as keyof typeof bySeverity]++
    }

    return new Response(JSON.stringify({
      contradictions,
      total_count: contradictions.length,
      by_severity: bySeverity,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Intelligence contradictions error:', error)
    return new Response(JSON.stringify({ error: 'Failed to detect contradictions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

**Step 2: Commit**

```bash
git add functions/api/intelligence/contradictions.ts
git commit -m "feat(api): add contradiction detection endpoint"
```

---

## Task 8: Predictions Endpoint

**Files:**
- Create: `functions/api/intelligence/predictions.ts`

**Step 1: Create the endpoint**

Create `functions/api/intelligence/predictions.ts`:

```typescript
import { getUserFromRequest } from '../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../_shared/ai-gateway'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Gather context for predictions
    const [frameworks, entities, evidenceCount] = await Promise.all([
      env.DB.prepare(`
        SELECT framework_type, title, data, created_at
        FROM framework_sessions
        WHERE user_id = ? AND status != 'archived'
        ORDER BY created_at DESC
        LIMIT 15
      `).bind(userId).all<{ framework_type: string; title: string; data: string; created_at: string }>(),

      env.DB.prepare(`
        SELECT name, entity_type FROM (
          SELECT name, 'ACTOR' as entity_type FROM actors WHERE user_id = ?
          UNION ALL
          SELECT name, 'SOURCE' as entity_type FROM sources WHERE user_id = ?
          UNION ALL
          SELECT name, 'EVENT' as entity_type FROM events WHERE user_id = ?
        ) LIMIT 50
      `).bind(userId, userId, userId).all<{ name: string; entity_type: string }>(),

      env.DB.prepare(`SELECT COUNT(*) as cnt FROM evidence_items WHERE user_id = ?`)
        .bind(userId).first<{ cnt: number }>(),
    ])

    const fwResults = frameworks.results || []
    if (fwResults.length === 0) {
      return new Response(JSON.stringify({
        watch_list: [],
        emerging_patterns: [],
        collection_gaps: [],
        risk_trajectory: 'STABLE',
        risk_trajectory_reasoning: 'No analysis data available to assess trajectory.',
        generated_at: new Date().toISOString(),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Prepare summaries
    const fwSummaries = fwResults.map(fw => {
      let data: any = {}
      try { data = JSON.parse(fw.data || '{}') } catch { /* skip */ }
      const str = JSON.stringify(data)
      return {
        type: fw.framework_type,
        title: fw.title,
        created_at: fw.created_at,
        data_preview: str.substring(0, 300),
      }
    })

    const systemPrompt = `You are an intelligence analyst generating forward-looking predictive indicators based on analytical framework data.

Given a set of completed analyses, identify:
1. Watch list: entities or topics that warrant increased monitoring/collection
2. Emerging patterns: trends or patterns detected across the analysis
3. Collection gaps: areas needing more evidence to increase confidence
4. Risk trajectory: is the situation escalating, stable, or de-escalating

Respond ONLY with valid JSON:
{
  "watch_list": [{ "entity_or_topic": "string", "reason": "string", "priority": "LOW|MEDIUM|HIGH", "related_frameworks": ["type"] }],
  "emerging_patterns": [{ "description": "string", "confidence": 0-100 }],
  "collection_gaps": [{ "area": "string", "current_evidence_count": 0, "recommended_action": "string", "impact_if_filled": "string" }],
  "risk_trajectory": "ESCALATING|STABLE|DE_ESCALATING",
  "risk_trajectory_reasoning": "string"
}`

    const userPrompt = `Based on these analyses and entities, generate predictive intelligence indicators:

Frameworks (${fwSummaries.length}):
${JSON.stringify(fwSummaries, null, 2)}

Known entities (${(entities.results || []).length}):
${(entities.results || []).map(e => `- ${e.name} (${e.entity_type})`).join('\n')}

Evidence items: ${evidenceCount?.cnt ?? 0}

Provide actionable, forward-looking intelligence recommendations.`

    const response = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4,
      max_completion_tokens: 3000,
      response_format: { type: 'json_object' }
    }, {
      cacheTTL: 600, // 10 min cache
      metadata: { endpoint: 'intelligence-predictions', userId: String(userId) }
    })

    const content = response.choices?.[0]?.message?.content || '{}'
    let predictions: any
    try {
      predictions = JSON.parse(content)
    } catch {
      predictions = {
        watch_list: [],
        emerging_patterns: [],
        collection_gaps: [],
        risk_trajectory: 'STABLE',
        risk_trajectory_reasoning: 'Unable to generate predictions.',
      }
    }

    return new Response(JSON.stringify({
      ...predictions,
      generated_at: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Intelligence predictions error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate predictions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

**Step 2: Commit**

```bash
git add functions/api/intelligence/predictions.ts
git commit -m "feat(api): add AI-powered predictive indicators endpoint"
```

---

## Task 9: Intelligence Synthesis Page — Skeleton + KPI Strip

**Files:**
- Create: `src/pages/IntelligenceSynthesisPage.tsx`
- Modify: `src/routes/index.tsx` (add route + lazy import)

**Step 1: Create the page**

Create `src/pages/IntelligenceSynthesisPage.tsx`. This is a large file — create the full page with all 7 sections using the Downtown-Guide BI dashboard pattern (independent loading, skeletons, recharts).

Key patterns to follow:
- Import from `recharts`: `AreaChart`, `Area`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`, `Legend`
- Each section: own `useState`/`useEffect`, loading boolean, error string, skeleton fallback
- Fetch all 7 endpoints in parallel on mount
- Hero section with gradient background + KPI strip
- Each section wrapped in white card with icon + title + subtitle
- Use `@/components/ui/button`, `@/components/ui/badge` from shadcn
- Use `useTranslation()` for any user-facing strings
- Sparkline: inline SVG component (port from Downtown-Guide)

The page should be approximately 800-1200 lines. Key sections:

1. **Hero + KPI Strip** (6 cards with sparklines)
2. **Cross-Framework Synthesis** (findings, convergence, contradictions from AI)
3. **Entity Convergence** (sortable table)
4. **Analysis Timeline** (AreaChart + milestones)
5. **Network Intelligence** (metrics cards + top influencers table)
6. **Contradictions** (severity-colored cards)
7. **Predictive Indicators** (watch list + collection gaps)

**Step 2: Add route**

In `src/routes/index.tsx`, add:

```typescript
// At the top with other lazy imports:
const IntelligenceSynthesisPage = lazy(() => import('@/pages/IntelligenceSynthesisPage'))

// Inside the dashboard children array (after 'network-graph' route):
{ path: 'intelligence', element: <LazyPage Component={IntelligenceSynthesisPage} /> },
```

**Step 3: Add sidebar link**

In `src/components/layout/dashboard-sidebar.tsx`, add an "Intelligence" link to the navigation. Look for the existing nav items pattern and add:

```typescript
{ name: 'Intelligence', href: '/dashboard/intelligence', icon: ChartBarSquareIcon },
```

**Step 4: Commit**

```bash
git add src/pages/IntelligenceSynthesisPage.tsx src/routes/index.tsx src/components/layout/dashboard-sidebar.tsx
git commit -m "feat(ui): add Intelligence Synthesis Dashboard page with all 7 sections"
```

---

## Task 10: Manual Testing + Polish

**Step 1: Start dev server**

Run: `cd /Users/sac/Git/researchtoolspy && npm run dev`

**Step 2: Navigate to the dashboard**

Open: `http://localhost:5173/dashboard/intelligence`

**Step 3: Verify each section loads independently**

- [ ] KPI strip shows 6 cards with data (or "0" for empty workspaces)
- [ ] Synthesis section shows findings (or empty state message)
- [ ] Entity convergence table renders with sorting
- [ ] Timeline charts render with recharts
- [ ] Network metrics display correctly
- [ ] Contradictions section shows detected conflicts
- [ ] Predictions section shows watch list items

**Step 4: Test error states**

- Verify each section shows its own error message if API fails
- Verify skeleton loading states appear while data loads

**Step 5: Test with no data**

- Log in as a new user with no frameworks — verify graceful empty states

**Step 6: Final commit**

```bash
git add -A
git commit -m "fix: polish Intelligence Synthesis Dashboard after testing"
```

---

## Dependency Graph

```
Task 1 (types + recharts)
    ├── Task 2 (KPI endpoint)
    ├── Task 3 (entities endpoint)
    ├── Task 4 (timeline endpoint)
    ├── Task 5 (network endpoint)
    ├── Task 6 (synthesis endpoint)
    ├── Task 7 (contradictions endpoint)
    └── Task 8 (predictions endpoint)
         └── Task 9 (page + routing) — depends on ALL endpoints
              └── Task 10 (testing + polish)
```

Tasks 2-8 are independent of each other and can be done in parallel.
Task 9 depends on Task 1 (for types) but can be started in parallel with 2-8 since it fetches from the API.
Task 10 depends on everything being complete.
