# COP Workspace API Reference

> **Base URL**: `https://researchtools.net` (production) or `http://localhost:8788` (local)

## Authentication

All endpoints accept optional authentication via headers:

| Header | Description |
|--------|-------------|
| `X-User-Hash` | User account hash from localStorage (`omnicore_user_hash`) |
| `X-Workspace-ID` | Workspace UUID for scoped operations |
| `Authorization` | Bearer token (JWT) for authenticated users |

Most COP endpoints use `getUserIdOrDefault()` which falls back to user 1 for guest mode. Entity endpoints use `checkWorkspaceAccess()` which checks `owner_id`, `workspace_members`, and `is_public`.

---

## Workspace Creation

### POST /api/workspaces

Creates an investigation + COP session atomically. Auto-creates a personal workspace if the user doesn't have one.

**Request Body:**
```json
{
  "title": "Persona Farm Investigation",
  "description": "Reddit to Telegram to OnlyFans persona farm",
  "investigation_type": "structured_research",
  "cop_template": "event_analysis",
  "center_lat": -41.13,
  "center_lon": -71.30,
  "zoom": 12,
  "rolling_hours": 24,
  "active_layers": ["tactical-markers"],
  "key_questions": ["Where are the personas located?"],
  "tags": ["osint", "persona-farm"]
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `title` | string | Yes | - |
| `investigation_type` | string | Yes | `structured_research`, `general_topic`, `rapid_analysis` |
| `cop_template` | string | Yes | `quick_brief`, `event_monitor`, `area_study`, `crisis_response`, `event_analysis`, `custom` |
| `center_lat` | number | No | -90 to 90 |
| `center_lon` | number | No | -180 to 180 |
| `rolling_hours` | number | No | Default 24. Set `null` for no rolling window |
| `key_questions` | string[] | No | Initial key questions |
| `tags` | string[] | No | Investigation tags |

**Response (201):**
```json
{
  "success": true,
  "investigation_id": "uuid",
  "cop_session_id": "cop-b0f96023-cdf"
}
```

---

## COP Sessions

### GET /api/cop/sessions

List COP sessions. Filters by workspace if `X-Workspace-ID` header is provided.

**Query Params:** `?workspace_id=uuid&status=ACTIVE&limit=50`

**Response:**
```json
{
  "sessions": [
    {
      "id": "cop-b0f96023-cdf",
      "name": "Investigation Name",
      "template_type": "event_analysis",
      "status": "ACTIVE",
      "workspace_id": "6fde45ce-...",
      "center_lat": -41.13,
      "center_lon": -71.30,
      "active_layers": ["tactical-markers"],
      "key_questions": ["Where are the personas?"],
      "event_facts": [...],
      "mission_brief": "Geolocate the persona farm operator",
      "created_at": "2026-03-08T..."
    }
  ]
}
```

### POST /api/cop/sessions

Create a new COP session (standalone, without investigation wrapper).

**Request Body:**
```json
{
  "name": "Session Name",
  "template_type": "event_analysis",
  "center_lat": -41.13,
  "center_lon": -71.30,
  "rolling_hours": 24,
  "key_questions": ["Q1"],
  "active_layers": []
}
```

### GET /api/cop/sessions/:id

Get a single COP session with all JSON fields parsed.

### PUT /api/cop/sessions/:id

Update session fields. All fields are optional.

**Request Body (all optional):**
```json
{
  "name": "Updated Name",
  "mission_brief": "New mission objective",
  "active_layers": ["tactical-markers", "acled"],
  "key_questions": ["Q1", "Q2"],
  "event_facts": [{"text": "TIP bus confirmed Bariloche"}],
  "center_lat": -41.13,
  "center_lon": -71.30,
  "zoom_level": 14,
  "status": "ACTIVE",
  "is_public": true
}
```

**Updatable scalar fields:** `name`, `description`, `template_type`, `status`, `bbox_*`, `center_lat`, `center_lon`, `zoom_level`, `time_window_start`, `time_window_end`, `rolling_hours`, `event_type`, `event_description`, `mission_brief`

**Updatable JSON fields:** `active_layers`, `layer_config`, `linked_frameworks`, `key_questions`, `event_facts`, `content_analyses`

### DELETE /api/cop/sessions/:id

Soft-delete (archives) a COP session. Sets `status = 'ARCHIVED'`.

---

## Markers (Tactical)

### GET /api/cop/:id/markers

List all markers for a COP session, ordered by `event_time DESC`.

**Response:**
```json
{
  "markers": [
    {
      "id": "mkr-abc123",
      "uid": "uuid",
      "lat": -41.13,
      "lon": -71.30,
      "label": "Bariloche Ski Resort",
      "confidence": "CONFIRMED",
      "rationale": "TIP bus and Jackie Smith bag confirmed",
      "source_type": "EVIDENCE",
      "detail": {},
      "event_time": "2026-03-08T...",
      "stale_time": "2026-03-08T..."
    }
  ]
}
```

### POST /api/cop/:id/markers

Create a new tactical marker. Creates a changelog entry automatically.

**Request Body:**
```json
{
  "lat": -41.13,
  "lon": -71.30,
  "label": "Bariloche Ski Resort",
  "description": "Multiple evidence items confirm this location",
  "confidence": "CONFIRMED",
  "rationale": "TIP bus, Jackie Smith bag, Cerro Catedral photos",
  "cot_type": "a-f-G",
  "callsign": "BARILOCHE-01",
  "source_type": "EVIDENCE",
  "source_id": "evidence-id",
  "stale_minutes": 60,
  "icon": null,
  "color": null,
  "detail": {}
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `lat` | number | Yes | -90 to 90 |
| `lon` | number | Yes | -180 to 180 |
| `confidence` | string | No | `CONFIRMED`, `PROBABLE`, `POSSIBLE`, `SUSPECTED`, `DOUBTFUL` (default: `POSSIBLE`) |
| `source_type` | string | No | `MANUAL`, `ENTITY`, `ACLED`, `GDELT`, `FRAMEWORK`, `EVIDENCE`, `HYPOTHESIS` |
| `stale_minutes` | number/null | No | 1-1440, or `null` for no expiration (default: 5) |
| `cot_type` | string | No | CoT type code for ATAK (default: `a-u-G`) |

### PUT /api/cop/:id/markers

Update marker confidence, rationale, label, description, or position.

**Request Body:**
```json
{
  "id": "mkr-abc123",
  "confidence": "CONFIRMED",
  "rationale": "Multiple corroborating evidence items",
  "label": "Updated Label",
  "lat": -41.14,
  "lon": -71.31
}
```

---

## Marker Changelog

### GET /api/cop/:id/marker-changelog

List changelog entries for marker updates. Provides audit trail.

**Query Params:** `?marker_id=mkr-abc123`

### POST /api/cop/:id/marker-changelog

Create a manual changelog entry for a marker.

```json
{
  "marker_id": "mkr-abc123",
  "action": "confidence_changed",
  "notes": "Downgraded after second review",
  "previous_value": "CONFIRMED",
  "new_value": "PROBABLE"
}
```

| Field | Values |
|-------|--------|
| `action` | `created`, `moved`, `confidence_changed`, `rationale_updated`, `evidence_linked`, `deleted` |

---

## RFIs (Requests for Information)

### GET /api/cop/:id/rfis

List RFIs with answers, ordered by priority then date.

**Response:**
```json
{
  "rfis": [
    {
      "id": "rfi-abc123",
      "question": "What bus company is in the ski resort photo?",
      "priority": "high",
      "status": "answered",
      "is_blocker": 0,
      "requester_name": "Analyst 1",
      "answers": [
        {
          "id": "rfa-xyz789",
          "answer_text": "TIP - Turismo Integral Patagonico, Argentine bus company",
          "source_description": "TIP website",
          "responder_name": "OSINT Bot",
          "is_accepted": 1,
          "created_at": "..."
        }
      ]
    }
  ]
}
```

### POST /api/cop/:id/rfis

Create a new RFI.

**Request Body:**
```json
{
  "question": "What bus company operates at this ski resort?",
  "priority": "high",
  "is_blocker": false,
  "assigned_to": "analyst-2",
  "requester_name": "Lead Analyst"
}
```

| Field | Values |
|-------|--------|
| `priority` | `critical`, `high`, `medium`, `low` |
| `is_blocker` | boolean |

### PUT /api/cop/:id/rfis

Update RFI status, priority, or add an answer.

**Request Body:**
```json
{
  "id": "rfi-abc123",
  "status": "answered",
  "priority": "medium",
  "is_blocker": false,
  "answer": "TIP - Turismo Integral Patagonico",
  "source_description": "Company website confirmation",
  "responder_name": "OSINT Bot"
}
```

| Field | Values |
|-------|--------|
| `status` | `open`, `answered`, `closed`, `blocked` |

### POST /api/cop/:id/rfis/:rfiId/answers

Submit an answer to a specific RFI.

### PUT /api/cop/:id/rfis/:rfiId/answers

Accept an answer (set `is_accepted = true`).

---

## Hypotheses (ACH)

### GET /api/cop/:id/hypotheses

List hypotheses with linked evidence.

**Response:**
```json
{
  "hypotheses": [
    {
      "id": "hyp-abc123",
      "statement": "The persona operator is based in Bariloche, Argentina",
      "status": "active",
      "confidence": 85,
      "evidence": [
        {
          "id": "he-xyz",
          "evidence_id": "ev-123",
          "title": "TIP bus confirms Bariloche",
          "type": "supporting"
        }
      ]
    }
  ]
}
```

### POST /api/cop/:id/hypotheses

Create a hypothesis OR link evidence to a hypothesis.

**Create hypothesis:**
```json
{
  "statement": "Operator is based in Argentina",
  "confidence": 70
}
```

**Link evidence:**
```json
{
  "hypothesis_id": "hyp-abc123",
  "title": "Type I power outlets match Argentina",
  "type": "supporting"
}
```

| Field | Values |
|-------|--------|
| `type` | `supporting`, `contradicting` |
| `confidence` | 0-100 |
| `status` | `active`, `proven`, `disproven`, `archived` |

### PUT /api/cop/:id/hypotheses

Update hypothesis status or confidence.

```json
{
  "id": "hyp-abc123",
  "status": "proven",
  "confidence": 95
}
```

---

## Tasks (Kanban Board)

### GET /api/cop/:id/tasks

List tasks. Optional filters via query params.

**Query Params:** `?status=todo&assigned_to=analyst-1`

**Response:**
```json
{
  "tasks": [
    {
      "id": "task-abc",
      "title": "PimEyes search: Rubia Sophia",
      "description": "Run facial recognition...",
      "status": "todo",
      "priority": "high",
      "task_type": "pimeyes",
      "assigned_to": "analyst-1",
      "linked_persona_id": null,
      "linked_marker_id": null,
      "linked_hypothesis_id": null
    }
  ]
}
```

### POST /api/cop/:id/tasks

Create a task.

```json
{
  "title": "Reverse image search hotel rooms",
  "description": "Check for metadata and matching hotel listings",
  "task_type": "reverse_image",
  "priority": "high",
  "assigned_to": "analyst-2",
  "linked_persona_id": "persona-id",
  "linked_hypothesis_id": "hyp-id"
}
```

| Field | Values |
|-------|--------|
| `status` | `todo`, `in_progress`, `done`, `blocked` |
| `priority` | `critical`, `high`, `medium`, `low` |
| `task_type` | `pimeyes`, `geoguessr`, `forensic`, `osint`, `reverse_image`, `social_media`, `general` |

### PUT /api/cop/:id/tasks

Update task (status transitions, reassignment, etc.)

```json
{
  "id": "task-abc",
  "status": "in_progress",
  "assigned_to": "analyst-1"
}
```

### DELETE /api/cop/:id/tasks?task_id=task-abc

Delete a task.

---

## Personas

### GET /api/cop/:id/personas

List all personas for a session with cross-links.

### POST /api/cop/:id/personas

Create or update a persona. Use `?action=link` to create a persona cross-link.

**Create persona:**
```json
{
  "handle": "@lanaraae",
  "platform": "twitter",
  "display_name": "Lana Rae",
  "bio": "Travel blogger from...",
  "follower_count": 15000,
  "profile_url": "https://twitter.com/lanaraae"
}
```

**Link personas (query: `?action=link`):**
```json
{
  "source_persona_id": "persona-1",
  "target_persona_id": "persona-2",
  "link_type": "ALIAS",
  "confidence": "PROBABLE"
}
```

---

## Evidence

### GET /api/cop/:id/evidence

List evidence items scoped to the session's workspace.

### POST /api/cop/:id/evidence

Create evidence item.

```json
{
  "title": "Instagram @ufqsoo ski resort photo",
  "type": "image",
  "url": "https://instagram.com/p/...",
  "description": "Photo showing TIP bus at ski resort",
  "tags": ["geolocation", "bariloche"]
}
```

---

## Evidence Tags

### GET /api/cop/:id/evidence-tags

List all tags applied to evidence items in this session.

### POST /api/cop/:id/evidence-tags

Tag an evidence item.

---

## Activity Log

### GET /api/cop/:id/activity

List recent activity for audit trail and collaboration awareness.

**Query Params:** `?limit=50`

**Response:**
```json
{
  "activity": [
    {
      "id": "act-abc",
      "action_type": "ENTITY_CREATED",
      "actor_name": "Lead Analyst",
      "details": "Created actor: Unknown Operator",
      "created_at": "..."
    }
  ]
}
```

### POST /api/cop/:id/activity

Log a custom activity event.

```json
{
  "action_type": "RESEARCH_FINDING",
  "actor_name": "OSINT Bot",
  "details": "IKEA has no stores in Argentina"
}
```

---

## Collaborators

### GET /api/cop/:id/collaborators

List collaborators and their roles.

### POST /api/cop/:id/collaborators

Invite a collaborator.

```json
{
  "email": "analyst@team.com",
  "role": "EDITOR"
}
```

### DELETE /api/cop/:id/collaborators

Remove a collaborator. `?user_id=123`

---

## Shares (Public Links)

### GET /api/cop/:id/shares

List existing share links.

### POST /api/cop/:id/shares

Create a share link with panel configuration.

```json
{
  "panels": ["map", "evidence", "hypotheses"],
  "expires_hours": 72
}
```

### GET /api/cop/public/:token

Access a shared COP session via public token (read-only).

### POST /api/cop/public/:token/rfis/:rfiId/answers

Submit an RFI answer via a public share link.

---

## Workspace Stats

### GET /api/cop/:id/stats

Dashboard KPI stats for a COP session.

**Response:**
```json
{
  "stats": {
    "evidence_count": 32,
    "entity_count": 17,
    "relationship_count": 14,
    "framework_count": 5,
    "open_questions": 3,
    "blocker_count": 0
  }
}
```

---

## CoT Export (Cursor-on-Target)

### GET /api/cop/:id/cot

Export markers as ATAK-compatible Cursor-on-Target XML.

**Response:** `application/xml` with CoT events for all non-stale markers, places, events, and actors within the session bounding box. Results are cached in KV with a 30-second TTL.

**Auth:** Accepts either the standard `X-User-Hash` header **or** a share token via `?token=<shareToken>`. The token path is intended for headless TAK/ATAK clients that cannot inject custom headers.

```bash
# Header auth (browser/API)
curl -H "X-User-Hash: your-hash" https://researchtools.net/api/cop/cop-xxx/cot

# Token auth (ATAK data feed URL)
https://researchtools.net/api/cop/cop-xxx/cot?token=<shareToken>
```

The share token is the `share_token` value returned when creating a share via `POST /api/cop/:id/shares`.

---

## Layer Data Endpoints

These return GeoJSON `FeatureCollection` objects for map layers.

| Endpoint | Description |
|----------|-------------|
| `GET /api/cop/:id/layers/markers` | Tactical markers as GeoJSON |
| `GET /api/cop/:id/layers/actors` | Actor entities with coordinates |
| `GET /api/cop/:id/layers/places` | Place entities as map features |
| `GET /api/cop/:id/layers/events` | Event entities with locations |
| `GET /api/cop/:id/layers/relationships` | Relationship links as GeoJSON lines |
| `GET /api/cop/:id/layers/analysis` | Analysis framework overlay |
| `GET /api/cop/:id/layers/acled` | ACLED conflict data (external) |
| `GET /api/cop/:id/layers/gdelt` | GDELT event data (external) |

---

## Entity Endpoints (Workspace-Scoped)

These are **not** COP-specific but are used by the COP entity drawer. They require `workspace_id` in query params and `X-User-Hash` header.

### GET /api/actors?workspace_id=uuid

List actors. Types: `PERSON`, `ORGANIZATION`, `UNIT`, `GOVERNMENT`, `GROUP`, `OTHER`

### POST /api/actors

```json
{
  "name": "Unknown Operator",
  "type": "PERSON",
  "workspace_id": "6fde45ce-...",
  "description": "Suspected controller of persona network",
  "aliases": ["puppet-master"]
}
```

### GET /api/places?workspace_id=uuid

List places. Types include location/geographic designations.

### POST /api/places

```json
{
  "name": "Bariloche",
  "workspace_id": "6fde45ce-...",
  "place_type": "CITY",
  "coordinates": { "lat": -41.13, "lng": -71.30 },
  "description": "Confirmed location of persona operator"
}
```

**Note:** Place coordinates use `lng` (not `lon`).

### GET /api/sources?workspace_id=uuid

List sources. Types: `HUMINT`, `SIGINT`, `IMINT`, `OSINT`, `GEOINT`, `MASINT`, `TECHINT`, `CYBER`

### POST /api/sources

```json
{
  "name": "PimEyes Facial Recognition",
  "type": "OSINT",
  "workspace_id": "6fde45ce-...",
  "reliability": "B",
  "description": "Facial recognition search engine"
}
```

### GET /api/events?workspace_id=uuid

List events for the workspace.

### GET /api/behaviors?workspace_id=uuid

List behavior patterns.

### GET /api/relationships?workspace_id=uuid

List entity relationships.

### POST /api/relationships

```json
{
  "source_entity_id": "actor-uuid",
  "source_entity_type": "ACTOR",
  "target_entity_id": "place-uuid",
  "target_entity_type": "PLACE",
  "relationship_type": "LOCATED_AT",
  "confidence": "CONFIRMED",
  "workspace_id": "6fde45ce-...",
  "description": "Multiple evidence items confirm location"
}
```

| Field | Values |
|-------|--------|
| `relationship_type` | `CONTROLS`, `ASSOCIATED_WITH`, `LOCATED_AT`, `OPERATES_FROM`, `COMMUNICATES_WITH`, etc. |
| `confidence` | `CONFIRMED`, `PROBABLE`, `POSSIBLE`, `SUSPECTED` |
| `source_entity_type` / `target_entity_type` | `ACTOR`, `EVENT`, `PLACE`, `SOURCE`, `BEHAVIOR` |

---

## Recently Added Endpoints

### Alerts (REDSIGHT BDA Integration)

#### GET /api/cop/:id/alerts

Fetch alerts for a session. Merges live REDSIGHT BDA incidents with local action state stored in D1. Falls back to cached D1 data when the upstream is unavailable. Requires auth (`getUserFromRequest`, not guest-friendly).

**Query Params:** `?status=new|dismissed|action|analysis&severity=LOW|MODERATE|HIGH|CRITICAL`

**Response:**
```json
{
  "alerts": [
    {
      "incident_id": "rs-001",
      "incident_type": "STRIKE",
      "severity": "HIGH",
      "location_name": "Kyiv Oblast",
      "summary": "Artillery impact reported",
      "credibility": 0.85,
      "source_types": ["OSINT"],
      "event_occurred_at": "2026-06-01T14:00:00Z",
      "lat": 50.45,
      "lon": 30.52,
      "status": "new",
      "linked_rfi_id": null,
      "linked_task_id": null,
      "notes": null
    }
  ],
  "enabled": true,
  "region": "UA",
  "api_available": true
}
```

Note: `enabled` reflects `cop_sessions.global_alerts_enabled`. If false, returns `{ alerts: [], enabled: false }`.

#### POST /api/cop/:id/alerts

Action an alert — update its local state, optionally link to an RFI or task.

```json
{
  "incident_id": "rs-001",
  "action": "link_rfi",
  "rfi_id": "rfi-abc123",
  "notes": "RFI opened for damage assessment",
  "severity": "HIGH"
}
```

| Field | Values |
|-------|--------|
| `action` | `dismiss`, `mark_action`, `mark_analysis`, `link_rfi`, `link_task` |
| `severity` | `LOW`, `MODERATE`, `HIGH`, `CRITICAL` |

---

### Assets (Resource Tracking)

#### GET /api/cop/:id/assets

List assets. Optional filters: `?asset_type=human&status=available`

**Response:** `{ assets: [...] }` — each asset includes `id`, `name`, `asset_type`, `status`, `details` (JSON), `lat`, `lon`, `sensitivity`, `last_checked_at`, `notes`.

#### POST /api/cop/:id/assets

Create an asset.

```json
{
  "name": "Source Alpha",
  "asset_type": "human",
  "status": "available",
  "sensitivity": "restricted",
  "location": "Kyiv",
  "lat": 50.45,
  "lon": 30.52,
  "notes": "Handles eastern oblast",
  "details": { "languages": ["uk", "ru"] }
}
```

| Field | Values |
|-------|--------|
| `asset_type` | `human`, `source`, `infrastructure`, `digital` |
| `status` | `available`, `deployed`, `degraded`, `offline`, `compromised`, `exhausted` |
| `sensitivity` | `unclassified`, `internal`, `restricted` |

#### PUT /api/cop/:id/assets

Update an asset. `id` required in body. All other fields optional.

#### DELETE /api/cop/:id/assets?asset_id=ast-xxx

Soft-delete (sets `status = offline`) by default. Pass `?hard=true` for hard delete (also removes log entries).

#### POST /api/cop/:id/assets/:assetId/check-in

Update an asset's status and set `last_checked_at`. Creates an audit log entry and emits `ASSET_STATUS_CHANGED`.

```json
{ "status": "deployed", "reason": "Tasked to Kharkiv" }
```

#### GET /api/cop/:id/assets/:assetId/log

Retrieve the status-change audit trail for a specific asset, ordered by `created_at DESC`.

**Response:** `{ log: [{ id, asset_id, cop_session_id, previous_status, new_status, changed_by, reason, created_at }] }`

---

### Intake Forms (Crowdsourcing)

#### GET /api/cop/:id/intake-forms

List intake forms for the session. Session owners receive `share_token`; non-owners do not.

**Response:** `{ intake_forms: [...] }` — includes parsed `form_schema` array.

#### POST /api/cop/:id/intake-forms

Create a new intake form.

```json
{
  "title": "Incident Report",
  "description": "Report an incident in your area",
  "form_schema": [
    { "type": "text", "label": "What happened?", "required": true }
  ],
  "status": "draft",
  "access_level": "public",
  "require_location": false,
  "require_contact": false,
  "auto_tag_category": "incident",
  "custom_slug": "my-form",
  "expires_at": "2026-12-31T00:00:00Z",
  "theme_color": "#3b82f6"
}
```

| Field | Values |
|-------|--------|
| `status` | `draft`, `active`, `closed` |
| `access_level` | `public`, `password`, `internal` |

**Response (201):** `{ id, share_token, custom_slug, message }`

#### GET /api/cop/:id/intake-forms/:formId

Get a single intake form by ID.

#### PUT /api/cop/:id/intake-forms/:formId

Update a form. Updatable fields: `title`, `description`, `form_schema`, `status`, `auto_tag_category`, `require_location`, `require_contact`.

---

### Playbooks (Automation Rules)

#### GET /api/cop/:id/playbooks

List playbooks for the session. Each entry includes a `rule_count`.

**Response:** `{ playbooks: [...] }`

#### POST /api/cop/:id/playbooks

Create a new playbook (initial status: `draft`).

```json
{
  "name": "High-Priority Alert Handler",
  "description": "Automatically create tasks for critical alerts",
  "source": "custom"
}
```

**Response (201):** `{ id, message }`

#### GET /api/cop/:id/playbooks/:pbId

Get a single playbook with its rules (parsed JSON fields).

**Response:** `{ playbook: {...}, rules: [...] }`

#### PUT /api/cop/:id/playbooks/:pbId

Update playbook name, description, or status.

| Field | Values |
|-------|--------|
| `status` | `active`, `paused`, `draft` |

#### DELETE /api/cop/:id/playbooks/:pbId

Delete a playbook. Cascades to rules and execution log.

#### GET /api/cop/:id/playbooks/:pbId/rules

List rules for a playbook, ordered by `position ASC`.

**Response:** `{ rules: [...] }` — each rule has parsed `trigger_filter`, `conditions`, and `actions` JSON fields.

#### POST /api/cop/:id/playbooks/:pbId/rules

Create a rule.

```json
{
  "name": "Auto-task on critical alert",
  "trigger_event": "alert.actioned",
  "trigger_filter": { "severity": "CRITICAL" },
  "conditions": [],
  "actions": [{ "action": "create_task", "title": "Investigate critical alert" }],
  "enabled": true,
  "cooldown_seconds": 300
}
```

| Field | Values |
|-------|--------|
| `actions[].action` | `create_task`, `update_status`, `assign_task`, `create_evidence`, `send_notification`, `update_priority`, `add_tag`, `create_rfi`, `reserve_asset`, `run_pipeline` |

#### PUT /api/cop/:id/playbooks/:pbId/rules

Update a rule. `rule_id` required in body.

#### DELETE /api/cop/:id/playbooks/:pbId/rules?rule_id=pbr-xxx

Delete a rule. Also removes its log entries.

#### GET /api/cop/:id/playbooks/:pbId/log

Paginated execution log for a playbook. Filters: `?status=success|partial|failed&limit=50&offset=0`.

**Response:** `{ log: [...], total, limit, offset }` — each entry has parsed `actions_taken` array.

#### POST /api/cop/:id/playbooks/:pbId/test

Dry-run test: evaluates rules against recent events WITHOUT executing actions.

```json
{ "event_limit": 20 }
```

**Response:**
```json
{
  "would_fire": [{ "rule_id": "pbr-xxx", "rule_name": "...", "event_id": "...", "event_type": "...", "actions": [...] }],
  "would_skip": [{ "rule_id": "pbr-xxx", "rule_name": "...", "event_id": "...", "event_type": "...", "reason": "Cooldown active (300s)" }],
  "events_tested": 20,
  "rules_tested": 3
}
```

---

### Task Templates

#### GET /api/cop/:id/task-templates

List task templates scoped to the session's workspace.

**Response:** `{ templates: [...] }`

#### POST /api/cop/:id/task-templates

Create a reusable task template.

```json
{
  "name": "OSINT Standard Package",
  "description": "Standard OSINT task set",
  "template_type": "universal",
  "tasks_json": [
    {
      "ref": "social-search",
      "title": "Social media search",
      "task_type": "social_media",
      "priority": "high",
      "subtasks": [
        { "ref": "twitter", "title": "Twitter/X search", "task_type": "social_media" }
      ]
    },
    {
      "ref": "pimeyes",
      "title": "PimEyes facial search",
      "task_type": "pimeyes",
      "depends_on": ["social-search"]
    }
  ]
}
```

Each task def requires unique `ref` and `title`. `depends_on` references other `ref` values — circular deps are rejected.

#### PUT /api/cop/:id/task-templates

Update a template. `id` required in body. Updatable: `name`, `description`, `template_type`, `tasks_json`.

#### DELETE /api/cop/:id/task-templates

Delete a template. `id` required in body (JSON).

---

### Task Extensions

#### POST /api/cop/:id/tasks/deploy-template

Instantiate a task template — creates real task rows, subtasks, and dependency rows from `tasks_json`.

```json
{ "template_id": "ttpl-abc123" }
```

**Response (201):**
```json
{
  "message": "Template deployed",
  "tasks_created": 3,
  "dependencies_created": 1,
  "task_ids": ["tsk-aaa", "tsk-bbb", "tsk-ccc"],
  "ref_map": { "social-search": "tsk-aaa", "twitter": "tsk-bbb", "pimeyes": "tsk-ccc" }
}
```

#### POST /api/cop/:id/tasks/:taskId/reassign

Reassign a task manually or trigger auto-assignment.

```json
{ "assigned_to": "analyst-2" }
```

or:

```json
{ "auto": true }
```

Auto-assignment picks an eligible collaborator based on task type. Returns `422` if no eligible collaborator is found.

---

### Task Dependencies

#### GET /api/cop/:id/task-dependencies

List all task dependencies for the session.

**Response:** `{ dependencies: [{ id, task_id, depends_on_task_id, cop_session_id, created_at }] }`

#### POST /api/cop/:id/task-dependencies

Create a dependency. Validates both tasks exist, checks for duplicates and circular dependencies.

```json
{ "task_id": "tsk-aaa", "depends_on_task_id": "tsk-bbb" }
```

#### DELETE /api/cop/:id/task-dependencies

Remove a dependency. `id` required in body (JSON).

---

### POO Estimates (Point of Origin)

Map overlay for ballistic / launch-origin sector estimates.

#### GET /api/cop/:id/poo-estimates

**Response:** `{ estimates: [...] }`

#### POST /api/cop/:id/poo-estimates

```json
{
  "name": "Launch Site Alpha",
  "impact_lat": 50.45,
  "impact_lon": 30.52,
  "max_range_km": 25.0,
  "min_range_km": 5.0,
  "approach_bearing": 270,
  "sector_width_deg": 60,
  "confidence": "POSSIBLE",
  "range_basis": "CEP analysis",
  "bearing_basis": "Doppler track",
  "color": "#ef4444",
  "opacity": 0.15
}
```

| Field | Required | Values |
|-------|----------|--------|
| `name` | Yes | string |
| `impact_lat` | Yes | -90..90 |
| `impact_lon` | Yes | -180..180 |
| `confidence` | No | `CONFIRMED`, `PROBABLE`, `POSSIBLE`, `DOUBTFUL` (default: `POSSIBLE`) |
| `approach_bearing` | No | 0-360 degrees |

#### PUT /api/cop/:id/poo-estimates

Update an estimate. `estimate_id` required in body.

#### DELETE /api/cop/:id/poo-estimates?estimate_id=poo-xxx

Delete an estimate.

---

### Export

#### POST /api/cop/:id/export

Generate and immediately download a session export. Returns the file as an attachment with `Content-Disposition` header. Also records the export in `cop_exports`.

```json
{ "format": "geojson", "scope": "full" }
```

| Field | Values |
|-------|--------|
| `format` | `geojson`, `kml`, `cot`, `stix`, `csv` |
| `scope` | `full`, `layers`, `entities`, `evidence`, `tasks` |

**Response:** Raw file content with appropriate `Content-Type` and `Content-Disposition: attachment; filename="..."`. Header `X-Export-Id` contains the export record ID.

#### GET /api/cop/:id/exports

List past export records for the session.

**Query Params:** `?limit=50&format=geojson&status=completed`

**Response:** `{ exports: [...] }` — each entry has `id`, `format`, `scope`, `status`, `file_size_bytes`, `created_at`.

| Status | Meaning |
|--------|---------|
| `generating` | In progress |
| `completed` | Finished |
| `failed` | Serialization error |

#### GET /api/cop/:id/exports/:exportId/download

Retrieve export metadata. Note: export content is returned directly from `POST /export` — this endpoint returns metadata only (for checking status). Returns `202` if still generating, `410` if failed.

---

### Scrape (Apify Integration)

#### POST /api/cop/:id/scrape

Trigger an Apify scraper and ingest results as evidence items.

```json
{
  "type": "twitter",
  "query": "Bariloche persona farm",
  "limit": 50
}
```

or for URL-targeted scraping:
```json
{
  "type": "tiktok",
  "urls": ["https://www.tiktok.com/@user/video/123"],
  "limit": 20
}
```

| Field | Values |
|-------|--------|
| `type` | `twitter`, `tiktok` |
| `query` | Search query string |
| `urls` | Array of URLs to scrape directly |

For small runs (≤50 items): runs synchronously and returns ingested evidence count.
For larger runs: returns a `run_id` for polling (HTTP 202).

**Response (sync / completed):**
```json
{ "run_id": "xxx", "status": "completed", "items_found": 25, "evidence_created": 25 }
```

**Response (async / started):**
```json
{ "run_id": "xxx", "status": "running", "message": "Poll GET .../scrape?run_id=xxx" }
```

#### GET /api/cop/:id/scrape?run_id=xxx

Check status of an async scrape run. If completed and `?ingest=true` (default), ingests results as evidence.

**Query Params:** `?run_id=xxx&ingest=true|false`

**Response (pending):** `{ run_id, status: "running", started_at }`
**Response (done, ingest=true):** `{ run_id, status: "completed", items_found, evidence_created }`
**Response (done, ingest=false):** `{ run_id, status: "completed", items_found, items: [...first 10...] }`

---

### Submissions (Intake Form Triage Queue)

#### GET /api/cop/:id/submissions

List submissions from intake forms attached to this session.

**Query Params:** `?status=pending|triaged|accepted|rejected&form_id=ifm-xxx`

**Response:** `{ submissions: [...] }` — each includes `id`, `survey_id`, `form_data` (parsed JSON), `submitter_name`, `submitter_contact`, `lat`, `lon`, `submitter_country`, `status`, `linked_evidence_id`.

#### PUT /api/cop/:id/submissions

Triage a submission — update its status and optionally link to evidence.

```json
{
  "id": "sub-abc123",
  "status": "accepted",
  "linked_evidence_id": "ev-xyz",
  "rejection_reason": null
}
```

| Field | Values |
|-------|--------|
| `status` | `pending`, `triaged`, `accepted`, `rejected` |

---

### Timeline

#### GET /api/cop/:id/timeline

List timeline entries for the session, ordered by `event_date ASC`.

**Query Params:** `?category=event&source_type=manual,system`

**Response:** `{ entries: [...] }`

#### POST /api/cop/:id/timeline

Create one or more timeline entries (batch of up to 200).

```json
{
  "title": "Bus spotted at ski resort",
  "event_date": "2026-03-08",
  "category": "event",
  "description": "TIP bus confirmed in background",
  "importance": "high",
  "source_type": "manual",
  "source_url": "https://instagram.com/p/...",
  "source_title": "Instagram post"
}
```

or batch: `{ "entries": [...array of the above...] }`

| Field | Values |
|-------|--------|
| `category` | `event`, `meeting`, `communication`, `financial`, `legal`, `travel`, `publication`, `military`, `political` |
| `importance` | `normal`, `high`, `critical` |
| `source_type` | `manual`, `system` (system entries are read-only) |

#### PUT /api/cop/:id/timeline

Update a timeline entry. `entry_id` required in body. System-generated entries (`source_type = system`) cannot be modified.

#### DELETE /api/cop/:id/timeline?entry_id=tle-xxx

Delete a timeline entry. System-generated entries cannot be deleted.

---

### Claims

#### GET /api/cop/:id/claims

List claims extracted from URLs for this session.

**Query Params:** `?status=unverified|verified|disputed|false`

**Response:** `{ claims: [...] }`

#### POST /api/cop/:id/claims

Bulk-create claims extracted from a URL.

```json
{
  "url": "https://example.com/article",
  "title": "Article Title",
  "domain": "example.com",
  "summary": "Article summary",
  "claims": [
    { "claim": "The attack occurred at 14:00", "confidence": 70, "category": "temporal" },
    { "claim": "Three vehicles were observed", "confidence": 60 }
  ]
}
```

**Response (201):** `{ ids: [...], message: "N claims saved" }`

#### PUT /api/cop/:id/claims

Update a claim's status or promote to evidence.

```json
{ "claim_id": "clm-abc", "status": "verified" }
```

To promote to evidence item:
```json
{ "claim_id": "clm-abc", "status": "verified", "promote_to_evidence": true }
```

| Field | Values |
|-------|--------|
| `status` | `unverified`, `verified`, `disputed`, `false` |

---

### Internal Events Feed

#### GET /api/cop/:id/events

List internal COP events (playbook triggers, entity changes, etc.) with cursor-based pagination.

**Query Params:** `?event_type=task.created&entity_type=task&since=<eventId>&limit=100`

**Response:** `{ events: [...] }` — each has `id`, `cop_session_id`, `event_type`, `entity_type`, `entity_id`, `payload` (JSON), `created_at`.

---

### Public Intake Form Endpoints

These endpoints are **unauthenticated** — used by the public submission UI.

#### GET /api/cop/public/intake/:token

Get form schema for a public intake form by share token. Returns `requires_password: true` for password-protected forms. Enforces expiry and country gating.

**Response:**
```json
{
  "title": "Incident Report",
  "description": "...",
  "form_schema": [...],
  "require_location": false,
  "require_contact": false,
  "access_level": "public",
  "theme_color": "#3b82f6",
  "success_message": null
}
```

#### POST /api/cop/public/intake/:token/submit

Submit a public form entry (no auth). Enforces rate limiting, country gating, and password verification.

```json
{
  "form_data": { "what_happened": "Explosion heard at 14:00" },
  "submitter_name": "Anonymous",
  "lat": 50.45,
  "lon": 30.52
}
```

**Response (201):** `{ message: "Submission received", submission_id: "..." }`

#### POST /api/cop/public/intake/:token/verify-password

Verify the password for a password-protected form. Returns the full form schema on success.

```json
{ "password": "secret123" }
```

**Response:** Full form schema (same as GET above) on success, `401` on failure.

#### GET /api/cop/public/intake/by-slug/:slug

Resolve a custom slug to the form schema. Equivalent to `GET /api/cop/public/intake/:token` but looks up by `custom_slug` field.

---

## Evidence Note

Evidence items are stored in the `evidence_items` table and accessed via workspace-scoped endpoints. The correct table name is `evidence_items` (not `evidence`). The COP evidence endpoints at `/api/cop/:id/evidence` query this table using the session's `workspace_id`.

---

## CLI Quick Reference

### Deploy

```bash
./deploy.sh                    # Full deploy (migrate + build + deploy)
./deploy.sh --skip-migrate     # Skip DB migrations
./deploy.sh --skip-build       # Skip frontend build
./deploy.sh --dry-run          # Verify build without deploying
```

### Database (D1)

```bash
# Query production database
npx wrangler d1 execute researchtoolspy-prod --remote --command "SELECT * FROM cop_sessions LIMIT 5"

# Apply a single migration
npx wrangler d1 execute researchtoolspy-prod --remote --file=schema/migrations/069-activity-columns.sql

# Check table schema
npx wrangler d1 execute researchtoolspy-prod --remote --command ".schema cop_markers"
```

### Common D1 Operations for COP

```bash
# List COP sessions
npx wrangler d1 execute researchtoolspy-prod --remote --command \
  "SELECT id, name, status, workspace_id FROM cop_sessions ORDER BY created_at DESC LIMIT 10"

# Check entity counts for a workspace
npx wrangler d1 execute researchtoolspy-prod --remote --command \
  "SELECT 'actors' as type, COUNT(*) as count FROM actors WHERE workspace_id='6fde45ce-ae4b-4ff0-97c6-d2773a6ff108'
   UNION ALL SELECT 'places', COUNT(*) FROM places WHERE workspace_id='6fde45ce-ae4b-4ff0-97c6-d2773a6ff108'
   UNION ALL SELECT 'sources', COUNT(*) FROM sources WHERE workspace_id='6fde45ce-ae4b-4ff0-97c6-d2773a6ff108'"

# Update marker confidence
npx wrangler d1 execute researchtoolspy-prod --remote --command \
  "UPDATE cop_markers SET confidence='CONFIRMED' WHERE id='mkr-abc123'"

# Close an RFI
npx wrangler d1 execute researchtoolspy-prod --remote --command \
  "UPDATE cop_rfis SET status='closed', updated_at=datetime('now') WHERE id='rfi-abc123'"

# Make workspace public (for viewer access)
npx wrangler d1 execute researchtoolspy-prod --remote --command \
  "UPDATE workspaces SET is_public=1 WHERE id='workspace-uuid'"

# Add user as workspace admin
npx wrangler d1 execute researchtoolspy-prod --remote --command \
  "INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at) VALUES ('wm-' || hex(randomblob(6)), 'workspace-uuid', 1, 'ADMIN', datetime('now'))"
```

### curl Examples

```bash
# Create a workspace + COP session
curl -X POST https://researchtools.net/api/workspaces \
  -H "Content-Type: application/json" \
  -H "X-User-Hash: your-hash" \
  -d '{
    "title": "New Investigation",
    "investigation_type": "structured_research",
    "cop_template": "event_analysis"
  }'

# Create a marker
curl -X POST https://researchtools.net/api/cop/cop-b0f96023-cdf/markers \
  -H "Content-Type: application/json" \
  -H "X-User-Hash: your-hash" \
  -H "X-Workspace-ID: 6fde45ce-ae4b-4ff0-97c6-d2773a6ff108" \
  -d '{
    "lat": -41.13, "lon": -71.30,
    "label": "Bariloche",
    "confidence": "CONFIRMED",
    "source_type": "EVIDENCE"
  }'

# Create an RFI
curl -X POST https://researchtools.net/api/cop/cop-b0f96023-cdf/rfis \
  -H "Content-Type: application/json" \
  -H "X-User-Hash: your-hash" \
  -d '{
    "question": "What type of power outlets are visible?",
    "priority": "high",
    "requester_name": "Lead Analyst"
  }'

# Create an actor entity
curl -X POST https://researchtools.net/api/actors \
  -H "Content-Type: application/json" \
  -H "X-User-Hash: your-hash" \
  -d '{
    "name": "Unknown Operator",
    "type": "PERSON",
    "workspace_id": "6fde45ce-ae4b-4ff0-97c6-d2773a6ff108",
    "description": "Suspected controller"
  }'

# Create a relationship
curl -X POST https://researchtools.net/api/relationships \
  -H "Content-Type: application/json" \
  -H "X-User-Hash: your-hash" \
  -d '{
    "source_entity_id": "actor-uuid",
    "source_entity_type": "ACTOR",
    "target_entity_id": "place-uuid",
    "target_entity_type": "PLACE",
    "relationship_type": "LOCATED_AT",
    "confidence": "CONFIRMED",
    "workspace_id": "6fde45ce-ae4b-4ff0-97c6-d2773a6ff108"
  }'

# Propose a hypothesis
curl -X POST https://researchtools.net/api/cop/cop-b0f96023-cdf/hypotheses \
  -H "Content-Type: application/json" \
  -H "X-User-Hash: your-hash" \
  -d '{"statement": "Operator is based in Argentina", "confidence": 70}'

# Update task status
curl -X PUT https://researchtools.net/api/cop/cop-b0f96023-cdf/tasks \
  -H "Content-Type: application/json" \
  -H "X-User-Hash: your-hash" \
  -d '{"id": "task-abc", "status": "done"}'
```

---

## Schema Reference

### Key Tables

| Table | Purpose |
|-------|---------|
| `cop_sessions` | COP workspace sessions |
| `cop_markers` | Tactical map markers |
| `cop_marker_changelog` | Audit trail for marker changes |
| `cop_rfis` | Requests for Information |
| `cop_rfi_answers` | Answers to RFIs |
| `cop_hypotheses` | Analysis of Competing Hypotheses |
| `cop_hypothesis_evidence` | Evidence linked to hypotheses |
| `cop_tasks` | Kanban task board |
| `cop_activity` | Activity audit log |
| `cop_personas` | Investigation persona profiles |
| `cop_persona_links` | Cross-platform persona links |
| `cop_shares` | Public share tokens |
| `workspaces` | Investigation workspaces |
| `workspace_members` | Workspace access control |
| `investigations` | Investigation records |
| `actors` | Actor entities |
| `places` | Place entities |
| `sources` | Source entities |
| `events` | Event entities |
| `behaviors` | Behavior pattern entities |
| `relationships` | Entity-to-entity relationships |
| `evidence_items` | Evidence items |

### Migrations (COP-specific)

| # | File | Change |
|---|------|--------|
| 064 | `064-add-cop-hypotheses.sql` | `cop_hypotheses`, `cop_hypothesis_evidence` tables |
| 065 | `065-add-mission-brief.sql` | `cop_sessions.mission_brief` column |
| 066 | `066-add-cop-tasks.sql` | `cop_tasks` table |
| 067 | `067-add-marker-confidence.sql` | `cop_markers.confidence/rationale`, `cop_marker_changelog` table |
| 068 | `068-add-rfi-requester.sql` | `cop_rfis.requester_name` column |
| 069 | `069-add-activity-columns.sql` | `cop_activity.actor_name/details` columns |

---

## Architecture Notes

### Two-ID Pattern

COP sessions have two IDs that serve different purposes:

- **Session ID** (`cop-b0f96023-cdf`): Used for COP-specific endpoints (`/api/cop/:id/...`)
- **Workspace UUID** (`6fde45ce-ae4b-4ff0-97c6-d2773a6ff108`): Used for entity endpoints (`/api/actors?workspace_id=...`)

The session's `workspace_id` field links to the workspace UUID. When calling entity endpoints from a COP context, always use `session.workspace_id`, not the COP session ID.

### Access Control

1. **COP endpoints**: Generally open (guest-friendly via `getUserIdOrDefault`)
2. **Entity endpoints**: Check workspace access via `checkWorkspaceAccess()`:
   - `owner_id` match = ADMIN
   - `workspace_members` role = as assigned
   - `is_public = 1` = VIEWER (read-only)
   - EDITOR role required for create/update operations

### Polling

Several frontend components poll their endpoints:
- RFIs: every 30s
- Tasks: every 30s
- Stats: every 30s
- Evidence feed: configurable (monitor mode = faster)
- Layer data: per-layer `refreshSeconds` config
