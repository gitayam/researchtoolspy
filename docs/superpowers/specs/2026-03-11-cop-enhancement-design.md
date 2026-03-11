# COP Enhancement Design Spec

**Date:** 2026-03-11
**Status:** Approved
**Priority order:** OSINT research campaigns > Situational monitoring > Crisis response

## Overview

Six-phase enhancement to the Common Operating Picture bringing it closer to feature parity with NICS, Sahana Eden, Ushahidi, and TheHive — while preserving the platform's unique strengths in ACH analysis, persona tracking, and evidence tagging.

**Architecture approach:** Hybrid (Approach C) — build features independently, emit standardized events from day one, snap playbook automation on later.

---

## Phase 1: Event System Foundation

Thin event bus that every feature emits into. The playbook engine (Phase 6) consumes it later.

### Schema: `cop_events`

| Field | Type | Purpose |
|---|---|---|
| id | TEXT (ULID) | Sortable unique ID |
| cop_session_id | TEXT | Which COP session |
| event_type | TEXT | e.g., `evidence.created`, `task.completed`, `rfi.overdue` |
| entity_type | TEXT | What was affected (task, evidence, rfi, asset, etc.) |
| entity_id | TEXT | ID of the affected record |
| payload | JSON | Full event data (old/new values, metadata) |
| created_by | TEXT | Who/what triggered it |
| created_at | DATETIME | Timestamp |

### Event Taxonomy

- `ingest.*` — submission.received, submission.triaged, submission.rejected
- `task.*` — created, assigned, started, completed, blocked, overdue, unblocked, unassignable
- `rfi.*` — created, answered, accepted, overdue
- `evidence.*` — created, tagged, linked
- `asset.*` — created, updated, status_changed, quota_low
- `workflow.*` — stage_entered, stage_completed, pipeline_finished
- `export.*` — requested, completed, failed

### Implementation

Helper function added to every mutating COP endpoint (~5 lines each):

```typescript
await emitCopEvent(db, {
  copSessionId, eventType: 'task.completed',
  entityType: 'task', entityId: task.id,
  payload: { title: task.title, assignee: task.assigned_to },
  createdBy: userId
});
```

Separate from `cop_activity` (human-readable UI feed) — events are machine-readable structured data for automation.

---

## Phase 2: Crowdsource / Ingest — Web Forms & Tiplines

### Schema: `cop_intake_forms`

| Field | Type | Purpose |
|---|---|---|
| id | TEXT (ULID) | Form ID |
| cop_session_id | TEXT | Parent COP |
| title | TEXT | "Submit a tip", "Field Report Form" |
| description | TEXT | Instructions for submitters |
| form_schema | JSON | Array of field definitions |
| share_token | TEXT (unique) | Public URL token |
| status | TEXT | draft / active / closed |
| auto_tag_category | TEXT | Default evidence tag category |
| require_location | BOOLEAN | Force lat/lon on submissions |
| require_contact | BOOLEAN | Ask for submitter contact info |
| submission_count | INTEGER | Denormalized counter |
| workspace_id, created_by, created_at, updated_at | — | Standard fields |

### Schema: `cop_submissions`

| Field | Type | Purpose |
|---|---|---|
| id | TEXT (ULID) | Submission ID |
| intake_form_id | TEXT | Which form |
| cop_session_id | TEXT | Denormalized for fast queries |
| form_data | JSON | Submitted field values |
| submitter_name | TEXT | Optional |
| submitter_contact | TEXT | Optional email/phone |
| lat / lon | REAL | Optional location |
| status | TEXT | pending / triaged / accepted / rejected |
| triaged_by | TEXT | Who reviewed it |
| linked_evidence_id | TEXT | If promoted to evidence |
| linked_task_id | TEXT | If a task was created from it |
| created_at | DATETIME | When submitted |

### Form Schema Format

```json
[
  { "name": "what_happened", "type": "text", "label": "What did you observe?", "required": true },
  { "name": "when", "type": "datetime", "label": "When?" },
  { "name": "photo", "type": "file", "label": "Attach photo", "accept": "image/*" },
  { "name": "urgency", "type": "select", "label": "Urgency", "options": ["low","medium","high"] }
]
```

### API Endpoints

