# Collection API Reference

> **Base URL**: `https://researchtools.net` (production) or `http://localhost:8788` (local)

## Overview

The Collection API manages **agentic research collection jobs** — a lifecycle for dispatching a search query to an external OSINT agent, receiving and storing its results, and curating those results for downstream analysis.

A typical workflow:

```
POST /api/collection/start
        │
        │  (async: Worker fires a request to OSINT agent, returns immediately)
        ▼
   job status = 'running'
        │
        │  (OSINT agent completes, calls back to /api/collection/callback)
        ▼
   job status = 'complete'  ──or──  'error'
        │
        ▼
GET /api/collection/{jobId}/status        ← poll until terminal status
GET /api/collection/{jobId}/results       ← retrieve paginated results
        │
        ▼
POST /api/collection/{jobId}/approve      ← approve + trigger batch analysis
DELETE /api/collection/{jobId}/approve    ← reject unwanted results
```

---

## Authentication

All endpoints (except `callback`) use `getUserFromRequest()`, which resolves a user through three mechanisms in priority order:

| Header | Description |
|--------|-------------|
| `Authorization: Bearer <token>` | JWT token (SSO users), KV session token, or raw hash (≥16 chars) |
| `X-User-Hash` | User account hash from localStorage (`omnicore_user_hash`). Must be ≥16 chars and not `"default"`. |

On first sight of a valid hash, a guest account is auto-provisioned. A missing or invalid identity returns `401`. A transient D1 failure returns `503` with `"Retry-After: 2"`.

