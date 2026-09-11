# Private timeline artifact foundation

Availability: durable human and service APIs deployed to researchtools.net on 2026-09-11 with
managed migrations 0011–0013. Browser snapshot saving and scoped service read/write are deployed. See the [service release receipt](../plans/2026-09-11-timeline-service-release-receipt.md).

This is the released durable foundation of TL-03. It persists private investigation artifacts, stable event-candidate identities and immutable revisions. The complete browser workspace snapshot consumer is deployed with migration 0012. Existing service credentials can be assigned independent timeline read/write scopes. Extraction remains the independent, nonpersistent `timeline-analysis.v1` API. Capability discovery advertises durable operations only to currently authorized service clients.

Human calls require an existing active JWT/session bearer or registered `X-User-Hash` identity. This route family never provisions an identity. Guest sessions and guest/service roles on human credentials are rejected. Reserved `rt_svc_` bearers use scoped service authentication and never fall through to a human hash header. For human calls, fresh database state must show a nonblank human role and active user. A human caller must own the explicit private workspace or have `VIEWER` for reads, `EDITOR`/`ADMIN` for writes. Workspace `1` is excluded. Public flags and `cop-*` names never confer access. `X-Workspace-ID`, when supplied, must match the resource. Inaccessible artifact IDs return the same 404 as missing artifacts; explicit workspace creation denial is 403. POST/PATCH replays require current write permission, including after membership demotion.

## Create and commit

```http
POST /api/timelines
Authorization: Bearer <existing-human-session>
Content-Type: application/json
Idempotency-Key: timeline-create-0001

{"schemaVersion":"timeline-artifact-create.v1","workspaceId":"workspace-a","title":"Investigation"}
```

The response is `201`, with an empty root revision and default `main` branch. Metadata is `timeline-artifact.v1`, with these required fields:

```json
{
  "schemaVersion": "timeline-artifact.v1",
  "artifactId": "timeline_<uuid>",
  "workspaceId": "workspace-a",
  "title": "Investigation",
  "branch": "main",
  "revisionId": "rev_<uuid>",
  "sequence": 0,
  "objectCount": 0,
  "contentHash": "<64 lowercase hexadecimal SHA-256 characters>",
  "createdBy": 7,
  "createdAt": "2026-09-11T00:00:00.000Z"
}
```

`GET /api/timelines/{artifactId}` returns the same shape at the current head, with a strong quoted revision ETag: `ETag: "rev_<uuid>"`. `createdBy`/`createdAt` describe artifact creation. Title is immutable in this slice; PATCH modifies typed objects, not artifact metadata.

```http
PATCH /api/timelines/{artifactId}
Authorization: Bearer <existing-human-session>
Content-Type: application/json
Idempotency-Key: timeline-commit-0001
If-Match: "rev_<uuid>"

{
  "schemaVersion": "timeline-artifact-commit.v1",
  "changes": [
    {
      "op": "put",
      "objectId": "event:source.001",
      "kind": "event-candidate.v1",
      "payload": {
        "title": "Candidate occurrence",
        "description": null,
        "eventDate": "2026-09",
        "datePrecision": "month"
      }
    }
  ]
}
```

A successful PATCH returns `200 timeline-artifact.v1` and the new head ETag. `put` creates an identity when absent or creates a new immutable version of that same identity. Its kind is fixed for the lifetime of the object; changing kinds returns `409 object_conflict`. `delete` has exactly `{ "op": "delete", "objectId": "event:source.001" }`; it creates a tombstone version. Old payloads remain readable at their old revision. Tombstones remain in the manifest and cannot be resurrected or recycled, including by selecting an older version. Deleting an absent or already deleted object conflicts. An identical `put` is an explicit new revision, not an automatically suppressed no-op.

Candidate payload fields are exactly `title`, `description`, and optional paired `eventDate`/`datePrecision`. Title is nonblank and at most 200 UTF-16 code units; description is null or at most 2000 UTF-16 code units. Neither date field is required, but they must appear together. Dates use calendar-valid `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`, year at least 1000, with matching `year`/`month`/`day` precision. Unknown dates stay absent. No evidence, corroboration, confidence or judgment fields are accepted. Candidate identity and narrative role do not imply assessed truth.

The implemented snapshot kind `timeline-workspace.v1` carries one complete `TimelineWorkspaceExport` as its payload: `schemaVersion`, `exportedAt`, `source`, and `analystWorkspace`. The shared strict local-import codec validates it, including original extraction, original event wording, stable event IDs, analyst edits, narrative chapters and roles, questions, hypotheses and their references. Unknown fields or invalid references fail closed. Storage retains the submitted payload shape; it does not truncate or convert the workspace to an event candidate. Existing `event-candidate.v1` validation and write hashes remain compatible.

