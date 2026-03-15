# ResearchTools.net - Claude Code Integration Guide

## Quick Start

```bash
source scripts/cop-api.sh   # loads all COP functions, reads .env automatically
cop_help                     # list all available functions
```

Or manually — all API calls require auth via `X-User-Hash` header:

```bash
export HASH=$(grep RESEARCHTOOLS_USER_HASH .env | cut -d= -f2)
export API=https://researchtools.net
```

## COP Session Management

### Get session
```bash
curl -s "$API/api/cop/sessions/SESSION_ID" -H "X-User-Hash: $HASH"
```

### Update session (mission brief, linked frameworks, layers, etc.)
```bash
curl -s -X PUT "$API/api/cop/sessions/SESSION_ID" \
  -H "Content-Type: application/json" -H "X-User-Hash: $HASH" \
  -d '{"mission_brief":"...", "linked_frameworks":["starbursting","mom-pop"]}'
```

Updatable fields: `name`, `description`, `status`, `mission_brief`, `event_type`, `event_description`, `active_layers` (JSON array), `layer_config` (JSON object), `linked_frameworks` (JSON array), `key_questions` (JSON array), `event_facts` (JSON array), `content_analyses` (JSON array), `is_public` (boolean), `global_alerts_enabled` (boolean), `global_alerts_region` (string), bbox/center/zoom fields.

### Create session
```bash
curl -s -X POST "$API/api/cop/sessions" \
  -H "Content-Type: application/json" -H "X-User-Hash: $HASH" \
  -d '{"name":"Session Name","description":"...","template_type":"custom"}'
```

## RFIs (Requests for Information)

### List RFIs
```bash
curl -s "$API/api/cop/SESSION_ID/rfis" -H "X-User-Hash: $HASH"
```

### Create RFI
```bash
curl -s -X POST "$API/api/cop/SESSION_ID/rfis" \
  -H "Content-Type: application/json" -H "X-User-Hash: $HASH" \
  -d '{"question":"...","priority":"critical|high|medium|low","is_blocker":true}'
```

### Update RFI (status, answer, priority)
```bash
curl -s -X PUT "$API/api/cop/SESSION_ID/rfis" \
  -H "Content-Type: application/json" -H "X-User-Hash: $HASH" \
  -d '{"id":"rfi-xxx","status":"answered","answer":"...","priority":"high"}'
```

RFI statuses: `open`, `answered`, `closed`, `blocked`

## Entities (Actors, Events, Sources, Places, Behaviors)

### List entities
```bash
curl -s "$API/api/actors?workspace_id=WORKSPACE_ID" -H "X-User-Hash: $HASH"
# Same pattern for: events, sources, places, behaviors
```

### Create entity (POST to same endpoint with entity-specific fields)
```bash
curl -s -X POST "$API/api/actors" \
  -H "Content-Type: application/json" -H "X-User-Hash: $HASH" \
  -d '{"name":"...","type":"PERSON","workspace_id":"WORKSPACE_ID"}'
```

Actor types: `PERSON`, `ORGANIZATION`, `UNIT`, `GOVERNMENT` (MUST be uppercase)

## COP Sub-endpoints (all under `/api/cop/SESSION_ID/`)

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `stats` | GET | Session statistics |
| `hypotheses` | GET, POST, PUT | Analytical hypotheses |
| `tasks` | GET, POST, PUT | Task board items |
| `timeline` | GET, POST, PUT, DELETE | Timeline entries |
| `evidence` | GET, POST | Evidence items |
| `markers` | GET, POST, PUT, DELETE | Map markers |
| `personas` | GET, POST, PUT | Analytical personas |
| `claims` | GET, POST, PUT | Claims tracking |
| `alerts` | GET, POST | Alert management |
| `activity` | GET | Activity feed |
| `shares` | GET, POST, DELETE | Public sharing links |
| `layers/*` | GET | Map layer data (actors, events, places, relationships, acled, gdelt, analysis, assets) |

## Workspace ID

COP sessions have a `workspace_id` field (usually `cop-SESSION_ID`). Entity endpoints use this, not the session ID. Get it from the session response.

## Auth Notes

- `X-User-Hash` header: auto-creates guest user if hash doesn't exist (min 16 chars)
- Hash from `.env` (`RESEARCHTOOLS_USER_HASH`) is the default for CLI operations
- COP GET endpoints (layers, stats) don't require auth
- COP mutation endpoints (POST/PUT/DELETE) require auth

## Deploy

```bash
npx vite build && npx wrangler pages deploy dist/ --project-name=researchtoolspy
```

## Dev

```bash
# Separate processes (wrangler pages dev is broken with vite proxy)
npx wrangler pages dev --port 8788
npx vite  # port 5173, proxies /api to 8788
```

## Database

- D1 (SQLite) on Cloudflare
- Schema: `schema/d1-schema.sql` + `schema/migrations/*.sql`
- Remote queries: `npx wrangler d1 execute researchtoolspy-db --remote --command "SELECT ..."`
- Entity tables use `created_by` (not `user_id`), `workspace_id`, TEXT IDs
