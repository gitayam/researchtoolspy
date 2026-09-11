# Timeline durable foundation continuation

Baseline: local foundation 110184fd854951e38072ff30c120604a19376512; fresh origin/main
559425f24802911715676173db4e7bae81a99efb and gitlab/main
d7b5c43a1c36ebf2bdc500e2583fa4870a1d989a unchanged. Canonical remains origin/main.
Shared clean integration worktree: researchtoolspy-timeline-foundation-20260911.

Outcome: integration-enabling first TL-03 slice: authenticated human callers can
create private investigation artifacts, atomically revise stable typed event-candidate
objects, and read pinned immutable history. This is a partial TL-03 delivery until
scoped external-service access and the consumer integration are accepted. No
publication, production migration, deployment, guest persistence, evidence-judgment
semantics, arbitrary branches, merges or cross-app edits are included.

Contract: POST /api/timelines creates {schemaVersion:"timeline-artifact-create.v1",
workspaceId,title}; requires Idempotency-Key. GET /api/timelines/{id} returns artifact
metadata and quoted head-revision ETag. PATCH same path accepts
{schemaVersion:"timeline-artifact-commit.v1",changes:[...]} with Idempotency-Key and
If-Match of the quoted expected head. Changes are typed put/delete operations on
stable caller-supplied object IDs (up to 200 ASCII identifier characters, including
local workspace dots/colons); server artifact/revision IDs remain bounded to 64. Supported kind is event-candidate.v1 with explicit
bounded title, description and optional partial date/precision fields. Delete is a
versioned tombstone; IDs cannot change kind or be recycled. Up to 10 changes, 1000
objects per artifact, 64 KiB request, bounded title/payload fields. Reject unknown
fields, duplicate changes, invalid dates/precision, oversized streamed bodies.

GET /api/timelines/{id}/objects reads a pinned revision with bounded limit/cursor.
GET /api/timelines/{id}/revisions lists immutable history with stable pagination.
GET /api/timelines/{id}/revisions/{revisionId} returns immutable metadata/manifest.
Concrete response schema names and cursor fields must be documented with runtime
validation tests. Errors use a versioned timeline error envelope, no internal SQL or
credential details; no response stores raw credentials.

Authorization: existing human JWT/session/hash identity only, no auto-provisioning,
no guest/service identities. Active registered user must own the explicit private
workspace or have VIEWER(read)/EDITOR or ADMIN(write) membership. No default '1',
public-workspace or cop-* bypass. Every read and replay reauthorizes; write batches
reauthorize inside their transaction. Service credentials are explicitly rejected;
extraction capability discovery remains unchanged.

Storage: forward managed migration 0011 only, preserve applied migrations. Composite
workspace/artifact/object/version constraints. Immutable object versions, revisions,
parent edges, changes and manifests. Default main branch and root revision created
atomically. One same-artifact parent per ordinary revision. Atomic DB.batch plus
SQL-enforced stale-head and authorization guards; zero-row CAS alone is insufficient.
No residual rows on failure. Principal/workspace/resource/key idempotency uniqueness,
canonical request fingerprint and original response recorded in transaction. Same
key/different request conflicts; concurrent identical retries return original result.
Historical reads resolve the pinned manifest, never current versions. No second
mutable copy of domain payloads. Bound SQL parameter/statement counts for real D1.

Ownership: native tl00_recon cooperative provider owns only new 0011 migration,
functions/api/_shared/timeline-artifact-{contract,auth,store}.ts,
functions/api/timelines/index.ts, functions/api/timelines/[id]/index.ts,
functions/api/timelines/[id]/objects.ts, functions/api/timelines/[id]/revisions.ts,
functions/api/timelines/[id]/revisions/[revisionId].ts,
tests/e2e/smoke/timeline-artifact-{contract,auth,d1}.spec.ts and
docs/api/TIMELINE-ARTIFACTS.md. Owner owns documentation/verification seams and commits.
Independent reviewer is read-only; no worker runs candidate scripts on the host.
Owner-authorized additions: dependency_review owns only the independent
`tests/e2e/smoke/timeline-artifact-migrations.spec.ts` full managed-chain rehearsal.
Owner handles API documentation links, verification script/config, CORS PATCH and
conditional-write headers, and mobile navigation test corrections. The immutable
initial provider prompt remains recorded; these are additive seam clarifications.

Verification: matching Playwright1.60 container, credential-free dependency preparation
with ignore-scripts; candidate runtime has no external network, host credentials or
Docker socket. Owner runs actual Miniflare D1 routes for auth/isolation, retries,
concurrent CAS, rollback, immutable-table constraints, cross-artifact references,
historical reconstruction and pagination. Five existing types/build and foundation
contract/UI regression remain gates. Migration parser must preserve trigger bodies;
prove fresh prerequisite schema plus migration and upgrade from prior schema in real D1.
Independent tests run actual managed migrations 0001–0011 and a seeded 0010→0011
upgrade against explicit synthetic prerequisites; no production-equivalent schema
catalog is present, so production-equivalent rehearsal remains a separate gate.
No production migration application. Runtime/source acceptance binds committed SHA.
Stop on incompatible shared contract, unavailable real-runtime verification or need
for credentials. Preserve work and record incomplete gates without widening scope.