- `GET/POST /api/cop/:id/intake-forms` — CRUD intake forms
- `GET/PUT /api/cop/:id/intake-forms/:formId` — Edit form, toggle status
- `GET /api/cop/public/intake/:token` — Public: render form
- `POST /api/cop/public/intake/:token/submit` — Public: submit response
- `GET /api/cop/:id/submissions` — List submissions (filterable by status)
- `PUT /api/cop/:id/submissions/:subId` — Triage: accept/reject, promote to evidence/task

### Triage Workflow

1. Submission arrives -> status `pending` -> emits `ingest.submission.received`
2. Analyst reviews -> accepts -> promotes to evidence item OR creates task -> emits `ingest.submission.triaged`
3. Rejected submissions get a reason tag for later review

### UI Components

- `CopIntakeFormBuilder.tsx` — Drag-and-drop form field editor
- `CopSubmissionInbox.tsx` — Triage queue with accept/reject/promote actions
- `PublicIntakeForm.tsx` — Clean public submission page

File uploads go to R2, referenced by URL in `form_data`.

---

## Phase 3: Task Management — Full Suite

### 3a. Dependencies & Sequencing

**Additions to `cop_tasks`:**

| Field | Type | Purpose |
|---|---|---|
| parent_task_id | TEXT | If this is a subtask, points to parent |
| depth | INTEGER (default 0) | 0 = top-level, 1 = subtask, max 2 |
| position | INTEGER | Sort order within its level |

**New table: `cop_task_dependencies`**

| Field | Type | Purpose |
|---|---|---|
| id | TEXT (ULID) | |
| task_id | TEXT | The blocked task |
| depends_on_task_id | TEXT | Must complete first |
| cop_session_id | TEXT | For fast session-scoped queries |
| created_at | DATETIME | |

Behavior:
- Tasks with unmet dependencies cannot move to `in_progress`
- Completing a task checks all dependents — if all deps met, emit `task.unblocked`
- Circular dependency detection at creation time

### 3b. Subtasks

Subtasks are `cop_tasks` rows with `parent_task_id` set:
- Parent shows "3/5 subtasks done" in UI
- Parent auto-completes when all subtasks done (configurable)
- Parent auto-blocks when any subtask is blocked

### 3c. Task Templates

**New table: `cop_task_templates`**

| Field | Type | Purpose |
|---|---|---|
| id | TEXT (ULID) | |
| name | TEXT | "OSINT Collection Workflow" |
| description | TEXT | |
| template_type | TEXT | Matches COP template types, or `universal` |
| tasks_json | JSON | Array of task definitions with dependencies |
| workspace_id, created_by, created_at, updated_at | — | Standard |

**tasks_json format:**

```json
[
  { "ref": "T1", "title": "Define collection requirements", "task_type": "general", "priority": "high" },
  { "ref": "T2", "title": "Identify sources", "task_type": "osint", "depends_on": ["T1"] },
  { "ref": "T3", "title": "Collect raw data", "task_type": "osint", "depends_on": ["T1"],
    "subtasks": [
      { "ref": "T3.1", "title": "Social media sweep", "task_type": "social_media" },
      { "ref": "T3.2", "title": "Reverse image search", "task_type": "reverse_image" }
    ]
  },
  { "ref": "T4", "title": "Verify & cross-reference", "task_type": "forensic", "depends_on": ["T2", "T3"] }
]
```

Ref IDs resolve to real ULIDs at instantiation time.

### 3d. Auto-Assignment

**Additions to `cop_collaborators`:**

| Field | Type | Purpose |
|---|---|---|
| skills | JSON | Array of task_type strings |
| max_concurrent | INTEGER (default 5) | Workload cap |
| timezone | TEXT | For follow-the-sun routing |
| availability | TEXT | available / busy / offline |

**Algorithm** (on task unblocked or created with no assignee):
1. Filter collaborators with matching skills
2. Filter by availability != offline
3. Sort by current open task count (ascending)
4. Assign to least-loaded match
5. Emit `task.assigned`
6. If no match, emit `task.unassignable`

### 3e. SLA Tracking

**Additions to `cop_tasks`:**

| Field | Type | Purpose |
|---|---|---|
| sla_hours | INTEGER | Hours allowed to complete (null = no SLA) |
| sla_started_at | DATETIME | When SLA clock started (on `in_progress`) |
| sla_breached | BOOLEAN (default false) | Flagged when overdue |

SLA defaults by priority (configurable per session):
- Critical: 4h, High: 12h, Medium: 48h, Low: no SLA

