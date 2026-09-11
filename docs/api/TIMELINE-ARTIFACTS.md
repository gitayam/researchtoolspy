# Private timeline artifact foundation

Availability: local implementation and validation only. No production deployment
or migration application has occurred.

This is the human-only first slice of TL-03. It persists private investigation artifacts, stable event-candidate identities and immutable revisions. It does not complete external-service access or connect the browser-local workspace to durable storage. Extraction remains the independent, nonpersistent `timeline-analysis.v1` API. Capability discovery is unchanged and does not advertise this slice to service clients.

Existing active human JWT/session bearer or registered `X-User-Hash` identity is required. This route family never provisions an identity. Guest sessions, guest/service database roles and reserved `rt_svc_` bearers are rejected; a service bearer cannot fall through to a human hash header. Fresh database state must show a nonblank human role and active user. The caller must own the explicit private workspace or have `VIEWER` for reads, `EDITOR`/`ADMIN` for writes. Workspace `1` is excluded. Public flags and `cop-*` names never confer access. `X-Workspace-ID`, when supplied, must match the resource. Inaccessible artifact IDs return the same 404 as missing artifacts; explicit workspace creation denial is 403. POST/PATCH replays require current write permission, including after membership demotion.

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

`GET /api/timelines/{artifactId}` returns the same shape at the current head, with a strong quoted revision ETag: `ETag: "rev_<uuid>"`. `createdBy`/`createdAt` describe artifact creation. Title is immutable in this slice; PATCH modifies candidate objects, not artifact metadata.

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

A successful PATCH returns `200 timeline-artifact.v1` and the new head ETag. `put` creates an identity when absent or creates a new immutable version of that same identity. `delete` has exactly `{ "op": "delete", "objectId": "event:source.001" }`; it creates a tombstone version. Old payloads remain readable at their old revision. Tombstones remain in the manifest and cannot be resurrected or recycled, including by selecting an older version. Deleting an absent or already deleted object conflicts. An identical `put` is an explicit new revision, not an automatically suppressed no-op.

Candidate payload fields are exactly `title`, `description`, and optional paired `eventDate`/`datePrecision`. Title is nonblank and at most 200 UTF-16 code units; description is null or at most 2000 UTF-16 code units. Neither date field is required, but they must appear together. Dates use calendar-valid `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`, year at least 1000, with matching `year`/`month`/`day` precision. Unknown dates stay absent. No evidence, corroboration, confidence or judgment fields are accepted. Candidate identity and narrative role do not imply assessed truth.

Requests reject unknown fields and duplicate object IDs. There must be 1–10 changes and at most 1000 lifetime object identities per artifact, including tombstones. The full streamed request is limited to 64 KiB UTF-8. Artifact title is nonblank and at most 200 UTF-16 code units. Caller-supplied object IDs preserve local IDs: `[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}`. Server artifact/revision/version IDs use at most 64 alphanumeric/underscore/hyphen characters. Workspace IDs use at most 128 alphanumeric/dot/underscore/colon/hyphen characters with an initial alphanumeric.

`Idempotency-Key` is required for both mutations: 16–128 characters, initial alphanumeric, remaining alphanumeric/dot/underscore/colon/hyphen. Its uniqueness scope is authenticated principal + workspace + resource (`create` or artifact ID) + key. Reuse within that scope with identical canonical input returns the original status, response bytes and ETag, even after later revisions. Different request content conflicts. Commit fingerprints include the operation, artifact ID and original If-Match value; retry with the original successful now-stale If-Match replays, while changing If-Match under the same key conflicts. Different resources/workspaces/principals have independent key namespaces. Replays validate the stored response schema and artifact/workspace/revision binding before returning original bytes.

If-Match is mandatory on PATCH. Accept exactly one strong quoted revision ID; weak tags, wildcards, lists and unquoted values are invalid. Missing precondition returns 428, malformed precondition 400, and a current-head mismatch returns 412. Authorization precedes replay and conflict disclosure.

## Pinned reads

All read routes reauthorize current membership, active human identity and workspace privacy. All responses use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. No response or replay stores raw credentials. Mutation responses and all revision-pinned reads expose a quoted revision ETag.

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

Version hashes use SHA-256 of canonical JSON `{schemaVersion:"event-candidate.v1",tombstone,payload}`. Canonical JSON sorts object keys and preserves array order. Revision hashes cover the binary-object-ID-sorted manifest entries, including stable version IDs, kind, tombstone and content hash. Historical detail recomputes manifest hashes; payload versions are never replaced by current versions when reading history.

## Validation boundary

Run only inside the credential-free validator:

```sh
node node_modules/playwright/cli.js test --config=playwright.timeline.config.ts --project=chromium timeline-artifact-contract.spec.ts timeline-artifact-auth.spec.ts timeline-artifact-d1.spec.ts timeline-artifact-migrations.spec.ts
node node_modules/typescript/bin/tsc -p tsconfig.functions.json --noEmit
```

Route tests use actual Miniflare D1, without publishers, model calls or real credentials. They cover concurrent retries, CAS losers, rollback around publication, transaction-time auth changes, current permission checks on replay, pinned pagination, history/hash reconstruction, sealed INSERT/REPLACE attacks, tombstone preservation and corrupt replay rejection. Separate migration tests apply the actual complete managed migration chain to a documented synthetic prerequisite schema and rehearse seeded-prefix upgrade. This is not a production-equivalent bootstrap or production migration application: the repository does not provide one complete authoritative historical bootstrap. The broader TL-03 checkpoint still requires scoped external-service access and consumer integration acceptance.