A snapshot payload is limited to 60 KiB of canonical serialized UTF-8, independently of the 64 KiB streamed request limit. A malformed or over-limit snapshot payload returns `400 invalid_request`; an over-limit wire body returns `413 limit_exceeded`. Local imports still support their larger 4 MiB limit, so some valid local workspaces cannot fit this first durable snapshot slice.

Requests reject unknown fields and duplicate object IDs. There must be 1–10 changes and at most 1000 lifetime object identities per artifact, including tombstones. The full streamed request is limited to 64 KiB UTF-8. Artifact title is nonblank and at most 200 UTF-16 code units. Caller-supplied object IDs preserve local IDs: `[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}`. Server artifact/revision/version IDs use at most 64 alphanumeric/underscore/hyphen characters. Workspace IDs use at most 128 alphanumeric/dot/underscore/colon/hyphen characters with an initial alphanumeric.

`Idempotency-Key` is required for both mutations: 16–128 characters, initial alphanumeric, remaining alphanumeric/dot/underscore/colon/hyphen. Its uniqueness scope is authenticated principal + workspace + resource (`create` or artifact ID) + key. Reuse within that scope with identical canonical input returns the original status, response bytes and ETag, even after later revisions. Different request content conflicts. Commit fingerprints include the operation, artifact ID and original If-Match value; retry with the original successful now-stale If-Match replays, while changing If-Match under the same key conflicts. Different resources/workspaces/principals have independent key namespaces. Replays validate the stored response schema and artifact/workspace/revision binding before returning original bytes.

If-Match is mandatory on PATCH. Accept exactly one strong quoted revision ID; weak tags, wildcards, lists and unquoted values are invalid. Missing precondition returns 428, malformed precondition 400, and a current-head mismatch returns 412. Authorization precedes replay and conflict disclosure.

## Browser save and reopen (deployed)

The browser uses the stable object ID `browser-workspace` and kind `timeline-workspace.v1`. Each explicit save commits the complete workspace as one immutable snapshot in one PATCH. A new save first creates an empty artifact and then commits its snapshot; an interrupted initial save may leave an empty artifact, and retry reuses its original create/commit keys. The browser checks the full snapshot size before either request, leaving oversized timelines open for local editing and JSON export.

Saving and reopening require an existing authenticated human in the selected private workspace. Guests retain local drafts and export. A saved timeline link identifies the artifact and workspace; it conveys no access. Reopen reads metadata, pins the object read to that revision, and validates the complete snapshot, object hash and manifest hash before replacing the open timeline. The browser expects one live `browser-workspace` snapshot object.

Updates send the saved revision's strong ETag in `If-Match`. A retry retains the same payload, idempotency key and original ETag to recover an acknowledged or uncertain save. A newer head produces an explicit conflict; it never silently overwrites another revision. Permission loss, network failure or invalid responses preserve the open local workspace. Changing the authenticated identity, selected saving workspace or human eligibility clears opened private content and invalidates reuse of that save attempt; the prior local draft remains intact. Same-principal credential refresh can retry the original operation. Explicit reopen or saving a separate copy lets the analyst resolve a conflict.

## Scoped service access

`timeline.read` grants all four GET routes: metadata, object pages, revision pages
and revision detail. `timeline.write` grants create and commit; it does not grant
GET. The existing community artifact/research scopes grant neither operation.
`COMMUNITY_INTEGRATIONS_ENABLED` must be exactly `true`. The credential remains
bound to its one private TEAM workspace, service principal, active intake
investigation, audience and deployment environment. No guest identity, public
workspace or caller-selected replacement binding is accepted.

Reads and idempotency replays check the current presented token, scope and binding.
A valid rotated token for the same principal can replay the original key/body/ETag;
a revoked, expired, replaced or insufficiently scoped token cannot borrow authority
from another live slot. Every service mutation batch begins with an aborting SQL
assertion of the exact token ID and HMAC digest, database-time validity, integer
timestamp validity and complete current binding. The revision trigger independently
retains human authorization and checks live service write eligibility. Direct SQL
is privileged; the request-specific token check belongs to the atomic API batch.
No credential or digest is stored in timeline history or returned by the API.