Breach detection via Cloudflare Cron Trigger (every 15 minutes). Same pattern applies to RFIs.

### API Endpoints

- `PUT /api/cop/:id/tasks/:taskId` — extended with dependency/subtask/SLA fields
- `POST /api/cop/:id/tasks/deploy-template` — instantiate a task template
- `GET/POST /api/cop/:id/task-templates` — CRUD task templates
- `POST /api/cop/:id/tasks/:taskId/reassign` — manual override

### UI Components

- `CopTaskBoard.tsx` — extended with dependency arrows (Gantt-lite toggle), subtask expansion, SLA countdown badges
- `CopTaskTemplateEditor.tsx` — visual template builder
- `CopCollaboratorSkills.tsx` — skill/availability editor

---

## Phase 4: Asset & Resource Tracking

### Schema: `cop_assets`

| Field | Type | Purpose |
|---|---|---|
| id | TEXT (ULID) | |
| cop_session_id | TEXT | Parent COP |
| asset_type | TEXT | `human`, `source`, `infrastructure`, `digital` |
| name | TEXT | Display name |
| status | TEXT | available / deployed / degraded / offline / compromised / exhausted |
| details | JSON | Type-specific fields |
| assigned_to_task_id | TEXT | Currently allocated to which task |
| location | TEXT | Physical or logical location |
| lat / lon | REAL | Optional — plottable on map |
| sensitivity | TEXT | unclassified / internal / restricted |
| last_checked_at | DATETIME | Last status verification |
| notes | TEXT | Free-form operational notes |
| workspace_id, created_by, created_at, updated_at | — | Standard |

### Type-Specific Details JSON

```typescript
// Human resources
{ skills: string[], timezone: string, languages: string[],
  hours_available_per_week: number, current_load: number }

// Information sources
{ source_type: "humint" | "sigint" | "osint" | "geoint",
  reliability_rating: "A" | "B" | "C" | "D" | "E" | "F",  // NATO admiralty code
  access_status: "active" | "intermittent" | "denied" | "unknown",
  coverage_area: string, last_contact: string,
  linked_source_id: string }

// Infrastructure
{ infra_type: "server" | "vpn" | "account" | "device" | "platform",
  provider: string, expiry_date: string,
  opsec_notes: string, shared_by: string[] }

// Digital resources
{ resource_type: "api_quota" | "license" | "dataset" | "document",
  total_units: number, used_units: number, reset_date: string,
  cost_per_unit: number, currency: string }
```

### Schema: `cop_asset_log`

| Field | Type | Purpose |
|---|---|---|
| id | TEXT (ULID) | |
| asset_id | TEXT | |
| cop_session_id | TEXT | |
| previous_status | TEXT | |
| new_status | TEXT | |
| changed_by | TEXT | |
| reason | TEXT | |
| created_at | DATETIME | |

### Connections

- **Map layer:** Assets with lat/lon as new `assets` layer
- **Task assignment:** Reserve assets when allocating tasks (e.g., PimEyes quota)
- **Source linking:** `linked_source_id` bridges to existing `sources` table
- **SLA integration:** Digital resources emit `asset.quota_low` at 80% usage

### API Endpoints

- `GET/POST /api/cop/:id/assets` — List/create (filterable by type, status)
- `GET/PUT/DELETE /api/cop/:id/assets/:assetId` — CRUD
- `POST /api/cop/:id/assets/:assetId/check-in` — Update status + log
- `GET /api/cop/:id/assets/:assetId/log` — Audit trail
- `GET /api/cop/:id/layers/assets` — GeoJSON FeatureCollection

### UI Components

- `CopAssetPanel.tsx` — Tabbed panel (People / Sources / Infra / Digital)
- `CopAssetDetailDrawer.tsx` — Full detail with status history
- `CopAssetAllocation.tsx` — Task-to-asset allocation view
- `CopResourceGauge.tsx` — Quota gauge for digital resources

### Layer Catalog Addition

```typescript
{ id: 'assets', name: 'Assets & Resources', category: 'operational',
  source: 'api', endpoint: '/layers/assets',
  render: 'cluster', icon: 'briefcase',
  defaultTemplates: ['crisis_response', 'area_study', 'event_monitor'] }
```

---

## Phase 5: Standard Export Formats

### Schema: `cop_exports`