The `callback` endpoint does **not** use user auth — it uses a per-job `callback_secret` instead (see [Security Notes](#security-notes)).

---

## Endpoints

---

### POST /api/collection/start

Initiates a new agentic collection job. Inserts a `collection_jobs` row with `status = 'running'` and fires an async request to the OSINT agent container. Returns immediately (HTTP 202) — do not await agent completion here.

**Authentication**: Required (`X-User-Hash` or `Authorization` header).

**Request Body** (`application/json`):

```json
{
  "query": "disinformation campaigns 2024",
  "categories": ["news", "academic"],
  "timeRange": "year",
  "maxResults": 100,
  "useLocalLLM": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Research query. Must be ≥3 characters. |
| `categories` | string[] | No | Subset of valid categories. Defaults to all five: `news`, `academic`, `government`, `social`, `technical`. |
| `timeRange` | string | No | `day`, `week`, `month`, `year`. Defaults to `year`. |
| `maxResults` | number | No | Max results to collect. Defaults to `100`. |
| `useLocalLLM` | boolean | No | Pass `true` to instruct agent to use local LLM. Defaults to `false`. |

**Headers (optional)**:

| Header | Description |
|--------|-------------|
| `X-Workspace-ID` | UUID of an existing workspace to associate this job with. Falls back to the user's personal workspace; auto-creates one if none exists. |

**Response (202):**

```json
{
  "jobId": "uuid",
  "status": "started",
  "message": "Collection job initiated"
}
```

**Error Responses:**

| Status | `error` value | Cause |
|--------|---------------|-------|
| `400` | `"Query must be at least 3 characters"` | `query` missing or too short |
| `401` | `"Authentication required"` | No valid identity in request |
| `500` | `"Failed to start collection"` | Unexpected D1 or runtime error |

**Side Effects:**
- Inserts a row into `collection_jobs` (D1).
- Auto-creates a `workspaces` + `workspace_members` row if the user has no workspace.
- Fires a `POST {OSINT_AGENT_URL}/collect` with a 30-second timeout (non-blocking via `waitUntil`). On agent connection failure, updates job `status` to `'error'`.

---

### POST /api/collection/callback

Internal endpoint called by the OSINT agent when collection is complete. Stores results and queries, then transitions the job to a terminal state.

**Authentication**: No user auth. Verified by per-job `callback_secret` (see [Security Notes](#security-notes)).

**Request Body** — two formats accepted:

**Original format:**

```json
{
  "jobId": "uuid",
  "status": "complete",
  "callbackSecret": "uuid",
  "results": [
    {
      "url": "https://example.com/article",
      "title": "Article Title",
      "snippet": "Summary text",
      "category": "news",
      "source_domain": "example.com",
      "relevance_score": 75,
      "published_date": "2024-03-14",
      "engine": "searxng"
    }
  ],
  "queries": [
    {
      "category": "news",
      "query": "expanded query string",
      "rationale": "LLM rationale",
      "results_count": 12
    }
  ],
  "error": null,
  "llm_used": "gpt-5.4-mini"
}
```

**OSINT Agent container format** (auto-detected by presence of `expandedQueries`):

```json
{
  "jobId": "uuid",
  "status": "completed",
  "query": "original query",
  "expandedQueries": ["query variant 1", "query variant 2"],
  "totalResults": 45,
  "results": [
    {
      "url": "https://example.com/article",
      "title": "Article Title",
      "snippet": "Summary text",
      "source": "searxng",
      "publishedDate": "2024-03-14",
      "relevanceScore": 0.75,
      "category": "news"
    }
  ],
  "startedAt": "2024-03-14T10:00:00Z",
  "completedAt": "2024-03-14T10:02:00Z",
  "error": null
}
```

The callback also accepts the `callbackSecret` via an `X-Collection-Secret` header (preferred over body field).

| Field | Type | Notes |
|-------|------|-------|
| `jobId` | string | Required. Must match an existing job with `status = 'running'` or `'pending'`. |
| `status` | string | `complete` / `completed` → success path. `error` / `failed` → failure path. |
| `callbackSecret` | string | Per-job verification token (see [Security Notes](#security-notes)). |
| `results` | array | Result items. URLs not starting with `http` are filtered out (OSINT format). |
| `queries` | array | Expanded queries used during collection. |
| `error` | string | Error description (set when `status` = `error`/`failed`). |
| `llm_used` | string | Model identifier recorded on the job. |

**Response (200):**

On success:
```json
{
  "received": true,
  "status": "complete",
  "resultsStored": 45,
  "queriesStored": 6
}
```

On error status:
```json
{
  "received": true,
  "status": "error_recorded"
}
```

**Error Responses:**

| Status | `error` value | Cause |
|--------|---------------|-------|
| `400` | `"Job ID required"` | `jobId` missing |
| `403` | `"Invalid callback token"` | `callback_secret` mismatch |
| `404` | `"Job not found"` | `jobId` not in D1 |
| `409` | `"Job is not awaiting results"` | Job already in terminal state |
| `500` | `"Callback processing failed"` | Unexpected error |

**Side Effects:**
- Batch-inserts rows into `collection_results` (D1).
- Batch-inserts rows into `collection_queries` (D1).
- Updates `collection_jobs`: sets `status`, `results_count`, `llm_used`, `completed_at`.

---

### GET /api/collection/{jobId}/status

Returns the current state of a collection job. If the job is still `running`/`pending` and has exceeded the 15-minute timeout, it transitions the job to `error` on first read (lazy timeout pattern).

**Authentication**: Required.

**Path Parameters:**

| Param | Description |
|-------|-------------|
| `jobId` | UUID of the collection job. |

**Response (200) — in-flight job:**

```json
{
  "id": "uuid",
  "workspace_id": "uuid",
  "query": "disinformation campaigns 2024",
  "categories": ["news", "academic"],
  "time_range": "year",
  "max_results": 100,
  "status": "running",
  "results_count": 0,
  "batch_job_id": null,
  "error_message": null,
  "llm_used": null,
  "created_at": "2024-03-14 10:00:00",
  "completed_at": null
}
```

**Response (200) — completed job** (includes `resultsSummary`):

```json
{
  "id": "uuid",
  "workspace_id": "uuid",
  "query": "disinformation campaigns 2024",
  "categories": ["news", "academic"],
  "time_range": "year",
  "max_results": 100,
  "status": "complete",
  "results_count": 45,
  "batch_job_id": "batch-1710410523000",
  "error_message": null,
  "llm_used": "gpt-5.4-mini",
  "created_at": "2024-03-14 10:00:00",
  "completed_at": "2024-03-14 10:02:15",
  "resultsSummary": [
    {
      "category": "news",
      "count": 28,
      "avg_relevance": 71.4
    },
    {
      "category": "academic",
      "count": 17,
      "avg_relevance": 83.2
    }
  ]
}
```

**Job status values:**

| Status | Meaning |
|--------|---------|
| `running` | OSINT agent accepted the job, awaiting callback |
| `pending` | Job queued (legacy; treated same as `running`) |
| `complete` | Agent returned results; `completed_at` is set |
| `error` | Agent failed, connection timed out, or 15-min lazy timeout triggered |

**Error Responses:**

| Status | `error` value | Cause |
|--------|---------------|-------|
| `400` | `"Job ID required"` | Path param missing |
| `401` | `"Authentication required"` | No valid identity |
| `404` | `"Job not found"` | Unknown `jobId` |
| `500` | `"Failed to get status"` | Unexpected error |

---

### GET /api/collection/{jobId}/results

Returns paginated, filterable results for a completed collection job, ordered by `relevance_score` descending.

**Authentication**: Required.

**Path Parameters:**

| Param | Description |
|-------|-------------|
| `jobId` | UUID of the collection job. |

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `category` | string | — | Filter to one category: `news`, `academic`, `government`, `social`, `technical`. Omit for all. |
| `minRelevance` | number | `0` | Minimum `relevance_score` threshold (0–100). |
| `approved` | string | — | Filter by approval state: `pending` (0), `approved` (1), `rejected` (-1), or `all`. Omit for all. |
| `limit` | number | `50` | Page size. Capped at `200`. |
| `offset` | number | `0` | Pagination offset. |

**Response (200):**

```json
{
  "results": [
    {
      "id": "uuid",
      "job_id": "uuid",
      "url": "https://example.com/article",
      "title": "Article Title",
      "snippet": "Summary text...",
      "category": "news",
      "source_domain": "example.com",
      "relevance_score": 82,
      "published_date": "2024-03-14",
      "engine": "searxng",
      "approved": 0,
      "approved_at": null,
      "analysis_id": null,
      "created_at": "2024-03-14 10:02:15"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 45,
    "hasMore": false
  }
}
```

**`approved` field values:**

| Value | Meaning |
|-------|---------|
| `0` | Pending (not yet reviewed) |
| `1` | Approved |
| `-1` | Rejected |

**Error Responses:**

| Status | `error` value | Cause |
|--------|---------------|-------|
| `400` | `"Job ID required"` | Path param missing |
| `401` | `"Authentication required"` | No valid identity |
| `404` | `"Job not found"` | Unknown `jobId` |
| `500` | `"Failed to get results"` | Unexpected error |

---

### POST /api/collection/{jobId}/approve

Marks selected results as approved (`approved = 1`). Optionally triggers a batch analysis job on the approved URLs via `POST /api/tools/batch-process`.

**Authentication**: Required.

**Path Parameters:**

| Param | Description |
|-------|-------------|
| `jobId` | UUID of the collection job. |

**Headers (optional):**

| Header | Description |
|--------|-------------|
| `X-Workspace-ID` | If provided, the job must belong to this workspace (scoped access check). |
| `X-User-Hash` | Forwarded to `POST /api/tools/batch-process` for auth. |

**Request Body** (`application/json`):

```json
{
  "selectedIds": ["uuid-1", "uuid-2", "uuid-3"],
  "analyzeNow": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `selectedIds` | string[] | Yes | IDs of `collection_results` rows to approve. Must be non-empty. |
| `analyzeNow` | boolean | No | Defaults to `true`. If `true`, triggers batch URL analysis on approved items. |

**Response (200) — with `analyzeNow: true`:**

```json
{
  "approved": 3,
  "batchJobId": "batch-1710410523000",
  "status": "analysis_started",
  "urls": 3
}
```

**Response (200) — with `analyzeNow: false`:**

```json
{
  "approved": 3,
  "status": "saved"
}
```

**Error Responses:**

| Status | `error` value | Cause |
|--------|---------------|-------|
| `400` | `"No results selected"` | `selectedIds` empty or missing |
| `400` | `"No valid URLs found"` | Approved result rows had no URLs |
| `401` | `"Authentication required"` | No valid identity |
| `404` | `"Job not found"` | Unknown `jobId` (or workspace mismatch if `X-Workspace-ID` provided) |
| `500` | `"Failed to approve results"` | Unexpected error |
| `502` | `"Batch analysis failed to start"` | Downstream `POST /api/tools/batch-process` returned non-2xx |

**Side Effects:**
- Updates `collection_results`: sets `approved = 1`, `approved_at` on matched rows.
- When `analyzeNow: true`: posts to `POST /api/tools/batch-process` (60s timeout), then updates `collection_jobs.batch_job_id`.

---

### DELETE /api/collection/{jobId}/approve

Marks selected results as rejected (`approved = -1`).

**Authentication**: Required.

**Path Parameters:**

| Param | Description |
|-------|-------------|
| `jobId` | UUID of the collection job. |

**Headers (optional):**

| Header | Description |
|--------|-------------|
| `X-Workspace-ID` | If provided, the job must belong to this workspace. |

**Request Body** (`application/json`):

```json
{
  "selectedIds": ["uuid-1", "uuid-2"]
}
```

**Response (200):**

```json
{
  "rejected": 2,
  "status": "rejected"
}
```

**Error Responses:**

| Status | `error` value | Cause |
|--------|---------------|-------|
| `400` | `"No results selected"` | `selectedIds` empty or missing |
| `401` | `"Authentication required"` | No valid identity |
| `404` | `"Job not found"` | Unknown `jobId` |
| `500` | `"Failed to reject results"` | Unexpected error |

**Side Effects:**
- Updates `collection_results`: sets `approved = -1`, `approved_at` on matched rows.

---

## Job Lifecycle

```
POST /api/collection/start
 └─ DB: INSERT collection_jobs (status='running')
 └─ waitUntil: POST {OSINT_AGENT_URL}/collect  ←── async, fire-and-forget
        │
        │  (agent does work)
        │
        ▼
POST /api/collection/callback              ←── called by OSINT agent
 └─ validates callback_secret
 └─ DB: INSERT collection_results (batch)
 └─ DB: INSERT collection_queries (batch)
 └─ DB: UPDATE collection_jobs (status='complete'|'error')
        │
        ▼
GET /api/collection/{jobId}/status        ←── client polling
 └─ lazy timeout: if running > 15 min → UPDATE status='error'
 └─ if complete: includes resultsSummary by category
        │
        ▼
GET /api/collection/{jobId}/results       ←── retrieve paginated items
        │
        ▼
POST /api/collection/{jobId}/approve      ←── approve + optional analysis
DELETE /api/collection/{jobId}/approve    ←── reject
```

---

## Security Notes

### Callback Secret

Each job gets a unique `callback_secret` (UUID) generated at start time and stored in `collection_jobs.callback_secret`. The secret is forwarded to the OSINT agent in the `AgentCollectionRequest` payload so the agent can echo it back.

On callback, the token is checked from two places (first wins):
1. `X-Collection-Secret` request header
2. `callbackSecret` field in the JSON body

The auth logic follows a backward-compatible rollout:

| Stored secret | Incoming token | Result |
|---------------|----------------|--------|
| Present | Matches | `authenticated` — accepted |
| Present | Differs | `reject` — 403 returned |
| Present | Missing | `unsigned-allowed` — accepted with a `warn` event log entry |
| Absent (pre-migration job) | Any/none | `unsigned-allowed` — accepted |

The `unsigned-allowed` path exists to avoid breaking the live agent during the rollout period when the agent has not yet been updated to echo the secret. Once rollout is complete, the absence of a matching secret should become a hard rejection.

### Workspace Scoping

- `POST /api/collection/start` auto-resolves a valid workspace for the authenticated user, preventing FK violations on `collection_jobs.workspace_id`.
- `POST /api/collection/{jobId}/approve` and `DELETE /api/collection/{jobId}/approve` accept an optional `X-Workspace-ID` header; when present, only jobs owned by that workspace are accessible.
- There is no cross-user job access check on the `status` and `results` endpoints beyond requiring valid authentication — access is gated by knowing the `jobId` (a UUID).

### Status Guard

The callback endpoint enforces that only `running`/`pending` jobs can accept results. A duplicate or late callback on a terminal job (`complete` or `error`) returns `409 Conflict`, preventing result overwrite.