Service authentication failures use the existing `timeline-artifact-error.v1`
envelope: invalid/expired/revoked credentials return 401 `authentication_required`,
missing scope or disabled integration returns 403 `access_denied`, and unavailable
auth storage returns 503 `datastore_unavailable`. Cross-workspace artifact reads
remain indistinguishable from missing artifacts. All existing bounds and revision
preconditions apply to both identity types.

Migration `0013_timeline_service_scopes.sql` atomically widens the existing scope
table CHECK and replaces the revision authorization trigger. Existing scope rows,
PK/FK/index definitions and timeline history are preserved. It creates no client,
token or grant. Assign new scopes only after compatible deployment; old applications
reject tokens containing unknown scopes. Rollback must retain compatible code or
use separately authorized credential remediation, never silently remove grants or
restore the whole database. See [service rollout and discovery](./COMMUNITY-INTEGRATIONS-API.md#durable-timeline-service-scopes-deployed).

## Pinned reads

All read routes reauthorize current human membership or service credential binding and workspace privacy. All responses use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. No response or replay stores raw credentials. Mutation responses and all revision-pinned reads expose a quoted revision ETag.

| Route | Required response shape | Pagination |
|---|---|---|
| `GET /api/timelines/{id}/objects` | `timeline-object-page.v1`: `artifactId`, `revisionId`, `objects`, `nextCursor` | Optional `revisionId`, `limit`, `cursor`; first page without revision pins current head |
| `GET /api/timelines/{id}/revisions` | `timeline-revision-page.v1`: `artifactId`, `headRevisionId`, `revisions`, `nextCursor` | Optional `limit`, `cursor`; pins the head seen on its first page |
| `GET /api/timelines/{id}/revisions/{revisionId}` | `timeline-revision.v1`: `artifactId`, `workspaceId`, `revisionId`, `sequence`, `parentRevisionIds`, `contentHash`, `createdBy`, `createdAt`, `manifest`, `changes` | No pagination parameters; complete manifest is bounded to 1000 references, changes to 10 |

Object entries contain `{objectId, versionId, kind, tombstone, contentHash, payload}`; tombstones have `payload: null`. Manifest entries have the same identity/hash fields without payload. Historical detail contains immutable semantic changes `{objectId, operation, beforeVersionId, afterVersionId}`, where operation is `create`, `revise`, or `tombstone`; create has null `beforeVersionId`. Revision list entries contain `{revisionId, sequence, parentRevisionIds, objectCount, changeCount, contentHash, createdBy, createdAt}`. Root has no parents; each subsequent revision has exactly one parent. Revision author/time fields describe that commit.

Default page size is 50, maximum 100. Unknown/repeated query parameters are rejected. Objects sort by binary ascending stable object ID; revisions by descending sequence. Opaque base64url JSON cursors are at most 1024 characters and bind schema version, sort, artifact, pinned revision/head and position. They are selectors, not authorization tokens; every reference is reauthorized and checked against the artifact. Passing a cursor with a different artifact, sort, or explicit `revisionId` is invalid. Cursor pages do not incorporate commits made after the first page. Clients must treat cursors as opaque; no signature or confidentiality is promised.

## Errors and storage invariants

Errors have `{schemaVersion:"timeline-artifact-error.v1", requestId, error:{code,retryable}}`. Internal SQL, transport details and credentials are omitted. `retryable` is true only for datastore failures. Middleware may still emit its existing error shape before reaching these routes.

| HTTP | Code |
|---|---|
| 400 | `invalid_request` |
| 401 | `authentication_required` |
| 403 | `human_identity_required`, `access_denied` |
| 404 | `not_found` |
| 409 | `idempotency_conflict`, `object_conflict`, `limit_exceeded` |
| 412 | `stale_revision` |
| 413 | `limit_exceeded` |
| 428 | `precondition_required` |
| 503 | `datastore_unavailable` |

Managed migration `0011_timeline_foundation.sql` creates normalized identities, immutable typed object versions, revision parents, semantic changes, pinned manifests, one default branch and replay records. Composite keys bind every object/version/revision reference to its workspace and artifact. User and workspace deletion is restricted by these references; this slice does not implement retention/deletion workflows.

Each commit is one real D1 `batch()`: revision insert (with transaction-time authorization and expected-head trigger), parent edge, new identities/versions, one bound-JSON manifest insert, semantic changes, guarded head advancement, and replay record. At most 35 statements are needed for ten new objects; copying unchanged manifest references uses one `json_each` statement rather than one statement per object. The final head trigger verifies parent count, manifest/change counts, before/after version alignment, changed-object records and retained tombstones. Any constraint failure rolls back the entire batch. A zero-row conditional update is not used as the concurrency guarantee.

INSERT guards seal manifest/parent/change rows once their revision is at or before the published head. UPDATE/DELETE and duplicate-identity INSERT/REPLACE guards protect immutable rows independently of SQLite recursive-delete-trigger settings. Version and change guards prevent tombstone resurrection, including reuse of a pre-tombstone version. Parent storage is separate from revisions for future reviewed merge evolution; this migration permits only the root plus ordinary one-parent commits and the default main branch.

Version hashes use SHA-256 of canonical JSON `{schemaVersion:kind,tombstone,payload}`, where kind is `event-candidate.v1` or `timeline-workspace.v1`. Existing candidate hash inputs are unchanged. Canonical JSON sorts object keys and preserves array order. Revision hashes cover the binary-object-ID-sorted manifest entries, including stable version IDs, kind, tombstone and content hash. Historical detail recomputes manifest hashes. Object reads validate payload schemas and recompute version hashes; malformed stored snapshots return `503 datastore_unavailable`. Payload versions are never replaced by current versions when reading history. Commit and revision-manifest queries fetch only identity/hash metadata, avoiding loading unchanged snapshot bodies; full payloads are fetched only through bounded object pages.

## Migration 0012 (deployed)

`0012_timeline_workspace_snapshots.sql` widens the kind CHECK constraints on `timeline_objects` and `timeline_object_versions` through a two-table rebuild. Applied migration 0011 is unchanged. The entire migration must execute within one atomic D1 transaction, with `PRAGMA defer_foreign_keys=ON`; sequential `prepare().run()` calls are unsupported. The migration copies rows into temporary ordinary backup tables, recreates the original table names, restores every row without rewriting payloads/hashes, removes the backups, restores all seven attached immutable guards and adds object-kind/version-schema consistency. External triggers and composite references retain their original names. No original table is renamed.

Acceptance requires a populated 0011 upgrade, exact preservation of legacy rows, trigger and index definitions, historical response bytes, foreign-key integrity, and rollback of a failure injected during the rebuild in real D1. Production consideration also requires the actual production schema rehearsal and verification that the release runner applies the complete migration atomically, including its tracker update. A successful isolated `db.batch()` test alone does not prove the remote apply path.

There is no destructive down migration. Rolling back to the older application retains database history but that application cannot reopen the new snapshot kind. Restore a compatible application to regain snapshot access; do not delete snapshot rows or revert the schema to narrow CHECK constraints.

## Validation boundary

Run only inside the credential-free validator:

```sh
node node_modules/playwright/cli.js test --config=playwright.timeline.config.ts --project=chromium timeline-artifact-contract.spec.ts timeline-artifact-auth.spec.ts timeline-artifact-d1.spec.ts timeline-artifact-migrations.spec.ts timeline-workspace-snapshot-d1.spec.ts timeline-service-d1.spec.ts
node node_modules/typescript/bin/tsc -p tsconfig.functions.json --noEmit
```

Route tests use actual Miniflare D1, without publishers, model calls or real credentials. They cover concurrent retries, CAS losers, rollback around publication, transaction-time auth changes, current permission checks on replay, pinned pagination, history/hash reconstruction, sealed INSERT/REPLACE attacks, tombstone preservation and corrupt replay rejection. Separate migration tests apply the actual complete managed migration chain to a documented synthetic prerequisite schema and rehearse seeded-prefix upgrade. These historical-chain tests do not establish an authoritative bootstrap. Release verification separately imported a schema-only production export, applied the pending migration in disposable D1, and exercised the compiled Pages worker with synthetic users. Production migrations 0011–0013 are applied and all 12 timeline/credential tables, columns, foreign keys, indexes and triggers match the service rehearsal manifest. Production smoke checks are anonymous reads/preflights; authenticated writes were tested in the isolated rehearsal. Snapshot tests additionally exercise full extraction/narrative round trips, pinned historical snapshots, replay and stale heads, kind-switch rejection, exact 60 KiB UTF-8 boundaries, malformed stored payload rejection, populated 0011→0012 preservation and injected migration rollback. The snapshot slice is deployed. The production catalog was compared before and after managed application: all 12 timeline/credential tables, 282 schema details, existing scope rows and timeline counts match the guarded rehearsal; no rebuild backup tables remain. Browser save/reopen, conflict, lost-response/token-refresh retry and private-content cleanup tests passed in Chromium and mobile Safari through real D1 routes. TL-03 scoped service acceptance now passes real-D1 and compiled-worker gates. Later evidence, handoff and composition checkpoints remain separate.