| Field | Type | Purpose |
|---|---|---|
| id | TEXT (ULID) | |
| cop_session_id | TEXT | |
| format | TEXT | `geojson`, `kml`, `cot`, `stix`, `csv` |
| scope | TEXT | `full`, `layers`, `entities`, `evidence`, `tasks` |
| filters_json | JSON | Layer IDs, time range, entity types |
| file_url | TEXT | R2 URL of generated file |
| file_size_bytes | INTEGER | |
| created_by, created_at | — | Standard |

### Formats

**GeoJSON Bundle** (`.geojson.zip`): One FeatureCollection per active layer, all entity properties, metadata file with session info/bbox.

**KML/KMZ** (`.kmz`): Placemarks with styled icons, LineStrings for relationships, GroundOverlays for heatmaps, Folders mirroring layer structure, TimeSpan on events.

**CoT XML** (extended): Add area/polygon support, route support, asset positions. Bundle as `.zip` with one XML per marker.

**STIX 2.1 Bundle** (`.json`): Actors -> threat-actor/identity, Events -> incident/observed-data, Places -> location, Evidence -> observed-data, Relationships -> STIX relationship, Hypotheses -> opinion.

**CSV**: One CSV per entity type, flat columns, no nested JSON.

### Serializer Structure

```
src/lib/export/
├── geojson-serializer.ts
├── kml-serializer.ts
├── cot-serializer.ts       (moved from components/cop/, extended)
├── stix-serializer.ts
├── csv-serializer.ts
└── export-bundle.ts         (orchestrates format + R2 upload)
```

### API Endpoints

- `POST /api/cop/:id/export` — Request export (format, scope, filters)
- `GET /api/cop/:id/exports` — List past exports
- `GET /api/cop/:id/exports/:exportId/download` — Signed R2 URL redirect

Small sessions export in-request. Large (>1000 entities) use Cloudflare Queue worker.

### UI

- `CopExportDialog.tsx` — Format picker, scope/filter checkboxes, export button
- Export button in COP toolbar next to share button
- Past exports with download links and file sizes

---

## Phase 6: Playbook Engine

### Schema: `cop_playbooks`

| Field | Type | Purpose |
|---|---|---|
| id | TEXT (ULID) | |
| cop_session_id | TEXT | |
| name | TEXT | "OSINT Collection Pipeline" |
| description | TEXT | |
| status | TEXT | active / paused / draft |
| source | TEXT | `custom`, `template` |
| template_id | TEXT | If cloned from template |
| execution_count | INTEGER | |
| last_triggered_at | DATETIME | |
| workspace_id, created_by, created_at, updated_at | — | Standard |

### Schema: `cop_playbook_rules`

| Field | Type | Purpose |
|---|---|---|
| id | TEXT (ULID) | |
| playbook_id | TEXT | Parent playbook |
| name | TEXT | "Escalate overdue RFIs" |
| position | INTEGER | Evaluation order |
| enabled | BOOLEAN | |
| trigger_event | TEXT | Event type to match |
| trigger_filter | JSON | Additional payload conditions |
| conditions | JSON | Array of checks |
| actions | JSON | Array of actions |
| cooldown_seconds | INTEGER | Re-fire prevention window |
| last_fired_at | DATETIME | |
| fire_count | INTEGER | |

### Schema: `cop_playbook_log`

| Field | Type | Purpose |
|---|---|---|
| id | TEXT (ULID) | |
| rule_id | TEXT | |
| playbook_id | TEXT | |
| cop_session_id | TEXT | |
| trigger_event_id | TEXT | The `cop_events` row that caused it |
| actions_taken | JSON | What was executed |
| status | TEXT | success / partial / failed |
| error_message | TEXT | |
| duration_ms | INTEGER | |
| created_at | DATETIME | |

### Condition DSL

```json
[
  { "field": "payload.priority", "op": "eq", "value": "critical" },
  { "field": "session.open_rfi_count", "op": "gt", "value": 10 },
  { "field": "time.hours_since_created", "op": "gt", "value": 24 }
]
```

