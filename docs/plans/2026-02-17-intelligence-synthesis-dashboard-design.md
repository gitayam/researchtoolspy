# Intelligence Synthesis Dashboard — Design Document

**Date**: 2026-02-17
**Status**: Implemented (2026-02-18)
**Author**: Claude (brainstorming session with user)

## Problem Statement

ResearchToolsPy has 18+ analytical frameworks, comprehensive entity/relationship management, content intelligence, and OSINT collection. However, each framework operates in a silo — there is no unified view that synthesizes findings across frameworks for the same subject/workspace. Analysts must mentally integrate conclusions from ACH, COG, SWOT, Deception Detection, and others without tooling support.

**Missing capabilities:**
- Cross-framework synthesis (0% implemented)
- Temporal/trend analysis of intelligence picture (0%)
- Predictive indicators / forward-looking analysis (0%)
- Enhanced network intelligence with analytical overlays (~30% — basic force graph exists)
- Automated contradiction detection across frameworks (0%)
- Entity convergence scoring across frameworks (0%)

## Solution

A new **Intelligence Synthesis Dashboard** page (`/intelligence/:workspaceId`) that pulls findings from ALL frameworks in a workspace into a unified analytical view, following the proven BI dashboard pattern from the Downtown-Guide project.

## Architecture

### Data Strategy: Compute-on-Read

No new database tables. All synthesis data is computed at query time from existing tables:
- `framework_sessions` — framework analysis data
- `actors`, `sources`, `events`, `places`, `behaviors` — entity tables
- `relationships` — entity relationships with confidence
- `evidence` / `evidence_collections` — evidence items with quality scores
- `mom_assessments` — deception risk scores

This ensures the dashboard always reflects the latest analysis state without sync issues.

### Data Flow

```
framework_sessions (ACH, COG, SWOT, Deception, etc.)
        ↓
   ┌────┴────┐
   │ Entities │  ←→  Relationships  ←→  Evidence
   └────┬────┘
        ↓
  /api/intelligence/* endpoints (7)
        ↓
  IntelligenceSynthesisPage.tsx
  (KPI strip + 6 sections, each independently loaded)
```

### Pattern: Independent Section Loading

Each of the 7 dashboard sections has:
- Its own API endpoint
- Its own loading state + skeleton
- Its own error boundary
- Fetches in parallel on mount (no waterfall)

This matches the Downtown-Guide AnalyticsDashboardPage.tsx pattern exactly.

## API Endpoints

All endpoints accept `?workspace_id=<id>` (required).

### 1. GET /api/intelligence/kpi

**Purpose**: At-a-glance health of the intelligence picture.

**6 KPI cards:**

| KPI | Source | Calculation |
|-----|--------|-------------|
| Active Frameworks | `framework_sessions` | COUNT WHERE workspace + status != archived |
| Entities Tracked | Entity tables | COUNT actors + sources + events + places + behaviors by workspace |
| Evidence Items | `evidence` | COUNT linked to workspace evidence collections |
| Avg Confidence | `framework_sessions.data` | Extract confidence/score fields across frameworks, weighted average |
| Deception Risk | `mom_assessments` + EVE scores | Aggregate risk level (LOW/MED/HIGH/CRITICAL) |
| Coverage Gaps | Cross-reference entities vs frameworks | % of entities appearing in only 1 framework |

Each card includes a sparkline from last 7 data points (framework creation dates).

**Response shape:**
```typescript
interface IntelligenceKpi {
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
```

### 2. GET /api/intelligence/synthesis

**Purpose**: AI-powered cross-framework finding synthesis (the crown jewel).

**Process:**
1. Load all `framework_sessions` for workspace
2. Extract structured findings from each (hypotheses, COGs, SWOT items, etc.)
3. Extract all entities referenced across frameworks
4. Send to gpt-5-mini with synthesis prompt
5. Return structured JSON

**Response shape:**
```typescript
interface SynthesisResponse {
  key_findings: SynthesisFinding[]
  convergence_points: ConvergencePoint[]
  contradictions: Contradiction[]
  overall_confidence: number
  confidence_breakdown: { framework_type: string; confidence: number }[]
  generated_at: string
}

interface SynthesisFinding {
  finding: string
  supporting_frameworks: string[]
  confidence: number
  evidence_count: number
}

interface ConvergencePoint {
  description: string
  frameworks: { type: string; session_id: string; element: string }[]
  strength: 'strong' | 'moderate' | 'weak'
}

interface Contradiction {
  description: string
  side_a: { framework_type: string; session_id: string; claim: string }
  side_b: { framework_type: string; session_id: string; claim: string }
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  suggested_resolution: string
}
```

**LLM model**: gpt-5-mini (cost-effective for structured extraction)

### 3. GET /api/intelligence/entities

**Purpose**: Entity convergence scoring — which entities matter most.

**Pure SQL aggregation, no LLM.**

For each entity in the workspace:
- Count distinct frameworks that reference it
- Count relationships
- Pull MOM assessment if available
- Calculate convergence score: `frameworks_referencing / total_frameworks`

