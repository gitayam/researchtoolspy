# ResearchTools API — Overview

**Base URL (prod):** `https://researchtools.net/api`  
**Base URL (dev):** `http://localhost:8788/api`  
**Runtime:** Cloudflare Pages Functions (each file in `functions/api/` = one route)

---

## Authentication

External API clients that mutate data or read private resources require a **user hash** passed as a request header:

```http
X-User-Hash: <your-16+-character-hash>
```

A hash auto-creates an account on first use (no registration step required). Hashes are permanent — back yours up via `/dashboard/settings`.

**Minimum length:** 16 characters. Shorter hashes are rejected with `400 Bad Request`.

### Obtaining a hash

- **New user:** use **Save Bookmark** in the dashboard to create a permanent hash.
- **CLI / scripts:** copy the hash from your settings page and export it:
  ```bash
  export RESEARCHTOOLS_USER_HASH="your-hash-here"
  ```

### Browser guest sessions

The dashboard can be used without login. The frontend creates a cryptographically
random, seven-day guest session and sends both headers below on API requests:

```http
X-Guest-Session: guest_<uuid>
X-Workspace-ID: guest-workspace-<uuid>
```

The server hashes the guest session before resolving its isolated guest principal,
validates the workspace identifier, and creates only that principal's temporary
workspace. A supplied workspace ID is never attached when it belongs to another
principal. Guest and permanent-account state remain distinct in the client.

Guest access is intentionally temporary and does not enable saved/bookmarked
work, collaboration, teams, or groups. **Save Bookmark requires login or account
creation.** After successful authentication, `POST /api/guest-conversions`
proves possession of the active guest session, transfers that session's isolated
workspace and user-scoped records to the authenticated account, then revokes the
guest credential. The raw guest session is never stored in D1.

Unconverted guest work expires after seven days. The daily, secret-guarded
`POST /api/cron/cleanup-guests` retention job removes expired temporary data;
`GET` (or `POST ?dry=1`) reports the count without deleting anything.

These headers are an internal browser-session transport, not a replacement for a
permanent API credential. CLI and integration clients should use `X-User-Hash`.

### JWT and Bearer tokens

The API also accepts supported JWT/session bearer credentials. For hash-auth clients,
the raw hash is the credential and must be passed as `X-User-Hash`.

### Auth helpers (`functions/api/_shared/auth-helpers.ts`)

| Helper | Behaviour |
|--------|-----------|
| `getUserFromRequest(req, env)` | Resolves JWT, hash, or valid guest session; returns a user ID or `null`; datastore failures throw `AuthDbError` |
| `getUserIdOrDefault(req, env)` | Compatibility alias; returns a user ID or `null` and never falls back to another user |
| `requireAuth(req, env)` | Returns a resolved user ID, throws `401` for no identity, or retryable `503` for auth-datastore failure |

### Community service integrations

Non-interactive community services use a separate scoped identity and never use
user hashes, guest sessions, or browser sessions. Capability discovery and the
current rollout boundary are documented in
[`COMMUNITY-INTEGRATIONS-API.md`](COMMUNITY-INTEGRATIONS-API.md).

---

## Error responses

```json
{ "error": "Human-readable message", "details": "Optional extra context" }
```

Standard HTTP status codes: `400` bad input · `401` auth required · `403` access denied · `404` not found · `410` endpoint retired · `429` rate limited · `500` server error.

---

## Rate limits

| Scope | Limit |
|-------|-------|
| Auth endpoints | 5 req / min per IP |
| Registration | 10 req / min per IP |
| AI endpoints | 40 req / min per user |
| Public Content Intelligence analysis | 12 req / hr per source IP |
| Recognized first-party Content Intelligence analysis | 600 req / hr per service by default; bounded and configurable |
| Apify scrapers | 10 req / min per user |
| Gateway global | 100 req / min per user · 3 000 req / hr total |

First-party rate classification is not authentication. In particular,
`X-Service-Key` does not grant supplied-content access, persistence, workspace
access, or a scoped service capability.

---

## API surface (by area)

### Community integrations

| Endpoint | Description |
|----------|-------------|
| `GET /api/integrations/capabilities` | Anonymous/public and scoped-service capability discovery |

### Core entity endpoints