Operators: `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `in`, `not_in`, `contains`, `exists`

### Action Types

| Action | Parameters | Example |
|---|---|---|
| `create_task` | title, type, priority, assign_to | Auto-create task from submission |
| `update_status` | entity_type, entity_id, new_status | Move RFI to escalated |
| `assign_task` | task_id, strategy | Auto-assign unblocked tasks |
| `create_evidence` | from submission/entity, tags | Promote submission |
| `send_notification` | channel, message | Alert on SLA breach |
| `update_priority` | entity_type, entity_id, new_priority | Escalate |
| `add_tag` | entity_type, entity_id, tag | Auto-tag |
| `create_rfi` | question, priority, assigned_to | Auto-generate RFI |
| `reserve_asset` | asset_id, task_id | Allocate resource |
| `run_pipeline` | stages array | Multi-step workflows |

### Pipeline Stages

```json
{
  "action": "run_pipeline",
  "stages": [
    { "name": "ingest", "action": "create_evidence", "params": { "from": "trigger.entity" } },
    { "name": "tag", "action": "add_tag", "params": { "tag": "auto-ingested" } },
    { "name": "task", "action": "create_task", "params": {
        "title": "Verify: {{trigger.payload.title}}",
        "type": "forensic", "priority": "medium",
        "assign_to": { "strategy": "least_loaded", "skills": ["forensic"] }
    }},
    { "name": "notify", "action": "send_notification", "params": {
        "message": "New submission auto-triaged and assigned to {{stage.task.assigned_to}}"
    }}
  ]
}
```

### Execution Model

Cloudflare Cron Trigger every 60 seconds:
1. Query `cop_events` where `id > last_processed_event_id` per active playbook
2. Evaluate rules in position order
3. Execute matching actions, log to `cop_playbook_log`
4. Advance cursor

### Default Playbook Templates

| COP Template | Default Playbook |
|---|---|
| OSINT Campaign | Ingest -> auto-tag -> create verification task -> assign |
| Event Monitor | Threshold: >5 events/1h same location -> create RFI + escalate |
| Crisis Response | SLA enforcement: overdue tasks auto-escalate, notify admin |
| Area Study | Gap detector: entity with <2 evidence links -> create collection RFI |

### API Endpoints

- `GET/POST /api/cop/:id/playbooks` — List/create
- `GET/PUT/DELETE /api/cop/:id/playbooks/:pbId` — CRUD
- `GET/POST/PUT/DELETE /api/cop/:id/playbooks/:pbId/rules` — CRUD rules
- `GET /api/cop/:id/playbooks/:pbId/log` — Execution audit
- `POST /api/cop/:id/playbooks/:pbId/test` — Dry-run against recent events

### UI Components

- `CopPlaybookPanel.tsx` — List with active/paused toggle, execution stats
- `CopPlaybookEditor.tsx` — Visual rule builder
- `CopPipelineBuilder.tsx` — Drag-and-drop stage sequencer
- `CopPlaybookLog.tsx` — Searchable execution history

---

## Architecture Summary

```
┌─────────────────────────────────────────────────┐
│                   COP Session                    │
├──────────┬──────────┬───────────┬───────────────┤
│ Ingest   │ Tasks    │ Assets    │ Export        │
│ Forms    │ Board    │ Tracker   │ Engine        │
│ Tiplines │ Deps     │ People    │ GeoJSON/KML   │
│ Triage   │ Subtasks │ Sources   │ CoT/STIX/CSV  │
│ Queue    │ SLAs     │ Infra     │               │
│          │ Auto-    │ Digital   │               │
│          │ assign   │           │               │
├──────────┴──────────┴───────────┴───────────────┤
│              cop_events (event bus)               │
├─────────────────────────────────────────────────┤
│           Playbook Engine (Phase 6)              │
│   Rules -> Conditions -> Actions -> Pipelines    │
│         Cron-driven, 60s polling                 │
└─────────────────────────────────────────────────┘
```

## New Tables Summary

| Table | Phase | Purpose |
|---|---|---|
| `cop_events` | 1 | Event bus |
| `cop_intake_forms` | 2 | Form definitions |
| `cop_submissions` | 2 | Inbound submissions |
| `cop_task_dependencies` | 3 | Task sequencing |
| `cop_task_templates` | 3 | Reusable task lists |
| `cop_assets` | 4 | Unified resource tracker |
| `cop_asset_log` | 4 | Asset status audit trail |
| `cop_exports` | 5 | Export history |
| `cop_playbooks` | 6 | Automation definitions |
| `cop_playbook_rules` | 6 | Rule definitions |
| `cop_playbook_log` | 6 | Execution audit |

## New API Endpoints Summary

~25 new endpoints across 6 phases, plus extensions to existing task/collaborator endpoints.

## New UI Components Summary

~18 new components, plus extensions to CopTaskBoard, CopInviteDialog, and COP toolbar.