**Response shape:**
```typescript
interface EntityConvergenceResponse {
  entities: EntityConvergenceRow[]
  total_frameworks: number
}

interface EntityConvergenceRow {
  entity_id: string
  entity_name: string
  entity_type: 'ACTOR' | 'SOURCE' | 'EVENT' | 'PLACE' | 'BEHAVIOR'
  frameworks_count: number
  convergence_score: number  // 0-1
  relationship_count: number
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null
  mom_score: number | null
}
```

**UI**: Sortable table matching the Downtown-Guide Venue Leaderboard pattern.

### 4. GET /api/intelligence/timeline

**Purpose**: Temporal evolution of the intelligence picture.

**Data sources:**
- `framework_sessions.created_at` / `updated_at`
- `evidence.created_at`
- Entity creation timestamps

**Response shape:**
```typescript
interface TimelineResponse {
  activity: TimelinePoint[]        // Daily activity counts
  evidence_accumulation: TimelinePoint[]  // Cumulative evidence
  milestones: Milestone[]          // Auto-detected significant points
}

interface TimelinePoint {
  date: string
  frameworks_created: number
  frameworks_updated: number
  evidence_added: number
  entities_added: number
}

interface Milestone {
  date: string
  type: 'first_framework' | 'entity_spike' | 'deception_added' | 'evidence_milestone'
  description: string
}
```

**UI**: recharts AreaChart (stacked by framework type) + LineChart (evidence accumulation) + milestone markers.

### 5. GET /api/intelligence/network

**Purpose**: Enhanced network analysis with computed metrics.

**Algorithms** (pure JS, no LLM):
1. **Centrality rankings**: Degree, betweenness, closeness, eigenvector
2. **Community detection**: Simple label propagation
3. **Bridge nodes**: Entities connecting otherwise-disconnected communities
4. **Key influencers**: Top 5 by composite centrality

**Response shape:**
```typescript
interface NetworkIntelligenceResponse {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  communities: Community[]
  key_influencers: KeyInfluencer[]
  bridge_nodes: string[]  // entity IDs
  metrics: {
    total_nodes: number
    total_edges: number
    community_count: number
    avg_clustering_coefficient: number
    network_density: number
  }
}

interface NetworkNode {
  id: string
  name: string
  type: string
  community_id: number
  degree_centrality: number
  betweenness_centrality: number
  closeness_centrality: number
  eigenvector_centrality: number
  frameworks_count: number
}

interface Community {
  id: number
  members: string[]  // entity IDs
  dominant_type: string
  label: string  // auto-generated from dominant entities
}

interface KeyInfluencer {
  entity_id: string
  entity_name: string
  composite_score: number
  role: string  // e.g., "Central connector", "Information broker"
}
```

**UI**: Enhanced ForceGraph2D (reuse existing) with community coloring + centrality sizing + side panel with rankings table.

### 6. GET /api/intelligence/contradictions

**Purpose**: Automated conflict detection across frameworks.

**Detection methods** (hybrid: pattern matching + LLM):
1. **Entity-level**: Same entity rated differently across frameworks
2. **Finding-level**: Opposing conclusions (SWOT strength vs COG vulnerability on same capability)
3. **Evidence conflicts**: Same evidence supporting contradictory hypotheses

**Response shape:**
```typescript
interface ContradictionsResponse {
  contradictions: Contradiction[]  // same type as synthesis endpoint
  total_count: number
  by_severity: { INFO: number; WARNING: number; CRITICAL: number }
}
```

**UI**: Contradiction cards with severity color-coding, affected framework badges, expandable details.

### 7. GET /api/intelligence/predictions

**Purpose**: Forward-looking intelligence from pattern analysis.

**gpt-5-mini powered**, given all framework findings, entity patterns, evidence quality trajectory.

**Response shape:**
```typescript
interface PredictionsResponse {
  watch_list: WatchItem[]
  emerging_patterns: Pattern[]
  collection_gaps: CollectionGap[]
  risk_trajectory: 'ESCALATING' | 'STABLE' | 'DE_ESCALATING'
  risk_trajectory_reasoning: string
  generated_at: string
}

interface WatchItem {
  entity_or_topic: string
  reason: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  related_frameworks: string[]
}

interface Pattern {
  description: string
  evidence: string[]
  confidence: number
}

interface CollectionGap {
  area: string
  current_evidence_count: number
  recommended_action: string
  impact_if_filled: string
}
```

**UI**: Priority-badged cards linking back to relevant frameworks and entities.

## Frontend Design

### Page: IntelligenceSynthesisPage.tsx

**Layout** (matches Downtown-Guide BI Dashboard):
1. Hero section with workspace name + KPI strip (6 cards in gradient header)
2. Sections below, each in white rounded card with icon + title + subtitle
3. No period selector (intelligence synthesis is always "current state")
4. Workspace selector dropdown if user has multiple workspaces

**Visualization library**: recharts (already in dependencies)
**Network graph**: react-force-graph-2d (already in dependencies)