| Prefix | Description |
|--------|-------------|
| `/api/actors` | People, orgs, units — CRUD + search + credibility |
| `/api/sources` | Intelligence sources (HUMINT, OSINT, etc.) |
| `/api/events` | Documented events |
| `/api/places` | Geolocated places |
| `/api/behaviors` | Behaviors / TTPs |
| `/api/relationships` | Entity-to-entity relationships |
| `/api/evidence-items` | **Canonical evidence store** (replaces legacy `/api/evidence` — now 410 Gone) |
| `/api/answer-packets` | Grounded, investigation-scoped cited answers; see [`ANSWER-PACKETS-API.md`](ANSWER-PACKETS-API.md) |

### Analytical frameworks

| Prefix | Description |
|--------|-------------|
| `/api/frameworks` | List / CRUD for all framework sessions |
| `/api/ach/*` | Analysis of Competing Hypotheses (ACH) |
| `/api/claims/*` | Claim extraction, evidence linking, credibility |
| `/api/deception/*` | Deception / SATS analysis |
| `/api/ai/*` | AI-powered helpers (COG analysis, SWOT populate, question generation, summaries, report enhancement) |

### COM-B / Behaviour Change Wheel

Documented separately: [`COM_B_API.md`](COM_B_API.md)

### COP Workspace

Full reference: [`COP-WORKSPACE-API.md`](COP-WORKSPACE-API.md)

Prefix: `/api/cop/*` — sessions, markers, RFIs, evidence, hypotheses, tasks, personas, timelines, intake forms, playbooks, assets, exports, CoT feed, scraping, and more.

### Research intake & collection

| Prefix | Description |
|--------|-------------|
| `/api/research/*` | Research questions, forms (builder), submissions, evidence/task management |
| `/api/surveys/public/:token/submit` | Public survey submission (authenticated source) |
| `/api/surveys/public/:token/drop-submit` | **Anonymous drop-spot** — journalist-grade, no IP/UA collected |
| `/api/collection/*` | Agentic research job lifecycle (start → callback → status → results → approve) |

Collection API documented separately: [`COLLECTION-API.md`](COLLECTION-API.md)

Research Question Generator documented separately: [`RESEARCH_QUESTION_GENERATOR_API.md`](RESEARCH_QUESTION_GENERATOR_API.md)

### Intelligence synthesis

Documented separately: [`INTELLIGENCE-API.md`](INTELLIGENCE-API.md)

Prefix: `/api/intelligence/*` — synthesis, predictions, network analysis, entity analysis, contradictions, KPIs, timeline.

### Content Intelligence

| Endpoint | Description |
|----------|-------------|
| `POST /api/content-intelligence/analyze-url` | Full URL extraction (entities, claims, text, archive) |
| `POST /api/content-intelligence/summarize-entity` | AI summary for an entity |

The URL/supplied-content request and response contract, Signal/RSS bridge,
access matrix, retry rules, rate limits, and persistence semantics are documented
in [`CONTENT-INTELLIGENCE-API.md`](CONTENT-INTELLIGENCE-API.md).

`analyze-url` supports public ephemeral analysis; saving, loading saved work, or
writing into a workspace requires authenticated write authority. HTML candidates
are accepted only after the same article-quality gate at every bounded stage.
A thin direct response therefore continues through the configured archive and
alternate-source chain instead of becoming an immediate `422`.

Successful responses expose `content_source`, `fallback_attempts`, and
`extraction_quality`. If every candidate fails the quality gate, the endpoint
returns `422` with code `INSUFFICIENT_CONTENT`, those same provenance fields,
and the strongest partial candidate's quality assessment. Transport failures also
return `422` with `content_source` and `fallback_attempts`; callers should present
the returned archive/open-source options rather than silently treating a login or
loader page as article content.

### Web scraping

| Endpoint | Description |
|----------|-------------|
| `POST /api/web-scraper` | Authenticated, bounded single-page metadata/text extraction |

Request, response, safety, dataset, score, and migration details are documented in [`SCRAPING-API.md`](SCRAPING-API.md).

### Tools

| Endpoint | Description |
|----------|-------------|
| `POST /api/tools/extract-claims` | Extract claims/entities from analysis-grade URL content |
| `POST /api/tools/extract-timeline` | Extract dated timeline events from analysis-grade URL content |
| `POST /api/tools/rage-check` | Detect manipulative framing / outrage-bait in analysis-grade URL content |
| `POST /api/tools/batch-process` | Batch run `analyze-url` across multiple URLs |
| `POST /api/tools/claim-match` | Match extracted claims to evidence |

