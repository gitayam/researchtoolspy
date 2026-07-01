# Intelligence Analysis Suite API Reference

> **Base URL**: `https://researchtools.net` (production) or `http://localhost:8788` (local)

## Overview

The Intelligence Analysis Suite provides cross-framework synthesis and operational metrics for the Intelligence dashboard (`/dashboard/intelligence`). It aggregates data from analytical framework sessions (ACH, SWOT, COG, Deception Detection, etc.), entity tables, evidence, and relationship graphs into higher-order insights: KPI summaries, contradiction detection, entity convergence, network graph analysis, AI-generated synthesis, predictive indicators, and activity timelines.

All seven endpoints are read-only (`GET`). Two endpoints call OpenAI via the Cloudflare AI Gateway and are marked **AI-powered**. The remaining five query D1 directly and perform all computation in-process.

---

## Authentication

All endpoints require a valid user session. Authentication is provided via the same headers used across the platform:

| Header | Description |
|--------|-------------|
| `X-User-Hash` | User account hash from localStorage (`omnicore_user_hash`) |
| `Authorization` | Bearer JWT |

All endpoints use `getUserFromRequest()` (strict — returns `null` if unauthenticated). A missing or invalid credential returns `401`. There is no guest-mode fallback on these endpoints.

---

## Endpoints

### GET /api/intelligence/kpi

Returns dashboard summary KPIs: framework counts, entity totals, evidence count, average confidence, deception risk, and coverage gap. All values are computed from live D1 queries — no AI involved.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspace_id` | string | No | Scope entity counts to a specific workspace UUID. Also accepted as `X-Workspace-ID` header. Omit to aggregate across all workspaces. |

**Response (200):**
```json
{
  "active_frameworks": 12,
  "frameworks_by_type": {
    "ach": 3,
    "swot": 2,
    "cog": 1,
    "deception": 2
  },
  "entities_tracked": 47,
  "entities_by_type": {
    "ACTOR": 18,
    "SOURCE": 9,
    "EVENT": 12,
    "PLACE": 5,
    "BEHAVIOR": 3
  },
  "evidence_count": 34,
  "avg_confidence": 72,
  "confidence_sparkline": [65, 70, 68, 75, 80, 72, 74],
  "deception_risk_level": "MEDIUM",
  "deception_risk_score": 2.4,
  "coverage_gap_pct": 38
}
```

| Field | Type | Notes |
|-------|------|-------|
| `active_frameworks` | number | Count of non-archived `framework_sessions` for this user |
| `frameworks_by_type` | object | Keys are `framework_type` values from `framework_sessions` |
| `entities_by_type` | object | Keys are uppercase: `ACTOR`, `SOURCE`, `EVENT`, `PLACE`, `BEHAVIOR` |
| `avg_confidence` | number | 0–100. Extracted from `confidence`, `overall_confidence`, and top ACH hypothesis scores across all framework data blobs |
| `confidence_sparkline` | number[] | Up to 7 data points (most recent frameworks, oldest-first) for a sparkline chart |
| `deception_risk_level` | string | `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` — derived from MOM assessments (`motive + opportunity + means` average) |
| `deception_risk_score` | number | 0–5 scale, rounded to one decimal |
| `coverage_gap_pct` | number | Percentage of entities with no relationships (0–100) |

**Backend**: Pure D1. All sub-queries run in `Promise.all` for a single round-trip.

---

### GET /api/intelligence/contradictions

Detects contradictions between pairs of analytical frameworks belonging to the authenticated user. All detection logic runs in-process on parsed framework data blobs — no AI involved.

**No query parameters.**

**Response (200):**
```json
{
  "contradictions": [
    {
      "description": "ACH analysis \"Operation X\" identifies \"Hypothesis A\" as most likely, but Deception analysis \"Source Review\" rates deception likelihood at 85%",
      "side_a": {
        "framework_type": "ach",
        "session_id": "42",
        "claim": "Hypothesis \"Hypothesis A\" scored highest"
      },
      "side_b": {
        "framework_type": "deception",
        "session_id": "17",
        "claim": "Deception likelihood: 85%"
      },
      "severity": "CRITICAL",
      "suggested_resolution": "Review evidence quality and source reliability. Consider whether key evidence supporting the top ACH hypothesis comes from potentially deceptive sources."
    }
  ],
  "total_count": 1,
  "by_severity": {
    "INFO": 0,
    "WARNING": 0,
    "CRITICAL": 1
  }
}
```

**Detection rules (current):**

| Rule | Frameworks compared | Trigger condition | Severity |
|------|--------------------|--------------------|----------|
| ACH vs Deception | `ach` + `deception` | ACH has a top-scored hypothesis AND deception `likelihood` or `deception_likelihood` > 60% | `WARNING` if > 60%; `CRITICAL` if > 80% |
| SWOT vs COG | `swot` + `cog` | A SWOT strength and a COG vulnerability share ≥ 2 significant words (> 3 chars) | `INFO` |

**Contradiction object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Human-readable summary of the contradiction |
| `side_a` | object | `framework_type`, `session_id` (stringified integer), `claim` |
| `side_b` | object | Same shape as `side_a` |
| `severity` | string | `INFO` / `WARNING` / `CRITICAL` |
| `suggested_resolution` | string | Canned analyst guidance for each rule type |

**Backend**: Pure D1 + in-process logic.

---

### GET /api/intelligence/entities

Returns a ranked list of entities (up to 100) with their relationship count, estimated framework coverage, and MOM risk level. Useful for identifying high-value nodes in an investigation.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspace_id` | string | No | Scope entity query to a workspace. Also accepted as `X-Workspace-ID` header. |