### Component Reuse
- Skeleton loading components (match Downtown-Guide pattern)
- Section wrapper component with icon/title/subtitle/error handling
- Sparkline SVG component (port from Downtown-Guide)
- Change indicator component for trends

## New Files

| Type | Path | Purpose |
|------|------|---------|
| Page | `src/pages/IntelligenceSynthesisPage.tsx` | Main dashboard |
| API | `functions/api/intelligence/kpi.ts` | KPI aggregation |
| API | `functions/api/intelligence/synthesis.ts` | AI synthesis |
| API | `functions/api/intelligence/entities.ts` | Entity convergence |
| API | `functions/api/intelligence/timeline.ts` | Temporal analysis |
| API | `functions/api/intelligence/network.ts` | Network metrics |
| API | `functions/api/intelligence/contradictions.ts` | Conflict detection |
| API | `functions/api/intelligence/predictions.ts` | Predictive indicators |
| Types | `src/types/intelligence-synthesis.ts` | TypeScript types |
| Route | Router update | Add `/intelligence/:workspaceId` |

## Dependencies

No new packages needed:
- `recharts` — already installed
- `react-force-graph-2d` — already installed
- OpenAI SDK — already configured for gpt-5-mini

## Implementation Priority

1. Types + KPI endpoint + page skeleton (foundation)
2. Entity convergence (pure SQL, no LLM, high value)
3. Timeline (pure SQL, good visual impact)
4. Synthesis (LLM-powered, the crown jewel)
5. Network intelligence (algorithmic, builds on existing graph)
6. Contradictions (hybrid, depends on synthesis logic)
7. Predictions (LLM-powered, depends on all other data)

## Design Decisions

1. **Compute-on-read, no new tables**: Keeps system simple and always consistent
2. **Independent section loading**: Each section loads in parallel, no waterfalls
3. **gpt-5-mini for AI endpoints**: Cost-effective for structured extraction
4. **Workspace-scoped**: Each project gets its own intelligence picture
5. **No period selector**: Unlike Downtown-Guide which has time-based data, intelligence synthesis shows current state of all analyses
6. **Reuse existing visualization components**: ForceGraph2D, recharts

## Reference Implementation

The Downtown-Guide project (`/Users/sac/Git/Downtown-Guide`) provides the reference pattern:
- `web/src/pages/AnalyticsDashboardPage.tsx` — BI dashboard with 7 sections
- `src/routes/analytics-bi.ts` — 7 API endpoints with independent loading
- `web/src/pages/BusinessAnalyticsPage.tsx` — Foot traffic analytics with heatmaps

---

## Implementation Notes (2026-02-18)

### Deviations from Design

1. **Route changed**: `/dashboard/intelligence` (not `/intelligence/:workspaceId`). Workspace scoping deferred — queries filter by user ID instead.
2. **AI model**: Uses `gpt-4o-mini` (not gpt-5-mini) via `callOpenAIViaGateway()`.
3. **Auth pattern**: Uses `getUserIdOrDefault` for guest-mode compatibility (falls back to user ID 1), matching other dashboard endpoints.
4. **Column naming**: Entity tables use `created_by` (not `user_id`). Only `framework_sessions` and `mom_assessments` have `user_id`.
5. **Network metrics**: Closeness centrality and eigenvector centrality omitted. Betweenness uses Brandes algorithm, capped at 200 nodes.
6. **recharts**: Added as new dependency (v3.7.0) — was not pre-installed.

### Key Schema Facts

| Table | User column | ID type |
|-------|------------|---------|
| `framework_sessions` | `user_id` | INTEGER |
| `mom_assessments` | `user_id` | INTEGER |
| `actors` | `created_by` | TEXT |
| `sources` | `created_by` | TEXT |
| `events` | `created_by` | TEXT |
| `places` | `created_by` | TEXT |
| `behaviors` | `created_by` | TEXT |
| `evidence_items` | `created_by` | INTEGER |
| `relationships` | `created_by` | INTEGER |

### Commits

| Commit | Description |
|--------|-------------|
| `3d1b455` | Install recharts + create type definitions |
| `9dd3c4a` | KPI aggregation endpoint |
| `334e0c5` | Entity convergence endpoint |
| `1b22544` | Timeline endpoint |
| `3ac4769` | Network intelligence endpoint (Brandes betweenness, label propagation) |
| `6792090` | AI synthesis endpoint |
| `8418e26` | Contradiction detection endpoint |
| `bb3046d` | Predictions endpoint |
| `3fd32cd` | Dashboard page + routing + sidebar link |
| `5fcd92e` | Code review fixes (confidence scales, LLM validation, bridge nodes) |
| `57d0ab2` | Guest auth + column name fixes |

### Known Limitations

1. No rate limiting on LLM-powered endpoints (synthesis, predictions)
2. No fetch cancellation on component unmount
3. Betweenness centrality silently skipped for networks > 200 nodes
4. Local D1 requires running `d1-schema.sql` + migrations for dev (tables not auto-created)
5. Workspace scoping not implemented — all queries filter by user ID only