The three URL-analysis tools above require authentication. They use the shared
`analysis-candidate.v1` quality policy and may recover eligible thin or blocked
public pages through bounded exact-host Archive.ph and Wayback adapters. Success
responses include `content_source`, ordered `fallback_attempts`, and
`extraction_quality`. If no source passes the purpose-specific evidence floor,
the route returns `422` with the same provenance and does not invoke its AI model.
Open Graph headline/description metadata alone is never accepted for claims.

#### Timeline analysis v1

`POST /api/tools/extract-timeline` accepts both the legacy `{ "url": "..." }`
body and the versioned `timeline-analysis.v1` contract. New integrations must
discover `timelineAnalysis: true`, hold `community.research.execute`, and send
the versioned form with an `rt_svc_` bearer:

```json
{
  "schemaVersion": "timeline-analysis.v1",
  "url": "https://publisher.example/2026/09/story",
  "content": {
    "text": "optional caller-recovered article text",
    "title": "Optional title",
    "publishedAt": "2026-09-08",
    "source": "publisher-feed"
  }
}
```

`content` is optional and bounded to 100 KiB; the complete JSON request is
bounded to 112 KiB and an oversized request returns `413`. Its `source` is one of
`bot-scrape`, `content-intelligence`, `publisher-feed`, or `browser-render`.
Supplied text still passes the timeline quality floor; it does not bypass
evidence checks. `publishedAt` accepts a calendar-valid `YYYY`, `YYYY-MM`, or
`YYYY-MM-DD` value (strict ISO timestamps are normalized to the day). For live
scrapes, publication metadata is used only when the article extractor supplies
a valid value; dates are never inferred from URL paths.

Versioned success responses include `requestId`, `outcome`, article metadata,
events, extraction provenance, and model status. Every event carries an
`eventDate` plus `datePrecision` (`year`, `month`, or `day`). Invalid or missing
model dates are rejected rather than replaced with the current date. An empty,
valid model result is `200` with `outcome: "no_events"`; malformed model output
is `502`. Unavailable or quality-rejected content is `422`, which is the only
response callers should use to trigger a bounded supplied-content recovery.
Authentication, scope, network, and model failures must not trigger more
scraping. Service errors use `integration-error.v1`; legacy errors retain the
older response shape during migration.

The model receives complete extracted text up to 64,000 characters. For longer
sources, the route selects date-bearing passages with neighboring context from
across the document instead of silently keeping only the beginning. Returned
events are deduplicated and sorted by their precision-preserving ISO date.

Browser users can access this contract without signing in through the dedicated
`/dashboard/tools/timeline` research tool. The browser sends an isolated,
seven-day guest session and does not persist results. Content Intelligence also
exposes Timeline as an on-demand analysis section; that integration submits the
already-extracted article text with `source: "content-intelligence"`, avoiding a
second network retrieval. Saving, sharing, and workspace collaboration continue
to require sign-in and an authorized writable workspace.

### Settings & data

| Endpoint | Description |
|----------|-------------|
| `GET /PUT /api/settings/user` | User preferences |
| `GET /api/settings/data/export` | GDPR-style full data export |
| `POST /api/settings/hash/backup` | Download encrypted hash backup |

### Observability

| Endpoint | Description |
|----------|-------------|
| `GET /api/cron/event-logs` | Query server-side error/refusal/audit logs (requires `X-Cron-Secret`) |
| `POST /api/client-error` | Browser error reporting (called automatically by `RouteErrorBoundary`) |

---

## Development

```bash
# Two separate processes (wrangler 4.40+ — combined command is broken):
npx wrangler pages dev --port 8788   # API on :8788
npx vite                              # Frontend on :5173, proxies /api → :8788
```

Local D1: apply `schema/d1-schema.sql` then all `schema/migrations/*.sql`.

```bash
# Deploy
npx vite build && npx wrangler pages deploy dist/ --project-name=researchtoolspy
# or
./deploy.sh   # full: build + migrations + deploy + verify
```

---

## Retired endpoints

| Old path | Status | Replacement |
|----------|--------|-------------|
| `GET/POST /api/evidence` | **410 Gone** | `/api/evidence-items` |
| `GET /api/content-intelligence/screenshot` | **404** (never implemented) | Pending screenshot service (F-5) |