**Response (200):**
```json
{
  "entities": [
    {
      "entity_id": "abc123",
      "entity_name": "John Doe",
      "entity_type": "ACTOR",
      "frameworks_count": 3,
      "convergence_score": 0.75,
      "relationship_count": 6,
      "risk_level": "HIGH",
      "mom_score": 3.2
    }
  ],
  "total_frameworks": 4
}
```

| Field | Type | Description |
|-------|------|-------------|
| `entity_id` | string | TEXT id (cast from integer for actors/places/events/etc.) |
| `entity_type` | string | `ACTOR` / `SOURCE` / `EVENT` / `PLACE` / `BEHAVIOR` |
| `relationship_count` | number | Total edges (as source or target) in the `relationships` table |
| `frameworks_count` | number | Estimated frameworks referencing this entity (heuristic: `min(total_frameworks, ceil(relationship_count / 2))`) |
| `convergence_score` | number | 0.0–1.0 — `frameworks_count / total_frameworks` |
| `risk_level` | string | `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` for ACTOR type, `null` for others (derived from average MOM score from `mom_assessments`) |
| `mom_score` | number \| null | Average of `(motive + opportunity + means) / 3` for ACTORs; `null` for other types. Scale 0–5, rounded to one decimal. |

Results are ordered by `relationship_count` descending, limit 100.

**Backend**: Pure D1.

---

### GET /api/intelligence/network

Returns a full network graph of entity relationships with graph-theoretic centrality metrics and community detection. Supports graphs up to ~200 nodes before betweenness centrality is skipped for performance.

**No query parameters.** Includes both user-owned and public entities.

**Response (200):**
```json
{
  "nodes": [
    {
      "id": "55",
      "name": "Organization Alpha",
      "type": "ACTOR",
      "community_id": 0,
      "degree_centrality": 0.667,
      "betweenness_centrality": 0.312,
      "frameworks_count": 0
    }
  ],
  "edges": [
    {
      "source": "55",
      "target": "72",
      "relationship_type": "FUNDS",
      "confidence": 0.75
    }
  ],
  "communities": [
    {
      "id": 0,
      "members": ["55", "72"],
      "dominant_type": "ACTOR",
      "size": 2
    }
  ],
  "key_influencers": [
    {
      "entity_id": "55",
      "entity_name": "Organization Alpha",
      "composite_score": 0.454,
      "role": "Information broker"
    }
  ],
  "bridge_nodes": ["81"],
  "metrics": {
    "total_nodes": 12,
    "total_edges": 18,
    "community_count": 3,
    "network_density": 0.273
  }
}
```

