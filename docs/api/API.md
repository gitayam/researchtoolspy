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
| Apify scrapers | 10 req / min per user |
| Gateway global | 100 req / min per user · 3 000 req / hr total |

---

## API surface (by area)

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

### Web scraping

| Endpoint | Description |
|----------|-------------|
| `POST /api/web-scraper` | Authenticated, bounded single-page metadata/text extraction |

Request, response, safety, dataset, score, and migration details are documented in [`SCRAPING-API.md`](SCRAPING-API.md).

### Tools

| Endpoint | Description |
|----------|-------------|
| `POST /api/tools/rage-check` | Detect manipulative framing / outrage-bait in a URL |
| `POST /api/tools/batch-process` | Batch run `analyze-url` across multiple URLs |
| `POST /api/tools/claim-match` | Match extracted claims to evidence |
| `POST /api/tools/timeline-extract` | Extract a timeline from text / URL |

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