**Node fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Entity ID (TEXT) |
| `type` | string | `ACTOR`, `SOURCE`, `EVENT`, `PLACE`, `BEHAVIOR`, or `UNKNOWN` |
| `community_id` | number | Integer community label from label propagation (0-indexed, sequential) |
| `degree_centrality` | number | Degree / max degree in graph, 0–1, 3 decimal places |
| `betweenness_centrality` | number | Brandes algorithm, normalized. 0 when graph > 200 nodes. |
| `frameworks_count` | number | Always `0` in current implementation (reserved for future join) |

**Edge `confidence` values** are mapped from string to float:

| DB value | Float |
|----------|-------|
| `CONFIRMED` | 1.0 |
| `PROBABLE` | 0.75 |
| `POSSIBLE` | 0.5 |
| `SUSPECTED` | 0.25 |
| other | 0.5 |

**`key_influencers`**: Top 5 nodes by composite score (`degree * 0.4 + betweenness * 0.6`). Role is `"Information broker"` if betweenness > degree, else `"Central connector"`.

**`bridge_nodes`**: Entity IDs where `betweenness_centrality > 0.1` AND `degree_centrality < 0.5`.

**Backend**: Pure D1 + in-process graph algorithms (degree centrality, Brandes betweenness, label propagation community detection — no external graph library).

---

### GET /api/intelligence/synthesis

**AI-powered.** Sends up to 20 recent framework sessions to OpenAI (`gpt-5.4-mini`) for cross-framework synthesis. Returns key findings, convergence points, AI-detected contradictions, and an overall confidence score.

Returns an empty structure (all arrays empty, `overall_confidence: 0`) if the user has no active frameworks, without calling the AI.

**No query parameters.**

**Response (200):**
```json
{
  "key_findings": [
    {
      "finding": "Multiple frameworks confirm Organization Alpha as the primary threat actor",
      "supporting_frameworks": ["ach", "cog", "swot"],
      "confidence": 85,
      "evidence_count": 7
    }
  ],
  "convergence_points": [
    {
      "description": "ACH and COG both identify supply chain as a critical vulnerability",
      "frameworks": [
        { "type": "ach", "session_id": "42", "element": "Hypothesis: supply chain attack" },
        { "type": "cog", "session_id": "17", "element": "Vulnerability: logistics dependency" }
      ],
      "strength": "strong"
    }
  ],
  "contradictions": [
    {
      "description": "...",
      "side_a": { "framework_type": "ach", "session_id": "42", "claim": "..." },
      "side_b": { "framework_type": "swot", "session_id": "9", "claim": "..." },
      "severity": "WARNING",
      "suggested_resolution": "..."
    }
  ],
  "overall_confidence": 78,
  "confidence_breakdown": [
    { "framework_type": "ach", "confidence": 82 },
    { "framework_type": "swot", "confidence": 70 }
  ],
  "generated_at": "2026-06-30T14:22:01.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `key_findings[].confidence` | number | 0–100 |
| `key_findings[].evidence_count` | number | LLM estimate based on framework data |
| `convergence_points[].strength` | string | `"strong"` / `"moderate"` / `"weak"` |
| `overall_confidence` | number | 0–100 |
| `generated_at` | string | ISO 8601 timestamp of when the response was generated |

**AI model**: `gpt-5.4-mini` via Cloudflare AI Gateway. Response cached for 300 seconds. `max_completion_tokens: 4000`.

**Data sent to AI**: Per-framework data is truncated by type before the prompt:
- `ach` — up to 10 hypotheses (name, score, description ≤ 200 chars)
- `swot` — up to 10 items per quadrant (text only)
- `cog` — up to 10 COGs (name, actor_category, 3 capabilities, 3 vulnerabilities)
- `deception` — likelihood score, up to 10 claims (claim ≤ 200 chars, risk_level), mom_summary
- other types — full JSON if ≤ 500 chars, else truncated to 500 chars

**Backend**: D1 + OpenAI via AI Gateway.

---

### GET /api/intelligence/predictions

**AI-powered.** Sends up to 15 recent framework sessions and up to 50 known entities (actors, sources, events) to OpenAI (`gpt-5.4-mini`) for forward-looking intelligence recommendations. Returns a watch list, emerging patterns, collection gaps, and risk trajectory.

Returns an empty structure with `risk_trajectory: "STABLE"` if the user has no active frameworks, without calling the AI.

**No query parameters.**

**Response (200):**
```json
{
  "watch_list": [
    {
      "entity_or_topic": "Organization Alpha",
      "reason": "Consistently appears across multiple analyses with increasing confidence",
      "priority": "HIGH",
      "related_frameworks": ["ach", "cog"]
    }
  ],
  "emerging_patterns": [
    {
      "description": "Escalating financial flows coincide with increased TTPs in behavior analysis",
      "confidence": 72
    }
  ],
  "collection_gaps": [
    {
      "area": "Source reliability verification",
      "current_evidence_count": 2,
      "recommended_action": "Seek corroborating HUMINT sources",
      "impact_if_filled": "Would increase ACH confidence from 60% to ~80%"
    }
  ],
  "risk_trajectory": "ESCALATING",
  "risk_trajectory_reasoning": "Three independent frameworks show increasing severity scores over the past two weeks.",
  "generated_at": "2026-06-30T14:22:01.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `watch_list[].priority` | string | `LOW` / `MEDIUM` / `HIGH` |
| `emerging_patterns[].confidence` | number | 0–100 |
| `risk_trajectory` | string | `ESCALATING` / `STABLE` / `DE_ESCALATING` — validated against allowed values; defaults to `STABLE` if LLM returns unexpected value |
| `generated_at` | string | ISO 8601 timestamp |

**AI model**: `gpt-5.4-mini` via Cloudflare AI Gateway. Response cached for 600 seconds. `max_completion_tokens: 3000`.

**Data sent to AI**: Each framework's `data` blob is truncated to 300 characters. Entity list is name + type, up to 50 items. Evidence count is passed as a scalar.

**Backend**: D1 + OpenAI via AI Gateway.

---

### GET /api/intelligence/timeline

Returns a time-series breakdown of analytical activity: frameworks created/updated per day, evidence added per day, entities added per day, cumulative evidence accumulation, and notable milestones. All values come from D1 — no AI involved.

**No query parameters.**

**Response (200):**
```json
{
  "activity": [
    {
      "date": "2026-06-01",
      "frameworks_created": 2,
      "frameworks_updated": 1,
      "evidence_added": 5,
      "entities_added": 3
    }
  ],
  "evidence_accumulation": [
    {
      "date": "2026-06-01",
      "cumulative": 5
    },
    {
      "date": "2026-06-02",
      "cumulative": 11
    }
  ],
  "milestones": [
    {
      "date": "2026-05-28",
      "type": "first_framework",
      "description": "First analysis created (ach)"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `activity` | object[] | One entry per calendar day where any activity occurred. Dates are UTC `DATE()` values. |
| `activity[].frameworks_updated` | number | Count of framework rows where `updated_at > created_at` on that date |
| `evidence_accumulation` | object[] | Cumulative `evidence_items` count at end of each active day |
| `milestones` | object[] | Currently contains one entry: `first_framework` (type of the earliest framework session). More milestone types may be added. |

**Backend**: Pure D1. Four queries run in `Promise.all`.

---

## Endpoint Summary

| Endpoint | Method | AI-powered | Query params |
|----------|--------|------------|--------------|
| `/api/intelligence/kpi` | GET | No | `workspace_id` |
| `/api/intelligence/contradictions` | GET | No | — |
| `/api/intelligence/entities` | GET | No | `workspace_id` |
| `/api/intelligence/network` | GET | No | — |
| `/api/intelligence/synthesis` | GET | Yes (gpt-5.4-mini, cached 5m) | — |
| `/api/intelligence/predictions` | GET | Yes (gpt-5.4-mini, cached 10m) | — |
| `/api/intelligence/timeline` | GET | No | — |

## Error Responses

All endpoints return a JSON error body on failure:

```json
{ "error": "Authentication required" }
```

| Status | Meaning |
|--------|---------|
| 401 | Missing or invalid `X-User-Hash` / `Authorization` header |
| 500 | Internal server error (D1 query failure or AI gateway error) |

The AI endpoints (`synthesis`, `predictions`) return a `200` with valid empty-structure responses rather than a `503` when the AI gateway returns a refusal.
